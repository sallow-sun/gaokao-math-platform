# 公共试卷库

入口 `/papers`；私人组卷书架仍为 `/paper`。新增数据库迁移 V14，与私人浏览器草稿独立。

## 已实现

- 公开列表：关键词、年份、考试、PDF/组卷、人工校核筛选；最新、收藏、近期热门排序。
- 登录后发布、收藏、评价、下架自己的试卷。分享站内组卷时复制题干、配图引用、题型、分数与排版；不公开答案字段或私人草稿数据。内容发布后不可修改，修改需重新发布。
- 站内组卷沿用已有分页打印引擎。公共预览只读，不写入私人草稿；可复制一份到当前浏览器继续编排。
- 难度/高考契合度各 1–5 分，每个账号每卷一条可更新评价，不能评价自己发布的卷；满 5 人展示均分。
- 拥有 REVIEWER/MANAGER 权限的管理员可记录或撤销“人工校核”，必须填写实际校核范围，显示审核人和日期。
- 最近 7 个自然日（含当日）至少 10 位非作者登录用户打开 PDF 或复制组卷时显示 HOT，同人同日重复操作只记一次。普通浏览列表不计热度。
- 每人滚动 24 小时最多创建 20 个发布记录（包含未完成上传），每天最多获取 100 份不同试卷的文件访问链接/复制组卷；这些是基础使用限制，不是费用硬上限。

## 当前上线范围

用户尚未开通 OSS，因此本站组卷分享与试卷库上线；PDF 上传保持关闭。系统不会回退到应用服务器存储 PDF，也不在 2 GB 应用服务器运行 OCR。已有数据、题库图片与私人草稿不迁移。

## 后续启用 OSS

在 `/srv/mathsea/backend/.env` 安全配置以下变量，不能提交真实密钥到 Git：

```dotenv
OSS_ENDPOINT=https://oss-cn-REGION-internal.aliyuncs.com
OSS_BUCKET=your-private-bucket
OSS_PUBLIC_ENDPOINT=https://files.your-domain.example
OSS_ACCESS_KEY_ID=your-ram-access-key-id
OSS_ACCESS_KEY_SECRET=your-ram-access-key-secret
```

- 服务器与 Bucket 同地域时使用内网 endpoint；不满足时改为公网地域 endpoint。文件访问域名需配置 OSS 自定义域名、DNS 与有效 HTTPS 证书。public endpoint 必须是 Bucket 根域名，不带文件路径。
- Bucket 保持私有。使用仅获此 Bucket 必要 GetObject/PutObject 权限的 RAM 身份；CopyObject 需源 GetObject、目标 PutObject 权限。限制到 `paper-temp/*` 和 `paper-files/*`，无需全账户权限。浏览器得到的是限定路径、大小和 15 分钟有效期的 POST 表单签名，不包含 secret。
- OSS CORS：仅允许 `https://mathverse.com.cn`（如使用 www，另加实际来源），方法 GET/HEAD/POST，允许必要请求头（可设 `*`），暴露 ETag/Content-Length/Content-Range/Accept-Ranges，缓存 600 秒。浏览器直接上传，应用服务器不转发上传文件。
- 必须设置生命周期规则：仅 `paper-temp/` 前缀，创建 1 天后删除，用于清理中断上传与已完成上传的临时副本。不要对 `paper-files/` 设置自动到期删除。
- 后端完成接口以 32 KB 缓冲流读取文件，检查文件头、大小与 ETag，计算 SHA-256，然后 OSS 内复制到内容哈希路径。相同文件只保留一个正式对象；下载链接有效 1 小时。PDF 不预先加载，点击后才签发访问地址。
- 文件上限 25 MB。下架为数据库软删除；正式对象可能被多份试卷共享，暂不自动物理删除。后续回收任务必须先核对所有引用，并保留备份宽限期。小规模阶段定期人工检查存储用量即可。
- 如要进一步降低账单，先配置 OSS 流量/费用告警；别把应用的每日访问限制当成云端费用封顶。同一有效下载链接仍可重复使用。
- 重启 `mathsea-backend` 后，`GET /api/v1/papers` 的 `pdfAvailable` 应为 true。再用非生产测试卷验证直传、完成、预览、下载、重试、超限、下架和 CORS；真实 OSS 端到端尚未验证。

## API

公开 GET `/api/v1/papers`、`/api/v1/papers/{id}`。其余接口需要登录与 CSRF：

- POST `/share`：元信息和 version 1 组卷 snapshot。
- POST `/uploads`：元信息，返回资源 id 和 OSS POST 签名。
- POST `/{id}/complete`：校验并发布 PDF，可幂等重试。未完成文件不出现在公开列表。
- POST `/{id}/access?download=false`：记录访问，PDF 返回临时链接。
- PUT `/{id}/favorite`、`/{id}/rating`、`/{id}/check`；DELETE `/{id}` 下架。

## 验证

后端 EditorialIntegrationTest 覆盖公开权限、CSRF、快照清洗、评分去重、作者限制、收藏、校核权限、热门去重、PDF 未配置、所有者校验与完成重试。
前端 `node tests/shared-papers.browser.test.cjs` 覆盖分享、收藏、评分、校核、只读预览打印、私人草稿隔离、复制、PDF 未开放状态和手机布局。该浏览器测试与 PDF 存储测试使用模拟接口，不代替实际 OSS 验收。
