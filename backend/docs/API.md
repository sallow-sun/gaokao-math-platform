# MathSea API v1

所有新版接口使用 `/api/v1`。

## 通用规则

- JSON 字段使用 camelCase。
- 用户主页使用数据库数字 ID，例如 `/user/1`；对应 API 为 `/users/1`。
- 题目公开稳定 ID 使用 `P10001`。
- `publicId` 仍用于题单所有者、管理操作等不需要暴露数字 ID 的场景。
- 时间为 ISO 8601。
- 未登录访问公开题库时 `viewerState = null`。
- 写接口使用 Cookie Session + CSRF。

错误格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请检查填写内容",
    "fieldErrors": {},
    "requestId": "..."
  }
}
```

## Auth

| Method | Path | 登录 |
|---|---|---|
| GET | `/auth/csrf` | 否 |
| POST | `/auth/register` | 否 |
| POST | `/auth/login` | 否 |
| GET | `/auth/me` | 可选 |
| POST | `/auth/logout` | 是 |
| POST | `/auth/change-password` | 是 |

当前不提供验证码接口，也暂未开放找回密码邮件流程。

## Users

| Method | Path |
|---|---|
| GET | `/users/{userId}` |
| GET | `/users/me` |
| PATCH | `/users/me` |
| PATCH | `/users/me/username` |
| POST | `/users/me/avatar` |
| DELETE | `/users/me/avatar` |

第一个注册用户是永久管理员，数据库会拒绝删除、封禁或撤销其管理员权限。

## Problems

`GET /problems`

重复 query 参数表示多选：

```text
/problems?year=2025&year=2026&source=national-new-1&type=single-choice&tag=函数&tag=导数&page=1&pageSize=20
```

支持：

- `keyword`
- `year`
- `source`
- `type`
- `level`
- `tag`
- `sort`
- `seed`：随机排序种子（默认 `0`，最多使用前 80 字符）；翻页保留相同值，换一批使用新值。
- `page`
- `pageSize`

排序：

- `newest`
- `random`：在全部筛选结果中按种子稳定随机排序。
- `oldest`
- `easy-first`
- `hard-first`
- `view-most`
- `star-most`

标签多选为 AND。

另外：

| Method | Path |
|---|---|
| GET | `/problems/{problemId}` |
| GET | `/problems/random` |
| GET | `/problem-catalogs` |
| GET | `/problem-stats` |

## 收藏与已做

```text
PATCH /users/me/problem-states/P10001
```

请求可只提交一个字段：

```json
{
  "favorite": true
}
```

或：

```json
{
  "completed": true
}
```

批量：

```text
PATCH /users/me/problem-states/batch
```

```json
{
  "problemIds": ["P10001", "P10002"],
  "favorite": true
}
```

## 个人题单

公开题单无需登录即可查看；只有所有者能够修改：

| Method | Path | 说明 |
|---|---|---|
| GET | `/practice-lists?kind=official` | 官方题单 |
| GET | `/practice-lists?kind=square` | 题单广场 |
| GET | `/practice-lists/{listId}` | 公开题单详情 |

`isPublic=false` 的题单只有所有者可见。官方起步题单自动归属于数据库中的首位用户。

| Method | Path |
|---|---|
| GET | `/users/me/practice-lists` |
| POST | `/users/me/practice-lists` |
| GET | `/users/me/practice-lists/{listId}` |
| PATCH | `/users/me/practice-lists/{listId}` |
| DELETE | `/users/me/practice-lists/{listId}` |
| PUT | `/users/me/practice-lists/{listId}/default` |
| POST | `/users/me/practice-lists/{listId}/items` |
| DELETE | `/users/me/practice-lists/{listId}/items/{problemId}` |
| POST | `/users/me/practice-lists/{listId}/items/remove` |
| PUT | `/users/me/practice-lists/{listId}/order` |
| PATCH | `/users/me/practice-lists/{listId}/items/{problemId}` |

## Admin

管理员接口要求 `ROLE_ADMIN`。

管理员权限由项目根目录的 `manage-admin.bat grant|revoke <用户名|UID|邮箱>` 管理；每次变更都会使目标用户旧会话失效。

```text
GET /admin/stats
```

返回用户总数、正常用户、封禁用户和题目总数。

### Problems

| Method | Path |
|---|---|
| GET | `/admin/problems` |
| GET | `/admin/problems/{problemId}` |
| POST | `/admin/problems` |
| PUT | `/admin/problems/{problemId}` |
| DELETE | `/admin/problems/{problemId}` |
| POST | `/admin/problems/{problemId}/assets` |
| DELETE | `/admin/problems/{problemId}/assets/{assetId}` |

管理员创建/修改题目的 tags 使用数组：

```json
{
  "problemNumber": "P10003",
  "year": 2026,
  "region": "全国",
  "source": "national-new-1",
  "type": "solution",
  "level": "red",
  "tags": ["函数", "导数"],
  "content": "...",
  "answer": "...",
  "solution": "..."
}
```

### Users

```text
GET   /admin/users?keyword=xxx&page=1&pageSize=20
PATCH /admin/users/{publicId}/ban
```

```json
{
  "banned": true
}
```

### Tags

```text
GET    /admin/tags
POST   /admin/tags
PATCH  /admin/tags/{id}
DELETE /admin/tags/{id}
```

### Sources

```text
GET    /admin/sources
POST   /admin/sources
PATCH  /admin/sources/{code}
DELETE /admin/sources/{code}
```

如果来源仍被题目使用，删除返回 `409`；管理员可以改为 `active=false`。
