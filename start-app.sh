#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

if [ -x "$BACKEND_DIR/.venv/bin/python" ]; then
  PYTHON_EXE="$BACKEND_DIR/.venv/bin/python"
else
  PYTHON_EXE="python3"
fi

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -Pn >/dev/null 2>&1
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$port" | grep -q ":$port"
  else
    netstat -an 2>/dev/null | grep -E "[.:]$port[[:space:]].*LISTEN" >/dev/null 2>&1
  fi
}

for PORT in 8000 5173; do
  if port_in_use "$PORT"; then
    echo "Port $PORT is already in use. Close old ShareIt processes or stop the process on that port, then retry."
    echo "Tip: use 'lsof -iTCP:$PORT -sTCP:LISTEN' to find the PID, then 'kill <pid>' (or 'kill -9 <pid>') if needed."
    exit 1
  fi
done

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo
  echo "Stopping ShareIt..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(
  cd "$BACKEND_DIR"
  exec "$PYTHON_EXE" -m uvicorn server:app --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  exec npm run dev
) &
FRONTEND_PID=$!

echo "ShareIt started."
echo "  Backend  (PID $BACKEND_PID) on http://localhost:8000"
echo "  Frontend (PID $FRONTEND_PID) on http://localhost:5173"
echo "Press Ctrl+C to stop both."

wait -n "$BACKEND_PID" "$FRONTEND_PID"
