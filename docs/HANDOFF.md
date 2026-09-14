# 交接记录 · 2026-09-14

## 分支与上线

- 交接分支：`handoff/original-paper-versions-20260914`，从 `feature/visual-paper-builder` 创建，保留完整项目历史。
- 已部署功能提交：`b9f9ddb979bfba5844618d9dc6af5754372e6e2c`。后续交接文档提交不改变部署产物。
- 网站：https://mathverse.com.cn 。入口：管理后台 → 题目管理 → **原卷整理**。
- 前端版本：`/var/www/mathsea-releases/editorial-20260914T012336Z`。
- 本次备份：`/srv/mathsea/backups/editorial-20260914T012336Z`。
- V17 迁移及原卷内容锁定触发器已生效，后端、PostgreSQL、Redis 健康检查正常。服务器 JAR 与前端首页文件的 SHA256 均与本地发布产物一致。

## 已完成

同批次确认同名的上传目录归入同一原卷；跨批次提示同名候选，保留单独新建选项。既有上传记录无需重新导入即可整理。审核员可设置题序和分值、排除重复项或复用已有题目，核验后发布 v1、v2 等固定快照。旧版内容不随题库变化；公开列表默认显示最新版本，历史版本的收藏与评分独立保留。

主要入口：

| 代码 | 用途 |
| --- | --- |
| `backend/.../paper/OriginalPaperService.java` | 草稿、重复题候选、审核指纹、核验版本发布 |
| `backend/.../paper/SharedPaperService.java` | 公共试卷、版本记录、最新版本筛选 |
| `backend/.../admin/editorial/EditorialService.java` | 上传归属与名称处理 |
| `backend/src/main/resources/db/migration/V17__original_paper_versions.sql` | 原卷草稿、版本关系及内容锁定 |
| `frontend/src/components/admin/OriginalPaperWorkbench.vue` | 原卷整理页面 |
| `frontend/src/views/SharedPaperView.vue` | 原卷标识、版本历史与切换 |

完整操作及边界见 [原卷说明](original-papers.md)。等级功能已在此前上线，规则见 [用户成长](user-growth.md)。

## 检查结果

- `mvn package`：35 项后端测试通过，覆盖复用、核验过期、版本不可修改、权限、题数/分数校验和历史收藏。
- 前端 lint、22 项工具单元测试及生产构建通过。
- 浏览器回归：原卷整理与手机布局、导入审核、共享试卷/打印/收藏/评分、历史版本切换通过。未执行全部历史浏览器套件。
- 线上只读验证：试卷列表和页面正常、无页面脚本错误；未登录访问原卷后台接口返回 401。没有在生产环境创建测试试卷或代替管理员核验真实原卷。

## 后续成员注意

- 从本分支开始工作，环境与启动命令见根目录 [README](../readme.md) 和 [开发说明](DEVELOPMENT.md)。不要编辑已执行的 V1～V17，新迁移从 V18 开始。
- 查重目前是同题型文本规则提示，不能覆盖所有 OCR 误差、改编题或图片重复；复用需要人工确认。被复用的上传草稿保留在审核流程中，不自动删除或覆盖。
- 每题默认分值仅作起点，必须核对；当前打印顺序为单选、多选、填空、解答。尚未提供任意题型顺序或原始 PDF 逐像素复刻。
- PDF 上传尚未配置 OSS；OCR/AI 导入工具尚未接入。服务器配置及凭据应由项目负责人另行安全移交，仓库不包含这些内容。
- 已核验内容需要修正时发布新版本；必要时可以撤销旧版认证或下架。不要直接修改快照表来纠错。
- 已检查版本控制文件清单：仅维护 `frontend/`；旧 `frontend-vue/`、SQLite、TEST 资料、上传文件、备份、密钥及依赖缓存均未纳入本次提交。无需复制本机整个工作目录。
