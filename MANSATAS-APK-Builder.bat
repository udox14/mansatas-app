@echo off
title MANSATAS APK Builder & Provisioner
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\build-apk-gui.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Terjadi kesalahan saat membuka GUI Provisioner.
    pause
)
