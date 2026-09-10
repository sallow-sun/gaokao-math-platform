# 数海 MathSea

高考数学题库。当前分支包含已上线的题目上传与内容初审、用户反馈、回收站、规范 TAG 与学习进度筛选，以及题库加载和公式排版优化。

## 从这里开始

- [完整本地开发与交接说明](docs/DEVELOPMENT.md)：环境、启动、管理员、测试与代码入口。
- [部署说明](deploy/README.md)：发布包、服务器布局、备份与回滚限制。
- [题目上传规则 1.4](frontend/public/docs/题目上传规则1.4.md) 与 [MD 模板](frontend/public/docs/题目模板1.4.md)。
- [内容初审与反馈操作](frontend/public/docs/内容初审与反馈说明.md)。

## 项目结构

```text
backend/       Java 21 / Spring Boot，PostgreSQL、Redis、Flyway V1～V11
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

本分支基于 `backends` 分支上的已部署项目整理；没有合并其他并行开发分支，也没有改写仓库历史。临时密钥、环境文件、数据库、上传备份和依赖缓存不包含在当前版本中。
