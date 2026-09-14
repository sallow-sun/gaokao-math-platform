# 数海 MathSea

高考数学题库，包含题目上传与审核、自由组卷、试卷分享、个人学习统计、错题及用户等级。

交接分支：`handoff/original-paper-versions-20260914`。本次新增按上传归属自动整理原卷、疑似重复题提示与复用、管理员核验发布及不可改写的试卷版本。

## 从这里开始

- [完整本地开发与交接说明](docs/DEVELOPMENT.md)：环境、启动、管理员、测试与代码入口。
- [本次交接记录](docs/HANDOFF.md)：线上版本、验证结果及后续工作边界。
- [部署说明](deploy/README.md)：发布包、服务器布局、备份与回滚限制。
- [原卷整理说明](docs/original-papers.md)：操作入口、核验规则、版本锁定与查重范围。
- [等级规则](docs/user-growth.md)：测试期经验与等级配置。
- [题目上传规则 1.4](frontend/public/docs/题目上传规则1.4.md) 与 [MD 模板](frontend/public/docs/题目模板1.4.md)。
- [内容初审与反馈操作](frontend/public/docs/内容初审与反馈说明.md)。

## 项目结构

```text
backend/       Java 21 / Spring Boot，PostgreSQL、Redis、Flyway V1～V17
frontend/      Vue 3 / JavaScript / Vite，KaTeX，单元与浏览器测试
docs/          开发交接文档
deploy/        发布打包、已有服务器升级脚本及服务配置参考
.github/       自动化构建与测试
```

请克隆整个仓库：前端和后端共用 `backend/src/main/resources/tag-taxonomy.json`。唯一维护中的前端目录是 `frontend/`。

## 快速启动

准备 JDK 21、Maven 3.9+、Node.js 22.18+ 和 Docker。分别在两个终端运行：

```sh
cd backend
docker compose up -d
mvn spring-boot:run
```

```sh
cd frontend
npm ci
npm run dev
```

打开 `http://localhost:5173`。数据库由迁移自动初始化，不需要生产数据或本机 TEST 文件夹。测试与生产构建命令见开发说明。

本分支从 `feature/visual-paper-builder` 创建，包含完整前后端代码；没有合并其他成员分支或改写历史。运行数据、密钥、依赖缓存、旧 `frontend-vue/` 和本机参考资料不纳入版本控制。

后续修改请新增 Flyway 迁移，不要改写 V1～V17。PDF 上传仍等待配置 OSS；现有站内组卷分享、原卷整理和版本发布不依赖 OSS。查重目前采用规则提示与人工确认，不包含 OCR 或 AI 自动识别。
