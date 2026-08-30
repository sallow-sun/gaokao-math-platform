# 数海 MathSea 管理后台 API 契约草案

> 状态：前端草案，等待后端负责人确认
>
> 对应页面：`frontend-vue/src/views/AdminView.vue`
>
> 接口版本：`/api/v1`
>
> 说明：本文只约定浏览器与后端之间的 HTTP/JSON 行为，不限定后端语言、框架和数据库。

## 1. 草案目标

这份草案服务于当前 Vue 管理后台的第一版功能：

1. 恢复当前管理员身份。
2. 显示用户和题目统计。
3. 搜索和分页浏览用户。
4. 封禁或解除封禁普通用户。
5. 读取题型、训练价值、来源和标签目录。
6. 搜索和分页浏览题目。
7. 新增题目。
8. 编辑已有题目。

后端尚未开始开发时，Vue 页面继续使用内存演示服务。真实 API 接入后，页面组件的 props、事件和题目视图模型应保持稳定，只替换服务适配层和必要的分页状态。

## 2. 当前范围之外

第一版不包含：

- 删除题目；
- 批量封禁或批量编辑；
- 任命或撤销管理员；
- 用户投稿审核；
- 审计日志界面；
- 题目图片和附件上传；
- Markdown、LaTeX 或富文本格式切换；
- 管理员之间的并发编辑冲突处理；
- 导入、导出和数据库迁移。

如果后续增加这些能力，应先更新契约和前端交互，不在现有字段中暗藏未约定的行为。

## 3. 通用约定

本草案继承 `BACKEND_API_HANDOFF.md` 的通用规则：

- 所有新版接口使用 `/api/v1` 前缀；
- 请求和响应字段使用 `camelCase`；
- 所有 ID 在 JSON 中使用字符串；
- 时间使用 UTC 的 ISO 8601 字符串；
- API 只返回 JSON，不返回 HTML 错误页；
- 标签等集合返回数组，不返回逗号分隔字符串；
- 使用 HTTP 状态码表达结果，不在 `200` 中包装失败；
- 正式环境优先让 Vue 与 API 同站部署；
- Cookie 会话请求使用 `credentials: "same-origin"`；
- 所有修改数据的请求必须通过 CSRF 校验；
- 后端必须独立执行身份、权限和字段校验，不能依赖前端隐藏或禁用按钮。

### 3.1 成功响应

查询列表统一返回：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "hasNext": false
  }
}
```

创建或修改统一返回：

```json
{
  "item": {},
  "message": "操作成功"
}
```

`message` 是可以直接向管理员展示的简体中文反馈，前端不能依靠文字判断操作类型或成功状态。

### 3.2 错误响应

统一错误格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请检查填写内容",
    "fieldErrors": {
      "content": ["题面不能为空"]
    },
    "requestId": "可选的日志排查编号"
  }
}
```

`fieldErrors` 和 `requestId` 可以省略。`code` 必须是稳定的英文机器码，不能让前端解析中文错误文字。

### 3.3 空值

当前 Vue admin 表单使用空字符串和空数组：

- 可选文本未填写时返回 `""`；
- 没有标签时返回 `[]`；
- 没有列表项时返回 `items: []`；
- 不返回 `undefined`；
- 除非业务确实存在“未知”和“未设置”的区别，否则不返回 `null`。

## 4. 会话、管理员权限与 CSRF

### 4.1 当前会话

复用通用账户接口：

`GET /api/v1/auth/me`

建议已登录响应：

```json
{
  "authenticated": true,
  "user": {
    "id": "user_01JXYZ",
    "uid": "MATHSEA-0001",
    "username": "管理员",
    "avatarUrl": "https://example.invalid/media/avatar.webp",
    "role": "admin",
    "status": "active",
    "joinedAt": "2026-08-30T03:00:00Z"
  }
}
```

admin 页面只允许同时满足以下条件的账号使用：

- `authenticated === true`；
- `user.role === "admin"`；
- `user.status === "active"`。

前端路由检查只用于改善跳转体验。每一个 `/api/v1/admin/...` 接口仍必须由后端重新检查权限。

