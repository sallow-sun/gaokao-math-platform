# MathSea 前端

Vue 3 + JavaScript + Vite，数学内容使用 KaTeX。必须从完整仓库构建；默认 TAG 数据引用后端的规范 JSON。

```sh
npm ci
npm run dev
```

开发地址 `http://localhost:5173`，API/图片请求代理至 `http://127.0.0.1:8080`。

```sh
npx playwright install chromium
npm run lint
npm test
npm run test:browser
npm run build
```

使用 Node.js 22.18+（22.x）；Linux 浏览器依赖安装、可选 CHROME_EXECUTABLE、目录与缓存约定详见 [开发交接](../docs/DEVELOPMENT.md)。构建输出 `dist/`，不要提交。上传规则及管理员说明在 `public/docs/`。
