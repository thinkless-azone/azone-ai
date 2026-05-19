@echo off
REM Обход блокировки npm.ps1 в PowerShell (ExecutionPolicy). Использование: npm-win.cmd install | run dev | ...
cd /d "%~dp0"
npm.cmd %*
