# 数海 MathSea 后端

这是数海的 Spring Boot 后端，不依赖旧 Flask 或 SQLite。当前交接入口为 [开发说明](../docs/DEVELOPMENT.md) 和 [部署说明](../deploy/README.md)，含 V1～V10 迁移、内容初审、反馈、回收站与学习进度。

## 技术栈

- Java 21
- Spring Boot 3.5.16
- Spring Security 6（服务器 Session + HttpOnly Cookie）
- Spring Session + Redis
- MyBatis-Plus 3.5.17
- PostgreSQL
- Flyway
- OpenAPI / Swagger（springdoc 2.8.17）

## 目录

```text
src/main/java/cn/mathsea/backend/
├─ auth/       登录、注册、退出、修改密码
├─ user/       用户资料、头像
├─ problem/    题库、详情、标签、收藏/已做
├─ practice/   个人题单、排序、备注
├─ admin/      管理员题目/用户/标签/来源
├─ security/   Spring Security 用户身份
├─ config/     安全、CORS、OpenAPI、静态文件配置
└─ common/     错误、分页、限流、文件存储、健康检查
```

## 1. 准备环境

推荐：

- JDK 21
- Maven 3.9+
- Docker Desktop（用来启动 PostgreSQL 和 Redis）

确认 Java：

```bash
java -version
```

确认 Maven：

```bash
mvn -version
```

## 2. 启动 PostgreSQL 与 Redis

在 `backend/` 目录运行：

```bash
docker compose up -d
```

默认：

- PostgreSQL: `localhost:5432`
- database: `mathsea`
- user: `mathsea`
- password: `mathsea_dev_password`
- Redis: `localhost:6379`

这些只是本地开发值，生产环境必须使用环境变量中的强密码。

## 3. 启动后端

```bash
mvn spring-boot:run
```

第一次启动时 Flyway 自动执行：

```text
src/main/resources/db/migration/V1__init.sql 至 V10__simple_tags_and_feedback.sql
```

它会从零创建 PostgreSQL 表，并预置来源和标签。

健康检查：

```text
GET http://localhost:8080/api/v1/health
```

Swagger：

```text
http://localhost:8080/swagger-ui.html
```

## 4. Vue 本地开发

Vue 默认：

```text
http://localhost:5173
```

后端默认允许这个 Origin，并允许 Cookie credentials。

前端调用 API 时需要：

```ts
fetch('/api/v1/...', {
  credentials: 'include'
})
```

开发时建议让 Vite 把 `/api` 和 `/uploads` 代理到 `http://localhost:8080`，这样浏览器视角是同源请求。

## 5. CSRF：前端登录前必须做什么

本项目使用 Cookie Session，因此所有 POST / PUT / PATCH / DELETE 都有 CSRF 防护。

先请求：

```text
GET /api/v1/auth/csrf
```

返回：

```json
{
  "token": "...",
  "headerName": "X-XSRF-TOKEN"
}
```

同时浏览器得到 `XSRF-TOKEN` Cookie。

后续写请求带：

```text
X-XSRF-TOKEN: <token>
```

并带 Cookie。

Vue 可以在统一 API 客户端中自动处理，而不是每个页面重复写。

## 6. 注册与登录

当前版本没有验证码。

注册：

```text
POST /api/v1/auth/register
```

```json
{
  "username": "test",
  "email": "test@example.com",
  "phone": "",
  "password": "12345678",
  "confirmPassword": "12345678"
}
```

密码数据库中保存 BCrypt 哈希，不保存明文密码，也不存在“解密出原密码”的功能。

登录支持：

- 用户名
- `UID00000001` 形式 UID
- 邮箱

暂不使用未验证手机号登录。

## 7. 创建管理员

系统不会内置默认管理员密码。

先正常注册账号并启动 PostgreSQL，然后在项目根目录使用权限管理程序。目标用户可以使用用户名、UID 或邮箱：

```bat
manage-admin.bat grant UID00000001
manage-admin.bat revoke user@example.com
```

也可以直接调用 PowerShell 脚本：

