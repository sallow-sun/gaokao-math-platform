# MathVerse 独立试卷切分服务

网站源码已接入：管理员 → 题目工作台 → **试卷切分**。
本模块不连接题库数据库，也没有发布权限。停用本服务不影响原有题库、MD 导入、审核和发布。
2026-09-15 已发布至 mathverse.com.cn：网站前后端与独立服务均已启动。当前服务器未配置百炼 Key / Workspace ID，上传、切分与裁片下载可用，付费 OCR 暂未启用。下文保留复现部署与回滚步骤。

## 操作流程

1. 新建任务，上传 PDF / DOC / DOCX / PNG / JPG。单文件最多 10MB；一个任务一套试卷，最多 80 页。答案文件可追加到同一任务。
2. 检查分栏建议；添加、删除或拖动竖线。在每栏添加/拖动横线，虚线仅为空白位置建议，不代表已经识别出题目。
3. 单独切出页眉、页码、答题空白并选择“跳过”。按先栏后行编号；跨栏、跨页续题设置相同题号。答案页使用原题号并选“答案”或“解析”。不要把不同试卷的相同题号放进同一任务。
4. 保存，打开高清裁片核对上下边界、选项和配图。边界坐标按 0–1000 归一化，裁片直接来自原始分辨率，预览线不会画进图片。
5. 小样本先选“当前题目”，每批题数 1、本次请求上限 1。勾选确认切分和允许付费后才发请求。免费切分、下载裁片不需要模型密钥。
6. 对照原文改正识别结果，确认题型。数学公式即时预览；没有提供原文的答案/解析必须留空，不让模型自行解题。TAG、章节、难度未知时留空，交由原有审核流程处理。
7. 下载每题一个规则 1.4 MD 和同目录图片；或点击“送往批量导入”，在原页面确认试卷归属，再点击“确认导入草稿”。仍需原有人工审核，绝不自动公开。

首版是**人工确认边界的辅助工具**，不是任何版式都能全自动分题。倾斜照片先纠正方向；跨栏图、题组共用材料需要人工确认合并关系；Word 转 PDF 后要检查公式和字体。模型提取的题图范围也需对照核验，不能把通过格式校验等同于内容准确。

## 独立性与安全

