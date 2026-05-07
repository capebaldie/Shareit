@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"

if exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
  set "PYTHON_EXE=%BACKEND_DIR%\.venv\Scripts\python.exe"
) else (
  set "PYTHON_EXE=python"
)

for %%P in (8000 5173) do (
  netstat -ano | findstr /R /C:":%%P .*LISTENING" >nul
  if not errorlevel 1 (
    echo Port %%P is already in use. Close old ShareIt terminals or stop the process on that port, then retry.
    echo Tip: use "netstat -ano | findstr :%%P" to find PID and "taskkill /PID <pid> /F" if needed.
    exit /b 1
  )
)

start "ShareIt Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && ""%PYTHON_EXE%"" -m uvicorn server:app --host 0.0.0.0 --port 8000"
start "ShareIt Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

echo ShareIt started.
echo Backend and Frontend are running in two new terminal windows.
echo Close those windows to stop the app.
