@echo off
chcp 65001 >nul
title MathSea Launcher

echo ==============================
echo      MathSea 一键启动
echo ==============================

echo.
echo [1/3] 启动 PostgreSQL 和 Redis...
cd /d "%~dp0backend"
docker compose up -d

if errorlevel 1 (
    echo.
    echo [错误] Docker 启动失败。
    echo 请确认 Docker Desktop 已经运行。
    pause
    exit /b 1
)

echo.
echo [2/3] 启动 Spring Boot 后端...
start "MathSea Backend" cmd /k "cd /d "%~dp0backend" && mvn spring-boot:run"

echo.
echo [3/3] 启动 Vue 前端...
start "MathSea Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==============================
echo 已启动：
echo 前端：http://localhost:5173
echo 后端：http://localhost:8080
echo Swagger：http://localhost:8080/swagger-ui.html
echo ==============================

timeout /t 5 >nul

start http://localhost:5173

exit