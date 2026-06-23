@echo off
title Local-Bridge Sunucusu
echo [LOCAL-BRIDGE] Sunucu baslatiliyor (Executable)...
echo ==================================================
local-bridge.exe
if %errorlevel% neq 0 (
    echo.
    echo Sunucu baslatilamadi. Lutfen local-bridge.exe dosyasinin mevcut oldugundan emin olun.
    pause
)