建议状态处理：

| 状态         | 前端行为                               |
| ------------ | -------------------------------------- |
| `401`        | 跳转登录页，并保留返回 `/admin` 的信息 |
| `403`        | 展示无管理员权限状态，不渲染管理数据   |
| 管理员被封禁 | 按 `403` 处理，并使已有管理会话失效    |

### 4.2 CSRF

后端语言可以不同，但需要在联调前从以下方案中确定一种：

1. 提供同站 CSRF Cookie，前端读取后放入请求头；
2. 提供独立的 CSRF 初始化接口，响应中返回令牌；
3. 在 `GET /api/v1/auth/me` 中返回短期 CSRF 令牌。

前端统一要求：

- 修改请求头名称为 `X-CSRF-Token`；
- CSRF 令牌不写入 `localStorage`；
- CSRF 失败返回 `403` 和错误码 `CSRF_FAILED`；
- 会话或令牌失效时显示“页面凭证已失效，请刷新后重试”；
- GET 查询不得产生修改数据的副作用。

## 5. 管理数据概览

`GET /api/v1/admin/summary`

成功响应：

```json
{
  "users": {
    "total": 1280,
    "active": 1268,
    "banned": 12
  },
  "problems": {
    "total": 8560
  }
}
```

字段含义：

| 字段             | 类型   | 含义                           |
| ---------------- | ------ | ------------------------------ |
| `users.total`    | number | 所有用户账号数量，包含管理员   |
| `users.active`   | number | 当前未封禁账号数量，包含管理员 |
| `users.banned`   | number | 当前已封禁账号数量             |
| `problems.total` | number | 当前题库题目总数               |

必须满足：

```text
users.active + users.banned = users.total
```

统计由后端返回，前端不能根据当前分页加载到的列表长度计算正式统计。

## 6. 用户模型与用户管理接口

### 6.1 AdminUser 模型

```json
{
  "id": "user_01JXYZ",
  "uid": "MATHSEA-1008",
  "username": "示例学生",
  "role": "student",
  "status": "active",
  "joinedAt": "2026-08-30T03:00:00Z"
}
```

| 字段       | 类型   | 规则                               |
| ---------- | ------ | ---------------------------------- |
| `id`       | string | 后端稳定标识，管理接口路径使用此值 |
| `uid`      | string | 用户可见 UID                       |
| `username` | string | 当前用户名                         |
| `role`     | string | 第一版只接受 `admin` 或 `student`  |
| `status`   | string | 第一版只接受 `active` 或 `banned`  |
| `joinedAt` | string | UTC ISO 8601 时间                  |

第一版用户管理响应不返回邮箱、手机号、密码信息、登录 IP、会话令牌或内部数据库主键。

### 6.2 查询用户

`GET /api/v1/admin/users`

查询参数：

| 参数       | 类型   | 默认值          | 含义                       |
| ---------- | ------ | --------------- | -------------------------- |
| `keyword`  | string | `""`            | 搜索用户名或 UID           |
| `status`   | string | `""`            | `active`、`banned` 或全部  |
| `page`     | number | `1`             | 从 1 开始                  |
| `pageSize` | number | `20`            | 每页数量，后端应设置最大值 |
| `sort`     | string | `joinedAt-desc` | 第一版固定支持最新加入优先 |

成功响应：

```json
{
  "items": [
    {
      "id": "user_01JXYZ",
      "uid": "MATHSEA-1008",
      "username": "示例学生",
      "role": "student",
      "status": "active",
      "joinedAt": "2026-08-30T03:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasNext": false
  }
}
```

后端搜索至少覆盖 `username` 和 `uid`，并说明是否区分大小写。搜索条件变化后，前端从第 1 页重新读取。

### 6.3 修改用户状态

`PATCH /api/v1/admin/users/{userId}/status`

请求：

```json
{
  "status": "banned"
}
```

成功响应：

```json
{
  "item": {
    "id": "user_01JXYZ",
    "uid": "MATHSEA-1008",
    "username": "示例学生",
    "role": "student",
    "status": "banned",
    "joinedAt": "2026-08-30T03:00:00Z"
  },
  "message": "用户已封禁"
}
```

