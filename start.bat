@echo off
title Local-Bridge Sunucusu
echo ==================================================
echo [LOCAL-BRIDGE] Sunucu baslatiliyor...
echo ==================================================
node server.js
if %errorlevel% neq 0 (
    echo.
    echo Sunucu baslatilamadi. Lutfen Node.js'in yuklu oldugundan emin olun.
    pause
)
