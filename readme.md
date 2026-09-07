可以，下面这份你可以直接放进项目根目录当 `DEPLOY_LOCAL.md` 使用。

# MathSea 本地部署文档

适用于当前新版架构：

```text
Frontend: Vue 3 + TypeScript + Vite
Backend: Spring Boot + Java 21
Database: PostgreSQL
Cache/Session: Redis
Container: Docker Desktop
Build tools: Maven + npm
```

项目目录建议：

```text
gaokao-math-platform/
├─ frontend/
├─ backend/
├─ start-all.bat
├─ stop-all.bat
└─ README.md
```

---

## 1. 本地环境要求

Windows 电脑需要安装：

```text
Java 21
Maven 3.9+
Node.js LTS
npm
Docker Desktop
Git
VS Code（推荐）
```

安装完成后，在 PowerShell 或 VS Code 终端检查：

```powershell
java -version
```

应看到 Java 21，例如：

```text
java version "21.0.8"
```

检查 Maven：

```powershell
mvn -version
```

应看到：

```text
Apache Maven 3.9.x
Java version: 21...
```

检查 Node：

```powershell
node -v
```

检查 npm：

```powershell
npm -v
```

检查 Docker：

```powershell
docker --version
```

检查 Docker Compose：

```powershell
docker compose version
```

检查 Git：

```powershell
git --version
```

这些命令全部正常后再继续。

---

# 2. 下载项目

进入你希望存放项目的位置，例如：

```powershell
cd "C:\Users\你的用户名\Desktop"
```

然后：

```powershell
git clone <你的GitHub仓库地址>
```

进入项目：

```powershell
cd gaokao-math-platform
```

如果项目使用特定分支，例如：

```powershell
git switch backends
```

具体以实际开发分支为准。

---

# 3. 检查项目目录

正常应该能看到：

```text
gaokao-math-platform/
├─ frontend/
│  ├─ src/
│  ├─ package.json
│  └─ vite.config.ts
│
└─ backend/
   ├─ src/
   ├─ pom.xml
   └─ docker-compose.yml
```

检查后端：

```powershell
dir backend
```

确保存在：

```text
pom.xml
docker-compose.yml
src
```

检查前端：

```powershell
dir frontend
```

确保存在：

```text
package.json
src
vite.config.ts
```

---

# 4. 启动 Docker Desktop

启动 Windows 中的：

```text
Docker Desktop
```

等待 Docker Engine 完成启动。

检查：

```powershell
docker info
```

如果能显示 `Server` 信息，说明 Docker 正常。

如果报：

```text
failed to connect to the docker API
```

说明 Docker Desktop 后台引擎没有启动完成。

---

# 5. 启动 PostgreSQL 和 Redis

进入后端目录：

```powershell
cd backend
```

执行：

```powershell
docker compose up -d
```

第一次运行会下载 PostgreSQL 和 Redis 镜像，需要等待一段时间。

查看状态：

```powershell
docker compose ps
```

正常应看到类似：

```text
postgres    Up
redis       Up
```

测试 Redis：

```powershell
docker compose exec redis redis-cli ping
```

正常返回：

```text
PONG
```

---

# 6. 数据库说明

当前开发环境由 Docker 自动启动 PostgreSQL。

默认连接信息以 `backend/docker-compose.yml` 和 `application.yml` 为准。

当前开发配置通常类似：

```text
Host: localhost
Port: 5432
Database: mathsea
Username: mathsea
Password: mathsea_dev_password
```

Spring Boot 启动以后，Flyway 会自动执行：

```text
backend/src/main/resources/db/migration/
```

里面的数据库迁移文件，例如：

```text
V1__init.sql
```

因此第一次启动通常不需要手动创建数据库表。

---

# 7. 编译后端

在：

```text
backend/
```

目录运行：

```powershell
mvn clean compile
```

第一次运行 Maven 会下载依赖。

成功后应看到：

```text
BUILD SUCCESS
```

如果失败，从第一个：

```text
[ERROR]
```

开始检查错误。

---

# 8. 启动 Spring Boot 后端

在 `backend` 目录：

```powershell
mvn spring-boot:run
```

启动成功后通常看到：

```text
Started MathSeaApplication
```

以及：

```text
Tomcat started on port 8080
```

后端地址：

```text
http://localhost:8080
```

健康检查：

```text
http://localhost:8080/api/v1/health
```

Swagger：

```text
http://localhost:8080/swagger-ui.html
```

---

# 9. 安装前端依赖

另开一个终端。

从项目根目录进入：

```powershell
cd frontend
```

第一次运行：

```powershell
npm install
```

会根据：

```text
package.json
```

安装所有前端依赖。

依赖会放到：

```text
frontend/node_modules/
```

这个目录不要提交到 GitHub。

---

# 10. 启动 Vue 前端

在：

```text
frontend/
```

目录运行：

```powershell
npm run dev
```

成功后 Vite 一般会显示：

```text
Local: http://localhost:5173/
```

浏览器打开：

```text
http://localhost:5173
```

---

# 11. 前后端通信

开发环境下前端建议通过 Vite Proxy 调用后端。

