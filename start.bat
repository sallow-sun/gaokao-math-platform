@echo off
setlocal
chcp 65001 >nul
title MathSea Launcher

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo ==============================
echo      MathSea 一键启动
echo ==============================

echo.
echo [1/4] 启动 PostgreSQL 和 Redis...
cd /d "%BACKEND%"
docker compose up -d

if errorlevel 1 (
    echo.
    echo [错误] Docker 启动失败。
    echo 请确认 Docker Desktop 已经运行。
    pause
    exit /b 1
)

echo.
echo [2/4] 启动 Spring Boot 后端...
start "MathSea Backend" cmd /k "cd /d ""%BACKEND%"" && mvn spring-boot:run"

echo.
echo [3/4] 等待后端就绪...
set "BACKEND_READY="
for /L %%I in (1,1,120) do (
    curl.exe -fsS http://127.0.0.1:8080/actuator/health >nul 2>&1
    if not errorlevel 1 (
        set "BACKEND_READY=1"
        goto backend_ready
    )
    timeout /t 1 /nobreak >nul
)

:backend_ready
if not defined BACKEND_READY (
    echo.
    echo [错误] 后端在 120 秒内未能正常启动。
    echo 请检查 MathSea Backend 窗口中的错误日志。
    pause
    exit /b 1
)

echo 后端已就绪。

echo.
echo [4/4] 启动 Vue 前端...
start "MathSea Frontend" cmd /k "cd /d ""%FRONTEND%"" && npm run dev"

echo.
echo ==============================
echo 已启动：
echo 前端：http://localhost:5173
echo 后端：http://localhost:8080
echo Swagger：http://localhost:8080/swagger-ui.html
echo ==============================

timeout /t 5 >nul

start http://localhost:5173

endlocal
exit
