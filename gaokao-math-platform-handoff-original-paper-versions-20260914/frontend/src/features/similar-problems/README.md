# 相似题推荐测试模块

## 页面入口

- 路由：`/similar-problems`
- 首页搜索框下方：`AI 同类题` 小按钮

## 文件说明

- `SimilarProblemsView.vue`：独立测试页面与交互流程。
- `similar-problems.css`：完全使用项目现有色彩、字体和布局变量的页面样式。
- `demoCorpus.js`：12 道演示候选题、3 道查询样例和方法策略字典。
- `featureNormalizer.js`：统一知识点、方法和题型词表，将 API 同义表达与离线识别映射到同一标签，并补齐标准策略骨架。
- `similarityEngine.js`：离线特征提取、策略骨架比较、负例惩罚、排序与置信度门槛。
- `featureApi.js`：可手动填写的 Chat Completions 接口；开发环境和生产环境均通过 MathSea 同源中转发送。
- `devProxyPlugin.mjs`：Vite 开发环境中转，仅允许 OpenAI、DeepSeek 与阿里云百炼的官方 HTTPS 地址。
- `similarityEngine.test.js`：核心排序回归测试。

## API 约定

测试页只把外部模型用于题干特征提取。模型应通过 `choices[0].message.content` 返回 JSON，字段包括知识点、方法标签、策略骨架、题型结构、难度与置信度。完整结构可在页面“查看模型输出约定”中展开。

离线模式不再读取演示题预先填写的标签。两种模式都从题干出发，并经过 `featureNormalizer.js` 的同一套标准化流程；API 提示词也要求优先返回标准标签。页面显示的百分比是排序匹配度，不是模型正确率。

API Key 只保存在当前 Vue 页面内存，不写入 localStorage、sessionStorage 或仓库。前端不会再直接访问模型厂商：开发环境发送到 `/__mathsea_similarity_proxy`，生产环境发送到 `/api/v1/ai/similarity/chat`，由同源中转转发，从而避开浏览器跨域限制。中转不会记录 Key，并限制可访问的厂商域名、HTTPS 协议与 `/chat/completions` 路径。

可在页面中选择以下预设后再填写各自的 API Key：

- DeepSeek：`https://api.deepseek.com/chat/completions`
- 阿里云百炼 Qwen：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- OpenAI：`https://api.openai.com/v1/chat/completions`

生产环境中转位于后端 `ai/similarity` 包。上线前还应根据正式会员体系增加登录校验、调用额度与限流；测试版保留用户自带 Key 的模式。

## 与真实题库的下一步连接

当前候选集是独立演示数据，不会冒充真实题库结果。下一阶段应在后端为已发布题目预计算同一套策略特征与向量，建立混合召回接口，再用真实题目替换 `SIMILARITY_DEMO_CORPUS`。低于质量门槛时接口应返回空结果，不能用弱相关题目补足数量。