`frontend/vite.config.ts` 示例：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],

  server: {
    port: 5173,

    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
```

前端请求不要写：

```ts
fetch('http://localhost:8080/api/v1/problems')
```

而写：

```ts
fetch('/api/v1/problems')
```

调用流程：

```text
浏览器
   ↓
Vue :5173
   ↓
/api/v1/...
   ↓
Vite Proxy
   ↓
Spring Boot :8080
```

---

# 12. 登录 Session

当前后端使用：

```text
Spring Security
Spring Session
Redis
HttpOnly Cookie
```

如果使用 `fetch`：

```ts
fetch('/api/v1/auth/me', {
  credentials: 'include'
})
```

如果使用 Axios：

```ts
import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true
})
```

然后：

```ts
api.get('/problems')
```

---

# 13. 创建管理员

先保证 PostgreSQL 正在运行：

```powershell
cd backend
docker compose up -d
```

用户先通过网站正常注册账号。

然后在 `backend` 目录执行：

```powershell
.\manage-admin.bat grant 用户名
```

例如：

```powershell
.\manage-admin.bat grant Forever_Xor_Rewrite
```

也支持 UID：

```powershell
.\manage-admin.bat grant UID00000001
```

或者邮箱：

```powershell
.\manage-admin.bat grant user@example.com
```

撤销管理员：

```powershell
.\manage-admin.bat revoke Forever_Xor_Rewrite
```

权限修改后用户需要重新登录。

---

# 14. 日常启动流程

以后每天开发通常只需要三个终端。

终端 1：

```powershell
cd backend
docker compose up -d
```

终端 2：

```powershell
cd backend
mvn spring-boot:run
```

终端 3：

```powershell
cd frontend
npm run dev
```

然后访问：

```text
前端
http://localhost:5173

后端
http://localhost:8080

Swagger
http://localhost:8080/swagger-ui.html
```

---

# 15. 一键启动

项目根目录可以放：

```text
start-all.bat
```

内容：

```bat
@echo off
chcp 65001 >nul
title MathSea Launcher

echo ==============================
echo        MathSea 启动器
echo ==============================

echo.
echo [1/3] 启动 PostgreSQL 和 Redis...

cd /d "%~dp0backend"

docker compose up -d

if errorlevel 1 (
    echo.
    echo Docker 启动失败。
    echo 请确认 Docker Desktop 已启动。
    pause
    exit /b 1
)

echo.
echo [2/3] 启动 Spring Boot...

start "MathSea Backend" cmd /k ^
"cd /d "%~dp0backend" && mvn spring-boot:run"

echo.
echo [3/3] 启动 Vue...

start "MathSea Frontend" cmd /k ^
"cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==============================
echo 前端: http://localhost:5173
echo 后端: http://localhost:8080
echo Swagger: http://localhost:8080/swagger-ui.html
echo ==============================

timeout /t 5 >nul

start http://localhost:5173

exit
```

以后双击：

```text
start-all.bat
```

即可。

---

# 16. 停止项目

Vue：

在前端终端：

```text
Ctrl + C
```

Spring Boot：

在后端终端：

```text
Ctrl + C
```

PostgreSQL 和 Redis：

```powershell
cd backend
docker compose down
```

注意：

```powershell
docker compose down
```

正常不会删除 PostgreSQL 数据。

但是：

```powershell
docker compose down -v
```

会删除 Docker Volume。

这通常意味着：

> 数据库数据也会一起删除。

开发时不要随便执行 `-v`。

---

# 17. 更新 GitHub 代码以后

团队成员以后拉取新代码：

```powershell
git pull
```

如果后端 `pom.xml` 有变化：

```powershell
cd backend
mvn clean compile
```

如果前端 `package.json` 有变化：

```powershell
cd frontend
npm install
```

如果数据库新增 Flyway migration：

重新启动 Spring Boot：

```powershell
mvn spring-boot:run
```

Flyway 会自动执行尚未执行的 migration。

---

# 18. 常见问题

### `java` 找不到

检查：

```powershell
where.exe java
java -version
```

应该优先找到 JDK 21：

```text
...\jdk-21\bin\java.exe
```

### `mvn` 找不到

检查：

```powershell
where.exe mvn
mvn -version
```

环境变量应该包含：

```text
MAVEN_HOME
```

以及：

```text
%MAVEN_HOME%\bin
```

### `npm` 找不到

检查：

```powershell
where.exe node
where.exe npm
```

通常 Path 需要：

```text
C:\Program Files\nodejs\
```

### Docker 无法连接

检查：

```powershell
docker info
```

并确认 Docker Desktop 正在运行。

### PostgreSQL 5432 被占用

```powershell
netstat -ano | findstr :5432
```

### Redis 6379 被占用

```powershell
netstat -ano | findstr :6379
```

### Spring Boot 8080 被占用

```powershell
netstat -ano | findstr :8080
```

### Vue 5173 被占用

Vite 通常会自动切到 5174 等其他端口。

---

# 19. 新电脑最短部署流程

环境全部安装完成以后，真正需要执行的核心命令只有：

```powershell
git clone <仓库地址>
cd gaokao-math-platform
```

后端：

```powershell
cd backend
docker compose up -d
mvn spring-boot:run
```

另一个终端：

```powershell
cd frontend
npm install
npm run dev
```

浏览器：

```text
http://localhost:5173
```

这样就完成了一台新电脑上的 MathSea 本地开发环境部署。
