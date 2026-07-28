@echo off
cd /d "%~dp0"
"C:\Users\gkswl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" refresh_data.py
"C:\Users\gkswl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" refresh_suwon_data.py
"C:\Users\gkswl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" refresh_daejeon_data.py
pause