```powershell
.\backend\scripts\manage-admin.ps1 grant UID00000001
.\backend\scripts\manage-admin.ps1 revoke user@example.com
```

程序会同步增加 `session_version`，使目标用户现有会话失效。被授予或撤销权限的用户需要重新登录。

## 8. Tag 存储方式

当前规范为 10 个大类，名称、别名与学习进度映射见 `src/main/resources/tag-taxonomy.json`。下列关系表结构示例用于解释存储；当前名称以规范文件与 V10 迁移为准。

不再把：

```text
函数,导数,不等式
```

作为一个字符串塞进 `problems`。

数据库使用：

```text
problems
   ↑
problem_tags
   ↓
tags
```

例如：

```text
problems.id = 100

tags:
1 函数
2 导数
3 不等式

problem_tags:
problem_id | tag_id
100        | 1
100        | 2
100        | 3
```

但 API 仍然返回最方便 Vue 使用的数组：

```json
{
  "id": "GC000001",
  "tags": ["函数", "导数", "不等式"]
}
```

多标签筛选使用 AND 语义：

```text
GET /api/v1/problems?tag=函数&tag=导数
```

只返回同时具有“函数”和“导数”的题。

## 9. 题目内容格式

数据库保存原始 Markdown + LaTeX：

```json
{
  "content": "已知 $f(x)=x^2$...",
  "answer": "$x=1$",
  "solution": "由 $$f'(x)=2x$$ 可得...",
  "contentFormat": "markdown-latex-v1"
}
```

后端不会把 LaTeX 渲染成 HTML。Vue 使用 KaTeX / MathJax 渲染。Markdown 渲染器必须关闭或清理原始 HTML，不能把题目正文直接用未过滤的 `v-html` 输出。

## 10. Redis 当前用途

当前 Redis 只用于：

1. Spring Session 登录会话；
2. 登录/注册限流。

没有到处使用 `@Cacheable`，避免开发初期出现“PostgreSQL 已更新但 Redis 还是旧数据”的缓存一致性问题。

## 11. 主要 API

完整列表见 `docs/API.md` 和 Swagger。

核心接口：

```text
GET    /api/v1/auth/csrf
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password

GET    /api/v1/problems
GET    /api/v1/problems/{problemId}
GET    /api/v1/problems/random
GET    /api/v1/problem-catalogs
GET    /api/v1/problem-stats

GET    /api/v1/practice-lists?kind=official
GET    /api/v1/practice-lists?kind=square
GET    /api/v1/practice-lists/{listId}

PATCH  /api/v1/users/me/problem-states/{problemId}
PATCH  /api/v1/users/me/problem-states/batch

GET    /api/v1/users/me/practice-lists
POST   /api/v1/users/me/practice-lists
...

GET    /api/v1/admin/problems
POST   /api/v1/admin/problems
PUT    /api/v1/admin/problems/{problemId}
DELETE /api/v1/admin/problems/{problemId}
```

## 12. 开发测试数据

Flyway 的 `V2__starter_problems.sql` 会自动创建两道起始题；`V3__public_practice_lists.sql`
会扩展公开/官方题单字段，并在首位用户注册时为其创建“官方起步题单”。

如果本地想重复补齐开发数据，可手动执行以下幂等脚本：

```bash
docker compose exec -T postgres psql -U mathsea -d mathsea < src/main/resources/db/dev/seed.sql
```

生产环境不要执行该文件。

## 13. 生产环境必须修改

至少配置：

```text
DB_URL
DB_USER
DB_PASSWORD
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
CORS_ALLOWED_ORIGINS
SESSION_COOKIE_SECURE=true
STORAGE_ROOT
```

正式网站必须使用 HTTPS。

当前本地文件存储适合第一版开发。以后多服务器部署时，把 `LocalFileStorageService` 换成 OSS / S3 对象存储实现即可，业务 API 不需要整体重写。

## 14. 运行基础测试

```bash
mvn test
```

集成测试会启动独立的临时 PostgreSQL 并执行全部迁移；不需要外部数据库或 Redis。首次运行会下载二进制，Linux 应使用非 root 用户。完整应用联调仍需启动 Docker Compose。
