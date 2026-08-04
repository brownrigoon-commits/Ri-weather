@echo off
setlocal
set "TOURIST_PY=%~dp0.venv-tourist\Scripts\python.exe"
if not exist "%TOURIST_PY%" (
  echo Tourist Python is not ready. Run tools\setup_tourist_pc.ps1 first.
  exit /b 1
)
"%TOURIST_PY%" %*
exit /b %ERRORLEVEL%