规则：

- 重复设置为相同状态应安全成功；
- 管理员不能修改自己的状态；
- 第一版不允许通过这个接口修改任何管理员账号；
- 请求中的 `userId` 不存在时返回 `404`；
- 请求不能携带 `role`，普通管理操作不能借此任命管理员；
- 成功后概览统计和用户列表必须保持一致。

## 7. 题目目录

admin 页面复用通用题库目录接口：

`GET /api/v1/problem-catalogs`

本草案要求响应至少包含：

```json
{
  "sources": [
    { "value": "national-new-1", "label": "新高考Ⅰ卷" },
    { "value": "national-new-2", "label": "新高考Ⅱ卷" },
    { "value": "national-a", "label": "全国甲卷" },
    { "value": "local", "label": "地方卷" },
    { "value": "mock", "label": "模拟题" }
  ],
  "types": [
    { "value": "single-choice", "label": "单项选择题" },
    { "value": "multiple-choice", "label": "多项选择题" },
    { "value": "fill-blank", "label": "填空题" },
    { "value": "solution", "label": "解答题" }
  ],
  "levels": [
    { "value": "red", "label": "RED" },
    { "value": "orange", "label": "ORANGE" },
    { "value": "yellow", "label": "YELLOW" },
    { "value": "green", "label": "GREEN" },
    { "value": "cyan", "label": "CYAN" },
    { "value": "blue", "label": "BLUE" },
    { "value": "purple", "label": "PURPLE" },
    { "value": "black", "label": "BLACK" },
    { "value": "white", "label": "WHITE" }
  ],
  "tags": ["导数", "复数", "函数"]
}
```

约束：

- `value` 是稳定代码，`label` 是简体中文或当前界面展示文字；
- 后端保存代码，不把中文展示文字当作来源、题型或训练价值主键；
- 标签是字符串数组；
- 后端应拒绝目录之外的来源、题型和训练价值代码；
- 当前原型标签只有“导数、复数、函数”，未来扩充目录不需要改变题目模型；
- 目录顺序应稳定，训练价值顺序与当前 Vue 配置一致。

## 8. AdminProblem 模型

完整模型：

```json
{
  "id": "P10001",
  "title": "2025 年新高考Ⅰ卷 · T1",
  "detail": "复数的基本运算",
  "year": "2025",
  "source": "national-new-1",
  "sourceLabel": "新高考Ⅰ卷",
  "type": "single-choice",
  "typeLabel": "单项选择题",
  "level": "red",
  "tags": ["复数"],
  "content": "1. (1 + 5i)i 的虚部为（    ）",
  "answer": "",
  "solution": "",
  "sourceText": "2025 · 新高考Ⅰ卷",
  "stats": {
    "views": 0,
    "passes": 0,
    "downloads": 0,
    "favorites": 0
  }
}
```

### 8.1 前端可编辑字段

| 字段       | 类型     | 规则                                 |
| ---------- | -------- | ------------------------------------ |
| `id`       | string   | 稳定题号，创建时必填，保存后不可修改 |
| `title`    | string   | 可选标题                             |
| `detail`   | string   | 可选知识点说明                       |
| `year`     | string   | 可选，当前使用四位年份字符串         |
| `source`   | string   | 可选，值来自目录 `sources[].value`   |
| `type`     | string   | 可选，值来自目录 `types[].value`     |
| `level`    | string   | 可选，值来自目录 `levels[].value`    |
| `tags`     | string[] | 可多选，去重后保存                   |
| `content`  | string   | 题面，必填                           |
| `answer`   | string   | 可选最终答案                         |
| `solution` | string   | 可选题解                             |

### 8.2 后端生成字段

以下字段不接受前端写入：

- `sourceLabel`：根据来源目录生成；
- `typeLabel`：根据题型目录生成；
- `sourceText`：根据年份和来源生成；
- `stats`：来自真实统计，不能由管理员表单伪造。

当前正文按纯文本保存和返回。后端必须把正文当作不可信输入，Vue 使用文本插值展示；在内容格式契约确定前，不接受任意 HTML。

