@echo off
title Local-Bridge Baslatici
cd /d "C:\Users\ASUS\AppData\Local\agy\bin\local-bridge"

:: Check if port 3000 is already in use
netstat -ano | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo [Local-Bridge] Sunucu zaten arka planda calisiyor...
) else (
    echo [Local-Bridge] Sunucu baslatiliyor...
    start "Local-Bridge Sunucusu" cmd /k "node server.js"
    :: Give the server 2 seconds to initialize
    timeout /t 2 /nobreak >nul
)

echo [Local-Bridge] Tarayici aciliyor...
start http://localhost:3000
exit
