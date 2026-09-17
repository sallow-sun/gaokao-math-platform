# MathSea 2.0 后端架构

## 请求链路

```text
Vue 3
  ↓ HTTP / JSON
Controller
  ↓
Service
  ↓
Mapper
  ↓
PostgreSQL
```

Redis 不替代 PostgreSQL。Redis 当前只负责 Session 和限流。

## 文件职责

### `MathSeaApplication.java`
Spring Boot 启动入口，类似旧 Flask 的 `app.run()`，但不写业务逻辑。

### `controller/`
只负责 HTTP：读取 path/query/body/file，拿当前登录用户，然后调用 Service。不要直接写 SQL。

### `service/`
真正的业务规则：注册、筛题、多标签 AND、收藏计数、题单权限、管理员校验等。

### `mapper/`
数据库访问层。简单 CRUD 使用 MyBatis-Plus `BaseMapper`；复杂题库筛选在 `ProblemMapper.xml` 中写动态 SQL。

### `entity/`
对应 PostgreSQL 表的一行数据，只描述持久化字段，不直接作为 Vue 的 API 返回结构。

### `dto/`
前端 -> 后端的请求结构，例如注册表单、筛选条件、管理员创建题目。

### `vo/`
后端 -> 前端的返回结构。这里故意与数据库 Entity 分开，避免把内部主键、密码哈希等字段暴露给 Vue。

### `security/`
Spring Security 登录身份、权限和会话检查。Session 实际保存在 Redis；浏览器只持有 HttpOnly Session Cookie。

### `common/exception/`
统一错误格式。业务代码抛 `BusinessException`，浏览器拿到稳定的 `error.code` 和中文 `message`。

### `common/storage/`
第一版的本地图片存储。以后迁移 OSS/S3 时替换这一层，不需要重写题库 Controller。

### `db/migration/`
Flyway 数据库版本。以后任何新增表/字段都新建 `V2__xxx.sql`、`V3__xxx.sql`，不要手工改生产数据库。

## Tag 为什么三张表

```text
problems
problem_tags
tags
```

`tags` 保存标签本身；`problem_tags` 只保存题目和标签之间的关系。

例如 P10001 内部 problem_id=100，拥有函数、导数：

```text
tags
id | name
1  | 函数
2  | 导数

problem_tags
problem_id | tag_id
100        | 1
100        | 2
```

API 仍然返回：

```json
{
  "id": "P10001",
  "tags": ["函数", "导数"]
}
```

因此数据库规范化和 Vue 使用方便并不冲突。

## 密码与数据安全

- 密码：BCrypt 单向哈希；不能解密回明文。
- Session：Redis；浏览器只有 HttpOnly Cookie。
- CSRF：`XSRF-TOKEN` + `X-XSRF-TOKEN`。
- 生产传输：HTTPS/TLS。
- 邮箱/手机号：当前 PostgreSQL 中是可查询普通字段，不做 BCrypt；如以后有合规要求，可增加磁盘/字段级加密。
- 管理员敏感操作：写入 `audit_logs`。
- 用户被封禁、密码变化、角色变化：`AccountStatusFilter` 会让旧 Session 失效。

## 当前明确不做

- 验证码
- 旧 SQLite 数据迁移
- 微服务
- Elasticsearch
- 消息队列
- Kubernetes
- 到处使用 `@Cacheable`

先保证模块化单体的数据、权限和 API 正确。
