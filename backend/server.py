import asyncio
import ipaddress
import mimetypes
import socket
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from utils.chunk_handler import (
    classify_file,
    cleanup_chunks,
    ensure_directories,
    is_allowed_file,
    list_received_chunks,
    merge_chunks,
    sanitize_filename,
    save_chunk,
)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
CHUNKS_ROOT = ensure_directories(UPLOAD_DIR)
CHUNK_SIZE = 1024 * 1024
MAX_CHUNK_BYTES = CHUNK_SIZE + 16 * 1024
MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024
MAX_TOTAL_CHUNKS = (MAX_FILE_BYTES + CHUNK_SIZE - 1) // CHUNK_SIZE
STREAM_BUFFER_SIZE = 1024 * 1024


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await run_in_threadpool(reset_session_storage)
    yield


app = FastAPI(title="ShareIt Local Transfer API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_locks: dict[str, asyncio.Lock] = {}
merged_uploads: dict[str, str] = {}
file_owners: dict[str, str] = {}
RFC1918_192 = ipaddress.ip_network("192.168.0.0/16")
RFC1918_10 = ipaddress.ip_network("10.0.0.0/8")
RFC1918_172 = ipaddress.ip_network("172.16.0.0/12")


def get_lock(file_id: str) -> asyncio.Lock:
    if file_id not in upload_locks:
        upload_locks[file_id] = asyncio.Lock()
    return upload_locks[file_id]


def forget_file(filename: str) -> None:
    file_owners.pop(filename, None)
    for fid, name in list(merged_uploads.items()):
        if name == filename:
            merged_uploads.pop(fid, None)
            upload_locks.pop(fid, None)


def reset_session_storage() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CHUNKS_ROOT.mkdir(parents=True, exist_ok=True)

    for path in UPLOAD_DIR.iterdir():
        if path.name == ".chunks":
            continue
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        else:
            path.unlink(missing_ok=True)

    for path in CHUNKS_ROOT.iterdir():
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        else:
            path.unlink(missing_ok=True)

    merged_uploads.clear()
    upload_locks.clear()
    file_owners.clear()


def file_iterator(path: Path, start: int, end: int, on_complete=None):
    completed = False
    try:
        with path.open("rb") as file_obj:
            file_obj.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                read_size = min(STREAM_BUFFER_SIZE, remaining)
                chunk = file_obj.read(read_size)
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk
        completed = remaining == 0
    finally:
        if completed and on_complete is not None:
            on_complete()


def parse_range_header(range_header: str | None, file_size: int) -> tuple[int, int, int]:
    if not range_header:
        return 0, file_size - 1, 200

    if not range_header.startswith("bytes="):
        raise HTTPException(status_code=416, detail="Invalid range header")

    try:
        range_value = range_header.replace("bytes=", "", 1)
        start_str, end_str = range_value.split("-", 1)

        if start_str == "":
            suffix_length = int(end_str)
            if suffix_length <= 0:
                raise ValueError("Suffix length must be positive")
            start = max(file_size - suffix_length, 0)
            end = file_size - 1
        else:
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1

        if start < 0 or end >= file_size or start > end:
            raise ValueError("Range out of bounds")

        return start, end, 206
    except ValueError as exc:
        raise HTTPException(status_code=416, detail="Invalid range request") from exc


def build_streaming_response(
    path: Path,
    request: Request,
    inline: bool,
    delete_on_complete: bool = False,
) -> StreamingResponse:
    file_size = path.stat().st_size
    range_header = request.headers.get("range")
    start, end, status_code = parse_range_header(range_header, file_size)

    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    disposition = "inline" if inline else "attachment"
    safe_filename = quote(path.name)

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{safe_filename}",
    }
    if status_code == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"

    on_complete = None
    if delete_on_complete and status_code == 200:
        def on_complete() -> None:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
            forget_file(path.name)

    return StreamingResponse(
        file_iterator(path, start, end, on_complete=on_complete),
        status_code=status_code,
        media_type=media_type,
        headers=headers,
    )


def get_local_ips() -> list[str]:
    addresses: set[str] = set()

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addr = info[4][0]
            if not addr.startswith("127."):
                addresses.add(addr)
    except socket.gaierror:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # No packets are sent; this asks the OS which interface is active.
            sock.connect(("8.8.8.8", 80))
            addr = sock.getsockname()[0]
            if addr and not addr.startswith("127."):
                addresses.add(addr)
    except OSError:
        pass

    ranked_ips = sorted(
        (ip for ip in addresses if is_usable_lan_ip(ip)),
        key=ip_rank,
    )
    if ranked_ips:
        return ranked_ips
    return ["127.0.0.1"]


def is_usable_lan_ip(ip: str) -> bool:
    try:
        candidate = ipaddress.ip_address(ip)
    except ValueError:
        return False
    if not isinstance(candidate, ipaddress.IPv4Address):
        return False
    if candidate.is_loopback or candidate.is_link_local or candidate.is_multicast or candidate.is_unspecified:
        return False
    return True


