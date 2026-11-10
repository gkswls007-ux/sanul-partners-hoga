@echo off
cd /d "%~dp0"
"C:\Users\gkswl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" refresh_data.py
"C:\Users\gkswl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" refresh_sejong_other2.py
pause
