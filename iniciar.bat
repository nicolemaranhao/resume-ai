@echo off
REM Resume AI - abre o backend e o frontend em duas janelas e o site no navegador
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" goto falta_instalar
if not exist "frontend\node_modules" goto falta_instalar

start "Resume AI - backend" cmd /k ".venv\Scripts\python.exe main.py"
start "Resume AI - frontend" cmd /k "cd /d frontend && npm run dev"

echo Abrindo http://localhost:5173 em alguns segundos...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"
exit /b 0

:falta_instalar
echo Rode primeiro o instalar.bat (duplo clique nele).
pause
exit /b 1
