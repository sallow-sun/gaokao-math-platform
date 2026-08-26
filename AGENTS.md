# AGENTS.md

本文件适用于整个仓库，供参与本项目的 AI 编码代理和开发者参考。若子目录中存在更具体的 `AGENTS.md`，则子目录规则优先。

## 项目目标

本项目是面向高考生的数学学习平台。当前重点是将旧版前端逐步迁移到 Vue 3，同时保留清晰的前后端边界，为后续 API 接入做好准备。

工作时优先保证：内容准确、操作直观、适合学生使用、桌面与移动端可用，并避免为了展示效果引入虚假业务能力。

## 目录与来源优先级

- `frontend-vue/`：正在开发的 Vue 3 + Vite 前端，是迁移目标和主要修改区域。
- `frontend/`：旧版静态前端和设计原型。迁移页面时，以这里对应页面的结构、样式和交互为主要参考。
- `templates/`：旧 Flask 模板，不是 Vue 页面迁移的视觉来源，除非任务明确要求查看或修改。
- `app.py`：现有 Flask 后端，属于待更新的旧版本。接口契约尚未确定时，不要依据其模板渲染方式固化 Vue 架构。
- `static/`：旧版静态资源和运行时资源。
- `*.db`、`static/uploads/`：本地运行时数据，不得加入 Git。

当 `frontend/` 与 `templates/` 的页面实现不一致时，默认以 `frontend/` 为准，并在交付说明中指出差异。

## Vue 前端技术约定

`frontend-vue` 使用：

- Vue 3
- Composition API 和 `<script setup>`
- Vite
- Vue Router
- Pinia（仅在确实需要跨页面全局状态时使用）

目录职责：

- `src/views/`：路由级页面，负责组合组件和协调页面状态。
- `src/components/<feature>/`：按功能拆分的可复用展示组件。
- `src/composables/`：状态、业务操作、浏览器能力和未来 API 适配逻辑。
- `src/config/`：稳定的选项、目录数据和临时原型数据。
- `src/assets/styles/`：页面级样式、响应式规则和打印规则。
- `src/router/index.js`：集中维护页面路由；较大的页面优先懒加载。

组件应保持职责单一。优先通过 `props` 向下传递数据、通过 `emit` 向上传递操作，不要让展示组件直接读取或修改其他页面的状态。

## 当前题库页约定

- 路由为 `/problems`，入口页面是 `src/views/ProblemsView.vue`。
- 原型题目暂存在 `src/config/problems.js` 的 `PROBLEMS_PROTOTYPE_ITEMS` 中，后续会被新版 API 替换。
- 显示、打印、筛选、收藏、已做和题单等偏好目前使用 composable 与 `localStorage` 保存。
- 本地状态只是 API 接入前的前端闭环，不应被描述为账号云同步或真实后端数据。
- 题解独立页面尚未实现时，可以提供明确的占位状态，但不得编造题解内容或虚构可用路由。
- 无限加载每批 20 道题。修改筛选、排序或数据源时，应验证加载状态能够正确重置。
- 普通列表与打印列表应保持隔离，避免无限加载影响批量打印范围。
- 打印样式应接近高考试卷排版；交互按钮、弹窗、反馈和筛选控件不得出现在打印结果中。

接入 API 时，优先替换 composable 或新增数据服务适配层，尽量保持页面组件的 props、事件和题目视图模型稳定。不要猜测接口地址、字段名、分页游标或鉴权方式；契约不明确时先报告需要确认的内容。

## 样式与交互

- 优先复用现有 CSS 变量、字体、颜色和间距，不要引入第二套视觉体系。
- 页面内容应有合理的最大宽度和左右留白，避免在宽屏上形成超长阅读行。
- 每次样式修改都要考虑桌面端、窄屏和打印模式。
- 操作按钮使用 `<button type="button">`，不要使用无语义元素模拟按钮。
- 弹窗应包含正确的 `role`、`aria-modal`、标题关联、Esc 关闭、焦点进入与恢复。
- 展开区域应维护 `aria-expanded` 和 `aria-controls`。
- 不新增失效的按钮；尚未实现的能力应禁用并明确说明，或展示真实的待接入状态。
- 用户界面文字使用简体中文；代码标识符使用清晰的英文名称。

