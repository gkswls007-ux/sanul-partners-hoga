@echo off
cd /d "%~dp0"
"C:\Users\gkswl\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -m http.server 5173 --bind 127.0.0.1
