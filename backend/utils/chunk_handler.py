import hashlib
import os
import shutil
from pathlib import Path

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
    ".mp4",
    ".mkv",
    ".mov",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov"}
PDF_EXTENSIONS = {".pdf"}


def ensure_directories(upload_dir: Path) -> Path:
    upload_dir.mkdir(parents=True, exist_ok=True)
    chunks_dir = upload_dir / ".chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    return chunks_dir


def sanitize_filename(filename: str) -> str:
    return Path(filename).name


def is_allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def classify_file(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension in IMAGE_EXTENSIONS:
        return "image"
    if extension in PDF_EXTENSIONS:
        return "pdf"
    if extension in VIDEO_EXTENSIONS:
        return "video"
    return "other"


def _safe_id(file_id: str) -> str:
    return hashlib.sha256(file_id.encode("utf-8")).hexdigest()


def reserve_unique_path(upload_dir: Path, filename: str) -> tuple[Path, str]:
    safe_name = sanitize_filename(filename)
    stem = Path(safe_name).stem
    suffix = Path(safe_name).suffix
    candidate = safe_name
    counter = 0
    while True:
        candidate_path = upload_dir / candidate
        try:
            fd = os.open(
                str(candidate_path),
                os.O_CREAT | os.O_EXCL | os.O_WRONLY,
                0o644,
            )
            os.close(fd)
            return candidate_path, candidate
        except FileExistsError:
            counter += 1
            candidate = f"{stem} ({counter}){suffix}"


def chunk_dir(chunks_root: Path, file_id: str) -> Path:
    return chunks_root / _safe_id(file_id)


def chunk_path(chunks_root: Path, file_id: str, chunk_index: int) -> Path:
    return chunk_dir(chunks_root, file_id) / f"chunk_{chunk_index}.part"


def save_chunk(chunks_root: Path, file_id: str, chunk_index: int, data: bytes) -> None:
    target_dir = chunk_dir(chunks_root, file_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    chunk_file = chunk_path(chunks_root, file_id, chunk_index)
    with chunk_file.open("wb") as file_obj:
        file_obj.write(data)


def list_received_chunks(chunks_root: Path, file_id: str) -> list[int]:
    target_dir = chunk_dir(chunks_root, file_id)
    if not target_dir.exists():
        return []

    chunks: list[int] = []
    for part in target_dir.glob("chunk_*.part"):
        try:
            index = int(part.stem.split("_")[1])
            chunks.append(index)
        except (IndexError, ValueError):
            continue
    return sorted(chunks)


def merge_chunks(
    chunks_root: Path,
    upload_dir: Path,
    file_id: str,
    total_chunks: int,
    filename: str,
) -> str:
    final_path, final_name = reserve_unique_path(upload_dir, filename)

    try:
        with final_path.open("wb") as merged_file:
            for chunk_index in range(total_chunks):
                part_path = chunk_path(chunks_root, file_id, chunk_index)
                if not part_path.exists():
                    raise FileNotFoundError(f"Missing chunk {chunk_index} for {file_id}")
                with part_path.open("rb") as part_file:
                    shutil.copyfileobj(part_file, merged_file, length=1024 * 1024)
    except BaseException:
        final_path.unlink(missing_ok=True)
        raise

    cleanup_chunks(chunks_root, file_id)
    return final_name


def cleanup_chunks(chunks_root: Path, file_id: str) -> None:
    target_dir = chunk_dir(chunks_root, file_id)
    if target_dir.exists():
        shutil.rmtree(target_dir, ignore_errors=True)

