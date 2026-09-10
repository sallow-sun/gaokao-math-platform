# 开发交接

## 环境与启动

使用 JDK 21、Maven 3.9+、Node.js 22.18+（22.x）及 npm。PostgreSQL 和 Redis 可通过 Docker Compose 启动。前端是 Vue 3 + JavaScript，不是 TypeScript 项目。

先克隆整个仓库；不要只下载 `frontend/`：前端默认 TAG 目录直接引用 `backend/src/main/resources/tag-taxonomy.json`，与后端共用一份规范。

终端一：

```sh
cd backend
docker compose up -d
mvn spring-boot:run
```

终端二：

```sh
cd frontend
npm ci
npm run dev
```

浏览器打开 `http://localhost:5173`。前端代理 `/api`、`/uploads` 至 `127.0.0.1:8080`。后端健康检查为 `http://localhost:8080/actuator/health`。

本地默认数据库连接与 `backend/docker-compose.yml` 一致。`backend/.env.example` 是配置参考；**Spring Boot 不自动读取 `.env`**，覆盖默认值时请导出对应环境变量或通过运行配置传入。生产环境由 systemd 的 EnvironmentFile 读取。

首次启动会执行 Flyway V1～V11，包括初始题、题目审核、稳定题号、教材目录、修订队列、回收站及 TAG/反馈表。不需要任何 SQLite 文件或生产数据库备份。已执行的迁移不能编辑，后续变更新增 V12、V13 等迁移。

## 本地管理员

在网页注册自己的账号。Windows 可运行根目录 `manage-admin.bat grant 用户名`，随后重新登录。其他系统可在本地数据库执行：

```sh
docker compose exec postgres psql -U mathsea -d mathsea
```

```sql
UPDATE users SET role='ADMIN', session_version=session_version+1
WHERE username='替换为自己的用户名';

-- 本地环境需要负责人权限时，为自己的管理员账号创建工作台权限：
INSERT INTO editorial_permissions(user_id, permission)
SELECT id, 'MANAGER' FROM users WHERE username='替换为自己的用户名' AND role='ADMIN'
ON CONFLICT(user_id) DO UPDATE SET permission='MANAGER';
```

只对自己的开发数据库执行。题目工作台使用独立的 EDITOR / REVIEWER / MANAGER 协作权限；负责人可在“更多 → 协作权限”管理。

## 检查与构建

```sh
cd frontend
npm ci
npx playwright install chromium
npm run lint
npm test
npm run test:browser
npm run build
```

Linux 缺少浏览器系统库时使用 `npx playwright install --with-deps chromium`。也可用 `CHROME_EXECUTABLE` 指定本机 Chrome 路径。浏览器测试自行启动 Vite、模拟 API，不连接生产数据库；自动选择可用的本机端口。截图自动放入忽略的 `.tmp/`。

```sh
cd backend
mvn verify
```

后端集成测试启动临时 PostgreSQL、执行迁移并验证发布/反馈/回收站等业务，不需要外部 PostgreSQL 或 Redis。首次运行会下载测试数据库二进制；Linux 请用普通用户运行，PostgreSQL 不允许 root 启动。Java 8 无法编译此项目。

前端产物为 `frontend/dist/`；后端产物为 `backend/target/mathsea-backend-0.1.0-SNAPSHOT.jar`。它们不提交 Git。GitHub Actions 对分支推送和 PR 执行这些检查。

## 当前实现与入口

| 功能 | 主要位置 |
|---|---|
| 题目上传、内容初审、待修改、修订 | `frontend/src/components/admin/EditorialWorkbench.vue`、后端 `admin/editorial/` |
| 用户反馈及处理 | `FeedbackView.vue`、`FeedbackQueue.vue`、后端 `feedback/` |
| 回收站 | `ProblemRecycleBin.vue`、`ProblemTrashService.java` |
| 10 个规范 TAG、别名、进度映射 | `backend/src/main/resources/tag-taxonomy.json`、`TagTaxonomy.java`、V10 迁移 |
| 学习进度与学期预设 | 前后端 `curriculum/` |
| 筛选、取消过时请求、返回快照 | `useProblemsData.js`、`useProblemsQuery.js`、`problemNavigation.js` |
| TAG 目录缓存 | `frontend/src/services/tagCatalog.js` |
| 安全公式渲染、嵌套小问 | `renderMathText.js`、`MathText.vue`、`math-text.css` |
| 打印与 PDF | `useProblemPrint.js`、`useProblemPdfExport.js` |

TAG 首屏使用同源规范文件或有效本地缓存；挂载时后台更新，60 秒内共用结果，本地目录缓存最多使用一天。修改 TAG 时同步考虑规范 JSON 和新增数据库迁移，不能只编辑前端标签名称。

题库返回快照仅保留在当前标签页内存，最多 200 题、有效期两分钟，不保存个人 viewerState、答案和解析。返回时立即显示并重新查询服务器；新筛选期间旧列表禁止操作并提示更新。公式缓存限制条目数与字符量，并区分行内/独立公式和 HTML/MathML 输出。

初审只需核对内容。多选领取和批量修改已从工作台移除；后端旧批量接口仍保留兼容，不再由当前 UI 调用。打开题目自动占用，保存与发布仍检查版本，防止覆盖其他管理员修改。

“初审”“已发布”提供负责人专用的批量删除选择模式，使用独立的回收站 API，不调用旧 `/bulk`。V11 区分初审草稿删除与公开题目下架，避免恢复公开题目时误恢复已丢弃的修订稿。草稿批量删除校验版本、占用及初审状态，并在一个事务内完成。

## 题目与参考资料

现行规则、模板和操作说明均在 `frontend/public/docs/`，可从网站批量导入页面下载。仓库包含自动化测试样例，不包含生产用户、题目数据库、上传图片备份及本机 `TEST/` 题库。需要联调真实题时，按规则导入自己的 MD/配图目录。

Word 规则生成是可选维护操作，先 `python -m pip install python-docx`，再从根目录执行 `python backend/scripts/build-upload-rules.py`。普通构建无需 Python。

## 提交约定

提交源码、测试、迁移、规范数据与文档；不要提交 `.env`、SSH 密钥、数据库导出、运行上传目录、依赖缓存或构建产物。`.m2/` 曾被旧提交跟踪，本分支仅从当前版本移除，未改写历史。

`frontend-vue/`、根目录历史 SQLite、`TEST/`、反馈 PDF 属于本机参考文件，不是当前构建依赖。旧的全权限 sudoers 和测试服务器初始化脚本不作为生产部署入口。

根目录 `update.bat` 是历史部署脚本，依赖本机 SSH 别名且跳过测试，新开发者请使用 `deploy/README.md` 的流程。`reset-test-data.bat` 会清理数据，仅限自己的开发数据库；日常开发不需要运行。
