@echo off
setlocal enabledelayedexpansion

chcp 65001 >nul

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "SERVER=mathsea-server"
set "SITE_HOST=mathverse.com.cn"

echo ========================================
echo MathSea 自动部署
echo ========================================

echo.
echo [1/6] 构建后端...
cd /d "%BACKEND%"

set "BACKEND_BUILD_OK="
for /L %%I in (1,1,3) do (
    call mvn clean package -DskipTests
    if not errorlevel 1 (
        set "BACKEND_BUILD_OK=1"
        goto backend_build_done
    )

    if %%I LSS 3 (
        echo.
        echo 后端构建失败，可能有文件被临时占用，2 秒后重试（%%I/3）...
        timeout /t 2 /nobreak >nul
    )
)

:backend_build_done
if not defined BACKEND_BUILD_OK (
    echo.
    echo 后端连续构建 3 次失败，部署终止。
    echo 如果仍提示 Failed to delete，请关闭正在运行的后端、测试任务或占用 target 文件的编辑器后重试。
    pause
    exit /b 1
)

echo.
echo 查找后端 JAR...

set "JAR="

for %%F in ("%BACKEND%\target\*.jar") do (
    echo %%~nxF | findstr /I /V "\.original$" >nul
    if not errorlevel 1 (
        set "JAR=%%F"
    )
)

if not defined JAR (
    echo 未找到可部署的 JAR。
    pause
    exit /b 1
)

echo 找到:
echo !JAR!

copy /Y "!JAR!" "%BACKEND%\app.jar" >nul

if errorlevel 1 (
    echo app.jar 创建失败。
    pause
    exit /b 1
)

echo.
echo [2/6] 构建前端...
cd /d "%FRONTEND%"
call npm run build
if errorlevel 1 (
    echo.
    echo 前端构建失败，部署终止。
    pause
    exit /b 1
)

if not exist "%FRONTEND%\dist\index.html" (
    echo.
    echo 未找到 frontend\dist\index.html
    pause
    exit /b 1
)

echo.
echo [3/6] 上传后端 app.jar...
scp "%BACKEND%\app.jar" %SERVER%:/srv/mathsea/backend/app.jar
if errorlevel 1 (
    echo.
    echo 后端上传失败。
    pause
    exit /b 1
)

echo.
echo [4/6] 上传前端 dist...

ssh %SERVER% "rm -rf /srv/mathsea/frontend/dist && mkdir -p /srv/mathsea/frontend/dist"
if errorlevel 1 (
    echo.
    echo 无法准备服务器前端目录。
    pause
    exit /b 1
)

scp -r "%FRONTEND%\dist" %SERVER%:/srv/mathsea/frontend/
if errorlevel 1 (
    echo.
    echo 前端上传失败。
    pause
    exit /b 1
)

echo.
echo [5/6] 发布服务器新版本...

ssh %SERVER% "sudo systemctl restart mathsea-backend.service && NEW_RELEASE=/var/www/mathsea-releases/$(date -u +%%Y%%m%%dT%%H%%M%%SZ) && sudo mkdir -p \"$NEW_RELEASE\" && sudo cp -a /srv/mathsea/frontend/dist/. \"$NEW_RELEASE\"/ && sudo find \"$NEW_RELEASE\" -type d -exec chmod 755 {} \; && sudo find \"$NEW_RELEASE\" -type f -exec chmod 644 {} \; && sudo ln -sfn \"$NEW_RELEASE\" /var/www/mathsea-current && sudo nginx -t && sudo systemctl reload nginx"
if errorlevel 1 (
    echo.
    echo 服务器发布失败。
    pause
    exit /b 1
)

echo.
echo [6/6] 等待后端启动并验证...

ssh %SERVER% "for i in $(seq 1 30); do if curl -fsS http://127.0.0.1:8000/actuator/health > /tmp/mathsea-health.json 2>/dev/null; then echo '=== Backend ==='; cat /tmp/mathsea-health.json; echo; echo '=== Frontend ==='; curl -fsSI --resolve %SITE_HOST%:443:127.0.0.1 https://%SITE_HOST%/ > /tmp/mathsea-frontend-headers.txt 2>/dev/null || { echo 'Frontend health check failed'; exit 1; }; head -1 /tmp/mathsea-frontend-headers.txt; exit 0; fi; echo Waiting for backend... $i/30; sleep 1; done; echo 'Backend failed to become healthy'; sudo systemctl status mathsea-backend.service --no-pager; exit 1"
if errorlevel 1 (
    echo.
    echo 验证失败，请检查服务器日志：
    echo sudo journalctl -u mathsea-backend.service -n 100 --no-pager
    pause
    exit /b 1
)

echo.
echo ========================================
echo MathSea 部署完成
echo ========================================
echo.
echo 网站地址:
echo https://%SITE_HOST%
echo.
echo 本次部署没有清空 PostgreSQL 数据。
echo .env 和 uploads 也没有被修改。
echo.

pause
endlocal
