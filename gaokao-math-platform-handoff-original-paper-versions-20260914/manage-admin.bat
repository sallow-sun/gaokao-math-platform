@echo off
chcp 65001 >nul
title MathSea Admin Permission Manager

if "%~2"=="" (
    echo 用法：
    echo   manage-admin.bat grant 用户名或UID或邮箱
    echo   manage-admin.bat revoke 用户名或UID或邮箱
    echo.
    echo 示例：
    echo   manage-admin.bat grant UID00000001
    echo   manage-admin.bat revoke user@example.com
    exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\manage-admin.ps1" -Action "%~1" -User "%~2"
exit /b %errorlevel%
