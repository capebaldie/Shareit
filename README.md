# ShareIt Local File Transfer (FastAPI + React)

Fast, private file sharing between your phone and PC over Wi-Fi. Scan a QR code to pair, then send images, PDFs and videos. No cloud, no cables, no account, and nobody else on the network can see your files.

## Features

- Chunked upload (`1 MB`) with parallel chunk workers
- Resume-friendly uploads via chunk status check
- Cancel an in-flight upload from the queue
- Streaming download with HTTP Range support (video seek/resume)
- Auto-cleanup: a file is removed from `uploads/` after the receiver's first successful Save
- Mobile-first Send/Receive UI
- Drag/drop + picker upload
- Per-file + overall progress
- Local network URL display + QR code
- Pairing token: only devices that scanned the host's QR code can list, send, download or delete files
- Auto-refresh file list
- Delete files
- Light/Dark mode

## Pairing

The server binds `0.0.0.0`, so every device on the Wi-Fi can reach it. A pairing token gates all of
it — listing, upload, download and delete. Without one, a stranger on the same network does not
merely read your files: a completed download deletes the file, so the intended receiver never sees
it arrive.

- The token is printed at startup, and is baked into the QR code as a URL hash, so scanning pairs
  the phone with no typing. Browsers never send a hash to a server, so it stays out of access logs.
- Requests from `127.0.0.1` skip the check. The host owns the files already, and a loopback packet
  cannot come from another device — so the PC's own browser needs no token.
- `<a href>` and `<img src>` cannot carry a custom header, so `/download` and `/preview` also accept
  `?t=<token>`.
- A new token every start, so one that leaks dies with the session. Export `SHAREIT_TOKEN` to pin it
  and stop re-scanning after each restart.

On the PC open `http://localhost:5173`. Anywhere else, use the `#t=` URL the banner prints — a
stale or missing token answers `401` with a message telling you to rescan.

```bash
cd backend && python test_auth.py   # loopback, header, ?t=, and everything rejected
```

### What the token does not cover

- **The QR code is the password.** Anyone who scans or photographs the host screen, or reads the
  startup banner, is paired. Do not show it to people you would not hand your files to.
- **Traffic is plain HTTP.** The token and files are unencrypted on the network. On a trusted home
  Wi-Fi or your own hotspot that is fine; on open or public Wi-Fi someone capturing packets can read
  the token.
- **A paired device stays paired until the server restarts.** Restart to revoke everyone. With
  `SHAREIT_TOKEN` pinned, a leaked token never expires, so change it if it leaks.
- **Anyone using the host PC is trusted** without a token.

## Limits

- Per-file cap: **5 GiB** (rejected with HTTP 413 above the cap).
- Allowed types: `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`, `.mp4`, `.mkv`, `.mov`.

## Project Structure

- `backend/server.py`
- `backend/utils/chunk_handler.py`
- `frontend/src/components/*`
- `frontend/src/hooks/useChunkUpload.ts`
- `frontend/src/utils/chunkUpload.ts`

## Backend Run

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

Backend API will be reachable on local network at:

- `http://<your-local-ip>:8000`

The `uploads/` directory is auto-created at backend startup. Anything left in
`uploads/` from a previous run is wiped on startup (each app session starts
clean). During a session, files are also deleted automatically once a receiver
has finished saving them.

Use no `--reload` during transfer testing because file writes in `uploads/` can trigger restarts.

## Start Both With One Command

From project root:

**Windows:**

```powershell
.\start-app.cmd
```

**Linux / macOS:**

```bash
./start-app.sh
```

This launches:

- Backend (`uvicorn` on port `8000`)
- Frontend (`vite` on port `5173`)

Both launchers fail fast if either port is already in use.

## Frontend Run (Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server:

- `http://<your-local-ip>:5173`

If needed, set custom backend URL:

```bash
# frontend/.env
VITE_API_BASE=http://192.168.x.x:8000
```

## Mobile Access

1. Ensure phone and PC are on the same Wi-Fi or hotspot.
2. Open frontend URL on phone (`http://<pc-ip>:5173`) or scan QR from app.
3. Upload on **Send Files** tab from phone.
4. Save the file from the **Receive Files** tab on the other device. The
   first successful Save consumes the file — it disappears from the list
   afterwards.

## If Mobile Access Fails Intermittently

- This app now prefers the best LAN IP (instead of arbitrary adapter order), which helps when VPN/virtual adapters exist.
- Frontend dev server now uses `--strictPort`, so it will fail fast if `5173` is already occupied (instead of silently changing port).
- If startup shows port-in-use, close old terminals/processes on `5173` or `8000` and start again. No reboot should be required.

## API Endpoints

- `POST /upload-chunk` (multipart form: `chunk`, `file_id`, `chunk_index`, `total_chunks`, `filename`, optional `client_id`). Rejects with 413 if `total_chunks * 1 MiB` exceeds the 5 GiB cap.
- `GET /upload-status?file_id=...`
- `GET /files` (optional query: `viewer_id` to hide self-uploaded files for that device)
- `GET /download/{filename}` — full GET (no `Range` header) auto-deletes the file from `uploads/` after a successful response.
- `GET /preview/{filename}` — same streaming, never deletes; supports `Range` for video seek.
- `DELETE /files/{filename}`
- `GET /local-info`