def ip_rank(ip: str) -> tuple[int, int]:
    candidate = ipaddress.ip_address(ip)
    if candidate in RFC1918_192:
        return 0, int(candidate)
    if candidate in RFC1918_10:
        return 1, int(candidate)
    if candidate in RFC1918_172:
        return 2, int(candidate)
    if candidate.is_private:
        return 3, int(candidate)
    if candidate.is_global:
        return 4, int(candidate)
    return 5, int(candidate)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/local-info")
async def local_info() -> dict[str, object]:
    local_ips = get_local_ips()
    preferred_ip = local_ips[0]
    return {
        "port": 8000,
        "preferred_ip": preferred_ip,
        "preferred_url": f"http://{preferred_ip}:8000",
        "local_ips": local_ips,
        "urls": [f"http://{ip}:8000" for ip in local_ips],
    }


@app.post("/upload-chunk")
async def upload_chunk(
    chunk: UploadFile = File(...),
    file_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    filename: str = Form(...),
    client_id: str = Form(""),
):
    if total_chunks <= 0:
        raise HTTPException(status_code=400, detail="total_chunks must be positive")
    if total_chunks > MAX_TOTAL_CHUNKS:
        raise HTTPException(status_code=413, detail="File exceeds maximum allowed size")
    if chunk_index < 0 or chunk_index >= total_chunks:
        raise HTTPException(status_code=400, detail="chunk_index out of range")

    safe_name = sanitize_filename(filename)
    if not is_allowed_file(safe_name):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    if file_id in merged_uploads:
        return {"merged": True, "filename": merged_uploads[file_id]}

    data = await chunk.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty chunk")
    if len(data) > MAX_CHUNK_BYTES:
        raise HTTPException(status_code=413, detail="Chunk too large")

    await run_in_threadpool(save_chunk, CHUNKS_ROOT, file_id, chunk_index, data)

    lock = get_lock(file_id)
    async with lock:
        if file_id in merged_uploads:
            return {"merged": True, "filename": merged_uploads[file_id]}

        received = await run_in_threadpool(list_received_chunks, CHUNKS_ROOT, file_id)
        if len(received) >= total_chunks:
            final_name = await run_in_threadpool(
                merge_chunks,
                CHUNKS_ROOT,
                UPLOAD_DIR,
                file_id,
                total_chunks,
                safe_name,
            )
            merged_uploads[file_id] = final_name
            file_owners[final_name] = client_id
            upload_locks.pop(file_id, None)
            return {"merged": True, "filename": final_name}

        return {"merged": False, "received_chunks": len(received)}


@app.get("/upload-status")
async def upload_status(file_id: str = Query(...)) -> dict[str, object]:
    if file_id in merged_uploads:
        return {"merged": True, "filename": merged_uploads[file_id], "received_chunks": []}

    received = await run_in_threadpool(list_received_chunks, CHUNKS_ROOT, file_id)
    return {"merged": False, "received_chunks": received}


@app.get("/files")
async def list_files(viewer_id: str | None = Query(default=None)) -> dict[str, list[dict[str, object]]]:
    files = []
    for path in UPLOAD_DIR.iterdir():
        if path.is_dir():
            continue
        owner_id = file_owners.get(path.name, "")
        if viewer_id and owner_id and owner_id == viewer_id:
            continue
        stat = path.stat()
        files.append(
            {
                "name": path.name,
                "size": stat.st_size,
                "type": classify_file(path.name),
                "modified_at": stat.st_mtime,
            }
        )
    files.sort(key=lambda item: item["modified_at"], reverse=True)
    return {"files": files}


@app.get("/download/{filename:path}")
async def download_file(filename: str, request: Request):
    safe_name = sanitize_filename(filename)
    file_path = (UPLOAD_DIR / safe_name).resolve()
    if file_path.parent != UPLOAD_DIR.resolve() or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return build_streaming_response(file_path, request, inline=False, delete_on_complete=True)


@app.get("/preview/{filename:path}")
async def preview_file(filename: str, request: Request):
    safe_name = sanitize_filename(filename)
    file_path = (UPLOAD_DIR / safe_name).resolve()
    if file_path.parent != UPLOAD_DIR.resolve() or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return build_streaming_response(file_path, request, inline=True)


@app.delete("/files/{filename:path}")
async def delete_file(filename: str):
    safe_name = sanitize_filename(filename)
    file_path = (UPLOAD_DIR / safe_name).resolve()
    if file_path.parent != UPLOAD_DIR.resolve() or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        file_path.unlink()
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to delete file") from exc
    forget_file(safe_name)
    return JSONResponse({"deleted": True, "filename": safe_name})


@app.delete("/upload-status/{file_id}")
async def clear_upload_cache(file_id: str):
    await run_in_threadpool(cleanup_chunks, CHUNKS_ROOT, file_id)
    merged_uploads.pop(file_id, None)
    upload_locks.pop(file_id, None)
    return {"cleared": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
