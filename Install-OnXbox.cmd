@echo off
REM One-click launcher: double-click this on Windows to install on your Xbox.
setlocal
set /p XBOXIP=Enter Xbox IP (from Dev Home): 
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-OnXbox.ps1" -XboxIP %XBOXIP%
pause