- 新代码：`document-worker/`、Vue `components/document-import/`、`utils/documentLayout*`、Java `documentimport/`。
- 原有 `EditorialWorkbench.vue` 只新增三行：导入组件、标签按钮、组件挂载/文件交接。没有改原有导入/发布服务、数据库迁移、鉴权配置或 C++/PowerShell OCR。
- 前端仍通过同源 `/api/v1/admin/document-import`；Java 沿用管理员会话和 CSRF，额外核对管理员角色。服务身份从会话取得，不接受浏览器指定用户 ID。
- Python 只监听 `127.0.0.1:8091`，校验共享令牌并按用户隔离任务。不要将 8091 暴露公网；不要在前端配置模型 Key。
- 渲染/裁剪使用独立的单线程子进程。原因见 [PyMuPDF 并发说明](https://pymupdf.readthedocs.io/en/latest/recipes-multiprocessing.html)。部署前核对依赖的开源许可证与网站使用方式，包括 [PyMuPDF 许可](https://pymupdf.readthedocs.io/en/latest/about.html)。
- 生产运行独立低权限账号，限制内存；无需题库数据库口令或网站上传目录权限。Word 使用独立 LibreOffice 配置目录。

## 成本与失败处理

- 默认未勾选在线识别，每次预算默认 **1 请求**，每批默认 3 题（1–4 可选），每请求最多 16 个片段、输出最多 12000 Token。
- 先计算所需请求数；超预算整次拒绝，不会先消费几次再提示不足。调用次数在发出请求前记账，包括网络超时、无法判断计费的请求。
- 切分坐标/题号/内容段/题型/模型版本共同构成缓存键。再次识别只处理未缓存题目；改动某条边界只影响相关题目。手工改正文不消耗调用。
- 不自动重试。成功批次立即落盘，失败停止；重启将运行中任务标记“中断”，不会重放付费请求。
- 保存 Token 用量和原始请求/响应。次数上限不是人民币上限；实际费用以供应商账单为准，少量小图请求不保证比整页请求便宜。
- 测试全程本地模拟 OCR，真实调用数为 **0**。模型采用已有项目使用的 `qwen3.8-flash` 工作空间接入，尚未在新链路执行付费质量验收。

## 本地启动

Python **3.10+**，依赖版本固定；本机已验证 Python 3.14，服务器已验证 Python 3.10。Python 3.10/3.11 使用 NumPy 2.2.6，3.12+ 使用 2.5.0，避免升级服务器系统 Python。Word 另外需要 LibreOffice Writer/Math 与中文字体，PDF 和图片不需要它。

```powershell
cd C:\Users\qilai\Desktop\gaokao-math-platform-fresh\document-worker
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:DOCUMENT_WORKER_TOKEN = '<新生成的至少32位随机令牌>'
$env:DOCUMENT_DATA_DIR = "$PWD\data"
# 如需 Word，安装 LibreOffice 后设置实际路径：
$env:LIBREOFFICE_BIN = 'C:\Program Files\LibreOffice\program\soffice.exe'
.\.venv\Scripts\python.exe worker.py
```

令牌可用 `python -c "import secrets; print(secrets.token_urlsafe(48))"` 生成。在启动网站 Java 的终端设置同一个 `DOCUMENT_WORKER_TOKEN` 及 `DOCUMENT_WORKER_URL=http://127.0.0.1:8091`，再按网站 [开发文档](../docs/DEVELOPMENT.md) 启动前后端。不要将此令牌提交 Git。

只有需要付费小样本时，才给 **Python 服务进程**设置 `DASHSCOPE_API_KEY`、`DASHSCOPE_WORKSPACE_ID` 并重启服务。此服务和 Spring Boot 都不会自动加载本目录 `.env.example`。

## 生产接入与回滚

交付包含两个独立包：网站原有发布包（前端＋Java），以及本目录 `python package-release.py` 生成的工作服务包。后者不含任何环境文件、任务数据或密钥。

由有部署权限的运维按以下顺序操作，先在预发布验证：

1. 安装 Python 3.10+、LibreOffice Writer/Math（若接收 Word）和所需中文/数学字体；核对服务器资源余量与许可证。建议先只给内部管理员开放。Ubuntu 已配置服务器可使用独立的 `deploy/install-document-worker.sh`，该脚本只安装新服务并准备后端连接变量，不重启网站、不改题库。
2. 建独立系统账号 `mathsea-document`。服务代码/虚拟环境放 `/srv/mathsea/document-worker`，由 root 管理、服务账号只读；任务目录 `/srv/mathsea/document-data` 由服务账号可写，权限 0700。不要复用网站题库目录。
3. 解压独立包到上述代码目录，用 `sha256sum -c SHA256SUMS` 核验。创建 `.venv` 并安装 `requirements.txt`。
4. 创建 `/etc/mathsea/document-worker.env`（root 所有、权限 0600），参考 `.env.example` 配置随机令牌、数据目录与 LibreOffice 路径，初次保持模型 Key 为空。
5. 安装本目录 systemd 单元，核对路径后启动 `mathsea-document-worker.service`。先从本机校验带共享令牌及 `X-Document-Owner` 的 `/health`。不新增 Nginx 公网代理。
6. **仅追加**网站现有后端环境中的 `DOCUMENT_WORKER_URL` 和同一 `DOCUMENT_WORKER_TOKEN`，保留所有既有配置；按 [现有发布流程](../deploy/README.md) 备份并发布已构建的 Java 与前端。新功能本身没有数据库迁移。
7. 管理员上传一页、切线、保存、刷新恢复并下载裁片。这一轮应显示累计请求 0。本机与服务器已用包含中文、分式和上标的真实 DOCX 验证转换；复杂原卷仍需核对字体和公式排版。
8. 如需模型质量验收，再配置 Key，由操作人明确使用 1 次请求预算试识别，核对所有公式、选项及图；进入草稿后继续原有审核。

回滚新功能可停止独立服务并移除后端新增连接配置；原有功能保持可用。若要隐藏入口，回滚网站本次前后端发布产物。保留文档数据目录，不自动删除任务，不回滚数据库或覆盖已导入草稿。

原稿、裁片、模型原始请求可能含敏感资料；任务目录不公开。首版不自动清理、不去重上传，管理员应按站点留存政策另行安排备份/清理，并监控磁盘容量。不要把单进程服务扩成多个共享数据目录的实例。

## 离线回归

```powershell
# 当前目录 document-worker
python -m unittest -v test_worker
# 已安装 LibreOffice 时执行真实 Word 测试
python -m unittest -v test_real_word
# 网站 frontend 目录
npm test
$env:CHROME_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node tests/document-import.browser.test.cjs
npm run test:browser
npm run build
# 网站 backend 目录，使用 Java 21 与 Maven
mvn verify
```

Python：PDF/追加页面、精确裁剪、权限与版本、预算、缓存、部分失败、拒绝补写答案、题图与手工修订、服务重启保护、Word 缺失依赖提示。测试层禁止真实模型调用。

新浏览器测试挂载实际题目工作台，验证画线/拖线、保存、公式修改、交给原有导入流程、只创建草稿和移动端布局。Java 测试验证代理身份/权限/不重试；跨语言固定样例同时由 Python 真实导出和网站原有 MD 解析器校验。

## 2026-09-15 上线记录

- 网站发布目录：`/var/www/mathsea-releases/editorial-20260914T160618Z`（目录时间为 UTC）。
- 网站旧版本、数据库、配图备份：`/srv/mathsea/backups/editorial-20260914T160618Z`。
- 新服务安装前环境备份：`/srv/mathsea/backups/document-install-20260914T160137Z`。
- 独立服务使用低权限账号，内存硬上限 640MB、CPU 配额 75%；模型密钥不写入 Java、前端或 Git。
- 服务器 Python 15 项测试通过；实际 systemd 服务的 Word 上传、切分保存/恢复、裁片 ZIP 下载、预算 0 拦截均通过。保留一个专用 owner=0 的合成测试任务，不写入题库或审核队列。
- 新功能上线不新增数据库迁移。付费 API 调用数 0；没有对真实题目执行导入或发布。
- 原有自动化流程保持不变；新增独立 GitHub workflow 验证 Python、LibreOffice 与新工作台浏览器操作。

启用识别时，在服务器 `/etc/mathsea/document-worker.env` 中填写 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_WORKSPACE_ID`，保持文件 root 所有、权限 0600，然后执行 `sudo systemctl restart mathsea-document-worker`。不要在聊天或 GitHub 中发送密钥。重启后网页“刷新连接”应显示识别已配置；仍需明确勾选并限制 1 次请求后才会付费。