## 修改边界

- 只修改完成当前任务所需的文件。
- 保留用户已有的未提交修改，不覆盖、不重置、不清理无关内容。
- 未经明确要求，不修改 `app.py`、数据库、旧模板或旧版静态前端。
- 未经明确要求，不安装新依赖、不更换框架、不调整构建工具。
- 不生成或提交 `dist/`、`node_modules/`、数据库、上传文件、日志或本地环境配置。
- 不使用 `git reset --hard`、强制推送或其他可能丢失工作的命令。
- 默认不切换分支、不提交、不推送；只有用户明确授权时才执行。

## 常用命令

以下命令默认从仓库根目录执行。Windows 环境优先使用 `npm.cmd`。

安装依赖（仅在确有需要并获得允许时）：

```powershell
npm.cmd --prefix frontend-vue install
```

启动开发服务器：

```powershell
npm.cmd --prefix frontend-vue run dev
```

生产构建：

```powershell
npm.cmd --prefix frontend-vue run build
```

只检查 ESLint，不自动修改文件：

```powershell
Set-Location frontend-vue
npm.cmd exec eslint -- --no-fix --no-cache src
```

检查指定文件的格式，不自动修改：

```powershell
Set-Location frontend-vue
npm.cmd exec prettier -- --check src/path/to/file.vue
```

注意：当前 `npm run lint` 脚本包含 `--fix`，会自动改写文件。只做检查时不要直接运行它。

Git 空白错误检查：

```powershell
git diff --check
git diff --cached --check
```

## 验证要求

根据改动风险选择验证范围，但至少执行与修改相关的检查。

- Vue 或 JavaScript 修改：对相关文件运行无修复 ESLint。
- Vue 单文件组件修改：确认 SFC 模板能够编译。
- CSS 修改：运行 Prettier 检查，并确认 CSS 能被解析。
- 跨组件功能：运行生产构建。
- 路由修改：直接访问目标 URL，并刷新页面确认 history fallback 正常。
- `localStorage` 功能：验证首次使用、刷新保留、异常存储值和不可用时的降级。
- 打印功能：验证单题、批量、PDF 入口以及所有打印内容开关。
- 响应式修改：至少检查桌面宽屏、约 1200px、约 700px 和手机宽度。

题库页核心人工检查清单：

1. 筛选、排序和清空条件。
2. 完整/简略视图切换。
3. 无限加载与加载结束状态。
4. 单题和批量选择。
5. 打印范围、导出菜单和操作反馈。
6. 已做、收藏及其可配置二次确认。
7. 题解展开、关闭和键盘操作。
8. 刷新页面后的偏好保留。

如果完整检查发现与本次改动无关的既有问题，应明确记录，不要为了让检查变绿而顺手修改无关文件。

## Git 协作

- 开始工作前运行 `git status --short --branch`。
- 暂存前再次检查文件范围，优先使用限定路径的 `git add -- <path>`。
- 提交前运行 `git diff --cached --check` 和 `git diff --cached --name-status`。
- 功能分支使用描述实际范围的名称，例如 `feature/qilai-vue-problem-bank`。
- 提交信息使用简短的 Conventional Commit 风格，例如：

```text
feat: add Vue problem bank page prototype
fix: keep problem filters in sync with route query
style: refine problem print layout
```

- 推送后比较 `git rev-parse HEAD` 与远程跟踪分支哈希，确认提交确实到达远程。
- 未经明确授权，不删除远程分支、不合并主分支、不创建或更新 Pull Request。

## 交付说明

完成一个修改步骤后，用适合初学者理解的语言说明：

1. 修改了哪些文件。
2. 为什么这样修改。
3. 使用了哪些 Vue 或 Web 语法。
4. 如何运行和检查。
5. 是否执行了 Git 提交或推送。

若任务只要求检查或制定计划，不得修改文件。若后端或 API 契约尚未确定，应清楚区分“当前前端原型”和“接入后端后的正式实现”。
