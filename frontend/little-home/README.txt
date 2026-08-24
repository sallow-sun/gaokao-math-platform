mathverse 极简首页接入说明

1. 默认入口为 index.html，页面包含文本 Logo、搜索框、快捷按钮、主页模式开关和底栏。
2. 修改 Logo：编辑 index.html 中 <h1 class="home-logo"> 的文字。
3. 接入普通版主页：修改 <body> 的 data-normal-home-url，默认值为 home.html。
4. 接入题库搜索：修改搜索表单的 action、method 和输入框 name；当前会提交到 problems.html?keyword=搜索内容。
5. 随机跳题：在 <body> 的 data-random-problem-ids 中填写题号，并在 data-random-problem-url-template 中填写题目页地址格式。
6. 底栏链接：About 默认指向 about.html，使用帮助默认指向 help.html，可在对应 <a> 标签中修改。
7. 界面设置：背景图片和夜间模式保存在当前浏览器，不依赖后端，也不会上传图片。
8. css/themes.css 与题库页面共用同一套设计变量；合并项目时可直接复用项目中的同名文件。
