@echo off
REM Resume AI - instalacao (rode uma vez, ou quando atualizar o projeto)
cd /d "%~dp0"
echo.
echo ===== Resume AI: instalacao =====
echo.

where python >nul 2>nul
if errorlevel 1 goto sem_python
where node >nul 2>nul
if errorlevel 1 goto sem_node
where ffmpeg >nul 2>nul
if errorlevel 1 echo [AVISO] FFmpeg nao encontrado. Rode "winget install ffmpeg" e abra um terminal novo.

if not exist ".venv\Scripts\python.exe" (
  echo Criando ambiente virtual .venv ...
  python -m venv .venv
)

echo.
echo Instalando dependencias do backend - pode demorar na primeira vez ...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
".venv\Scripts\python.exe" -m pip install -U yt-dlp

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo.
  echo [IMPORTANTE] Criei o arquivo .env. Abra-o e cole sua GEMINI_API_KEY.
)

echo.
echo Instalando dependencias do frontend ...
pushd frontend
call npm install
popd

echo.
".venv\Scripts\python.exe" main.py --verificar
pause
exit /b 0

:sem_python
echo [X] Python nao encontrado. Instale em https://www.python.org/downloads/
echo     Marque a opcao "Add python.exe to PATH" na instalacao.
pause
exit /b 1

:sem_node
echo [X] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org
pause
exit /b 1
