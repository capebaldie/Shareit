# ShareIt Local File Transfer (FastAPI + React)

High-performance LAN file sharing app for images, PDFs, and videos between phone and PC.

## Features

- Chunked upload (`1 MB`) with parallel chunk workers
- Resume-friendly uploads via chunk status check
- Streaming download with HTTP Range support (video seek/resume)
- Inline preview for image, PDF, and video
- Mobile-first Send/Receive UI
- Drag/drop + picker upload
- Per-file + overall progress
- Local network URL display + QR code
- Auto-refresh file list
- Delete files
- Light/Dark mode
  `

## Project Structure

- `backend/server.py`
- `backend/utils/chunk_handler.py`
- `frontend/src/components/*`
- `frontend/src/hooks/useChunkUpload.js`
- `frontend/src/utils/chunkUpload.js`

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

The `uploads/` directory is auto-created at backend startup.
Use no `--reload` during transfer testing because file writes in `uploads/` can trigger restarts.

## Start Both With One Command (Windows)

From project root:

```powershell
.\start app
# or
.\start-app.cmd
```

This opens two terminals:

- Backend (`uvicorn` on port `8000`)
- Frontend (`vite` on port `5173`)

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
4. Download/preview from **Receive Files** tab on either device.

## If Mobile Access Fails Intermittently

- This app now prefers the best LAN IP (instead of arbitrary adapter order), which helps when VPN/virtual adapters exist.
- Frontend dev server now uses `--strictPort`, so it will fail fast if `5173` is already occupied (instead of silently changing port).
- If startup shows port-in-use, close old terminals/processes on `5173` or `8000` and start again. No reboot should be required.

## API Endpoints

- `POST /upload-chunk` (multipart form: `chunk`, `file_id`, `chunk_index`, `total_chunks`, `filename`, optional `client_id`)
- `GET /upload-status?file_id=...`
- `GET /files` (optional query: `viewer_id` to hide self-uploaded files for that device)
- `GET /download/{filename}`
- `GET /preview/{filename}`
- `DELETE /files/{filename}`
- `GET /local-info`