## 9. 题目管理接口

### 9.1 查询题目

`GET /api/v1/admin/problems`

查询参数：

| 参数       | 类型   | 默认值    | 含义                                   |
| ---------- | ------ | --------- | -------------------------------------- |
| `keyword`  | string | `""`      | 搜索题号、标题、说明、题面或标签       |
| `page`     | number | `1`       | 从 1 开始                              |
| `pageSize` | number | `20`      | 每页数量，后端应设置最大值             |
| `sort`     | string | `id-desc` | 第一版使用题号降序或后端确认的稳定顺序 |

成功响应：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "hasNext": false
  }
}
```

`items` 中每一项使用第 8 节的完整 `AdminProblem` 模型。第一版每页最多返回 20 道完整题目，以保持当前“点击编辑立即载入”的前端行为。后续如果答案和题解体积明显增大，再单独设计详情请求。

### 9.2 新增题目

`POST /api/v1/admin/problems`

请求：

```json
{
  "id": "P10003",
  "title": "演示新增题目",
  "detail": "复数的基本运算",
  "year": "2026",
  "source": "national-new-1",
  "type": "single-choice",
  "level": "red",
  "tags": ["复数"],
  "content": "题面纯文本",
  "answer": "",
  "solution": ""
}
```

成功返回 `201`：

```json
{
  "item": {
    "id": "P10003",
    "title": "演示新增题目",
    "detail": "复数的基本运算",
    "year": "2026",
    "source": "national-new-1",
    "sourceLabel": "新高考Ⅰ卷",
    "type": "single-choice",
    "typeLabel": "单项选择题",
    "level": "red",
    "tags": ["复数"],
    "content": "题面纯文本",
    "answer": "",
    "solution": "",
    "sourceText": "2026 · 新高考Ⅰ卷",
    "stats": {
      "views": 0,
      "passes": 0,
      "downloads": 0,
      "favorites": 0
    }
  },
  "message": "题目新增成功"
}
```

规则：

- 后端去除文本首尾空白；
- 题号统一规范为大写；
- `id` 和 `content` 必填；
- 题号必须唯一；
- 标签去重；
- 来源、题型和训练价值必须来自当前目录；
- 不接受 `sourceLabel`、`typeLabel`、`sourceText` 或 `stats`；
- 创建者身份从当前管理员会话取得，不接受客户端提交。

### 9.3 编辑题目

`PUT /api/v1/admin/problems/{problemId}`

路径中的 `problemId` 是稳定题号，例如 `P10001`。请求正文包含除 `id` 外的全部可编辑字段：

```json
{
  "title": "2025 年新高考Ⅰ卷 · T1",
  "detail": "复数的基本运算",
  "year": "2025",
  "source": "national-new-1",
  "type": "single-choice",
  "level": "red",
  "tags": ["复数"],
  "content": "修改后的题面纯文本",
  "answer": "1",
  "solution": "解析纯文本"
}
```

成功返回 `200`，结构与新增题目一致：

```json
{
  "item": {},
  "message": "题目修改成功"
}
```

规则：

- 题号不可通过编辑接口修改；
- 题目不存在时返回 `404`；
- `content` 仍然必填；
- PUT 按完整表单更新，可选字段用空字符串明确清除；
- 响应中的 `item` 必须是保存后的完整模型。

## 10. 推荐错误码

| HTTP 状态 | `error.code`                | 场景                           |
| --------- | --------------------------- | ------------------------------ |
| `400`     | `INVALID_REQUEST`           | JSON 无法解析或请求结构错误    |
| `401`     | `AUTH_REQUIRED`             | 未登录或会话失效               |
| `403`     | `ADMIN_REQUIRED`            | 当前用户不是可用管理员         |
| `403`     | `CSRF_FAILED`               | CSRF 缺失或失效                |
| `404`     | `USER_NOT_FOUND`            | 目标用户不存在                 |
| `404`     | `PROBLEM_NOT_FOUND`         | 目标题目不存在                 |
| `409`     | `ADMIN_ACCOUNT_IMMUTABLE`   | 尝试封禁自己或其他管理员       |
| `409`     | `PROBLEM_ID_CONFLICT`       | 新建题号已经存在               |
| `422`     | `VALIDATION_ERROR`          | 必填、长度或格式校验失败       |
| `422`     | `UNSUPPORTED_CATALOG_VALUE` | 来源、题型或训练价值不在目录中 |
| `429`     | `RATE_LIMITED`              | 请求过于频繁                   |
| `500`     | `INTERNAL_ERROR`            | 后端未预期错误                 |

错误响应不得包含 SQL、堆栈、本机路径、密码、会话内容或 CSRF 令牌。

## 11. 与当前前端服务的对应关系

当前演示服务：`frontend-vue/src/services/adminPrototypeService.js`

| 当前方法                           | 正式 API                                    |
| ---------------------------------- | ------------------------------------------- |
| `getSummary()`                     | `GET /api/v1/admin/summary`                 |
| `getUsers(query)`                  | `GET /api/v1/admin/users`                   |
| `getProblemCatalogs()`             | `GET /api/v1/problem-catalogs`              |
| `getProblems(query)`               | `GET /api/v1/admin/problems`                |
| `updateUserStatus(userId, status)` | `PATCH /api/v1/admin/users/{userId}/status` |
| `createProblem(value)`             | `POST /api/v1/admin/problems`               |
| `updateProblem(problemId, value)`  | `PUT /api/v1/admin/problems/{problemId}`    |

页面由 `useAdminDashboard` 并行调用四个读取方法，并分别维护加载、失败和重试状态；因此单个接口失败时，不需要让整个管理页不可用。

真实适配器应集中处理：

- `credentials`；
- CSRF 请求头；
- JSON 解析；
- HTTP 状态和统一错误转换；
- 请求取消；
- 搜索参数和分页序列化；
- API 模型到当前 Vue 模型的校验和规范化。

展示组件不得直接调用 `fetch()`，也不得读取 Cookie 或拼接 API 地址。

## 12. 后端确认清单

后端开始实现前，需要逐项回复：

1. 是否接受 `/api/v1`、camelCase 和统一错误结构？
2. 采用哪种服务器会话方案？
3. CSRF 如何初始化、存储和提交？
4. `GET /api/v1/auth/me` 在未登录时返回 `401`，还是返回 `authenticated: false`？
5. 管理员角色和封禁状态如何保存？
6. 是否接受管理员账号在第一版完全不可被封禁？
7. 用户搜索是否区分大小写？
8. 用户和题目列表支持的最大 `pageSize` 是多少？
9. 题目排序是否能稳定返回，避免翻页重复或遗漏？
10. 是否接受稳定题号作为题目 API 的 `id`？
11. 来源、题型、训练价值和标签目录由谁维护？
12. 是否接受当前九级训练价值顺序？
13. 题面、答案和题解第一版是否按纯文本保存？
14. 唯一题号冲突是否返回 `409 PROBLEM_ID_CONFLICT`？
15. 字段错误能否按 `fieldErrors` 返回？
16. 管理操作是否有基础服务器日志，且不记录敏感令牌？

在这些问题确认并形成 OpenAPI 文档前，Vue admin 页面继续保持“前端演示模式”，不得把内存操作描述成真实后台写入。

## 13. 第一轮联调验收

至少准备以下身份和数据：

- 一个正常管理员；
- 一个普通学生；
- 一个已封禁学生；
- 一个无管理员权限的登录用户；
- 至少 21 道题，能验证第 2 页；
- 至少一道覆盖每种题型的题；
- 至少一道包含多个标签的题。

必须验证：

1. 未登录、无权限和管理员会话失效。
2. 用户和题目空列表、搜索无结果与第二页。
3. 封禁、解禁、重复提交、封禁管理员和封禁自己。
4. 新增题目、重复题号、缺少题面和非法目录值。
5. 编辑题目、题目不存在和清空可选字段。
6. CSRF 缺失、错误和过期。
7. 服务器错误时页面不显示“操作成功”。
8. 刷新页面后真实数据仍然存在。
9. 概览统计与列表状态一致。
10. API 响应不包含密码、令牌、SQL 或异常堆栈。
