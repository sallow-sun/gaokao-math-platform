@echo off
setlocal
chcp 65001 >nul

set "SERVER=mathsea-server"

echo ========================================
echo MathSea 内测数据重置
echo ========================================
echo.
echo 警告：
echo 该操作会清空 users 及其依赖测试数据，
echo 并重置 users_id_seq，使下一位用户从：
echo UID00000001
echo 开始。
echo.
echo 该操作不可撤销。
echo.

set /p CONFIRM=如果确认继续，请输入 RESET：

if /I not "%CONFIRM%"=="RESET" (
    echo.
    echo 已取消。
    pause
    exit /b 0
)

echo.
echo [1/4] 停止后端服务...

ssh %SERVER% "sudo systemctl stop mathsea-backend.service"

if errorlevel 1 (
    echo.
    echo 停止后端失败，操作终止。
    pause
    exit /b 1
)

echo.
echo [2/4] 重置 PostgreSQL 内测数据...

ssh %SERVER% "sudo -u postgres psql -v ON_ERROR_STOP=1 -d mathsea -c \"BEGIN; LOCK TABLE users IN ACCESS EXCLUSIVE MODE; TRUNCATE TABLE users RESTART IDENTITY CASCADE; ALTER SEQUENCE users_id_seq RESTART WITH 1; COMMIT;\""

if errorlevel 1 (
    echo.
    echo 数据库重置失败！
    echo 尝试重新启动后端...
    ssh %SERVER% "sudo systemctl start mathsea-backend.service"
    pause
    exit /b 1
)

echo.
echo [3/4] 检查 users_id_seq...

ssh %SERVER% "sudo -u postgres psql -d mathsea -c \"SELECT last_value, is_called FROM users_id_seq;\""

if errorlevel 1 (
    echo.
    echo 序列检查失败。
)

echo.
echo [4/4] 重新启动后端...

ssh %SERVER% "sudo systemctl start mathsea-backend.service && sudo systemctl is-active mathsea-backend.service"

if errorlevel 1 (
    echo.
    echo 后端启动失败。
    echo 请登录服务器执行：
    echo sudo journalctl -u mathsea-backend.service -n 100 --no-pager
    pause
    exit /b 1
)

echo.
echo ========================================
echo 内测数据重置完成
echo ========================================
echo.
echo 预期序列状态：
echo last_value = 1
echo is_called  = false
echo.
echo 接下来请注册第一个账号。
echo 第一个账号应为：
echo ADMIN
echo UID00000001
echo.
echo 第二个账号应为：
echo USER
echo UID00000002
echo.

pause
endlocal