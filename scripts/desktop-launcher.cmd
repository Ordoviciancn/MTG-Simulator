@echo off
setlocal
title MTG Tabletop Launcher
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%desktop-launcher.ps1"
if errorlevel 1 (
  echo.
  echo Launcher failed. Please send the error above to Codex.
  pause
)
