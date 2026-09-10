# 部署交接

当前生产布局：

- `/srv/mathsea/backend/app.jar`、`start.sh`、`.env`、`uploads/`
- systemd 服务 `mathsea-backend.service`，运行账号 `backend-deploy`
- Java 监听 `127.0.0.1:8000`，PostgreSQL 数据库 `mathsea`，Redis 保存会话
- `/var/www/mathsea-current` 指向 `/var/www/mathsea-releases/<版本>`
- Nginx 提供前端，并代理 `/api/` 与 `/uploads/` 至后端

本目录不包含真实环境变量、凭据、TLS 私钥或数据库。`systemd/mathsea-backend.service` 和受限的 `sudoers/backend-deploy` 为配置参考，安装前核对机器路径和账号。

## 构建发布包

先按 [开发文档](../docs/DEVELOPMENT.md) 完成测试和构建，再在仓库根目录执行：

```sh
python deploy/package-release.py
```

输出 `release/mathsea-<UTC时间>.tar.gz`，内含 `app.jar`、`frontend/` 和 `SHA256SUMS`，不包含运行数据。此脚本只打包已经构建的产物，不替代测试。

## 更新已有服务器

`release-editorial.sh` 适用于上述**已经配置好的服务器**，不是新机器安装器。使用有权部署的 SSH 账号上传发布包与脚本，解压到新的 `/tmp/mathsea-<版本>/` 后执行：

```sh
sudo bash release-editorial.sh /tmp/mathsea-<版本>
```

脚本校验 SHA256，备份旧 JAR、环境文件、数据库及配图，短暂停止后端写入，安装新 JAR，检查后端健康、V11 迁移和题号格式，然后切换前端软链接。备份位于 `/srv/mathsea/backups/`。脚本中的域名、服务名、库名需与目标机器一致。

脚本失败会尝试恢复旧应用与前端，但**不会自动回退已执行的数据库迁移**。本分支含标签归并等数据变更，旧应用是否兼容需人工判断；需要恢复数据库时应停止写入，并由运维从本次备份协调恢复，避免覆盖上线后的新数据。

仅前端更新可单独备份当前前端，将 `frontend/dist/` 放入新的版本目录，再原子切换 `mathsea-current`。不要覆盖当前目录中的一部分资源。完成后检查首页、题库、管理页面和 API 健康。

新机器还需配置 Java 21、PostgreSQL、Redis、Nginx、账号目录权限、HTTPS 与 `start.sh`。后端 `.env` 的变量说明见 `backend/.env.example`；生产需安全 Cookie、正确域名和独立密码。不要把服务器 `.env` 拷回 Git。
