# 已确认的 MathSea 2.0 后端决策

1. **完全重构**：旧 Flask/SQLite 不作为新版代码基础。
2. **前端**：Vue 3 + TypeScript + Vite。
3. **后端**：Java 21 + Spring Boot 3.5.x，模块化单体。
4. **数据库**：PostgreSQL，从零建库，不迁移旧 `userDatabase.db` / `questionDatabase.db`。
5. **Redis**：用于 Spring Session 和限流；暂不普遍使用业务缓存。
6. **验证码**：当前版本不做短信/邮箱验证码。
7. **登录**：服务器 Session + HttpOnly Cookie + CSRF；支持用户名、UID、邮箱 + 密码。
8. **密码**：BCrypt 单向哈希，不保存明文。
9. **Tag**：`tags` + `problem_tags` 多对多关系，API 对 Vue 返回 `string[]`。
10. **数学内容**：Markdown + LaTeX 原文存 PostgreSQL，Vue 负责安全渲染。
11. **题型**：`single-choice` / `multiple-choice` / `fill-blank` / `solution`。
12. **训练价值**：`white → green → cyan → blue → yellow → orange → red → purple → black` 为由易到难顺序。
13. **来源**：来源是独立表，由管理员维护；初始包含新高考Ⅰ卷、新高考Ⅱ卷、全国甲卷、地方题、模拟题。
14. **暂不引入**：微服务、MQ、Elasticsearch、Kubernetes、全局 `@Cacheable`。
