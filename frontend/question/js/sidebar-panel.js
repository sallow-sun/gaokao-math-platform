"use strict";

/* 新增：等待 HTML 解析完成后，为所有侧栏展开项绑定通用交互。 */
document.addEventListener("DOMContentLoaded", function () {
  /* 新增：只处理已经通过 aria-controls 关联内容区的展开按钮。 */
  const toggleButtons = document.querySelectorAll(
    ".sidebar-panel-toggle[aria-controls]"
  );

  /* 新增：每个按钮独立控制自己的内容区，互不影响。 */
  toggleButtons.forEach(function (toggleButton) {
    /* 新增：读取按钮所控制内容区域的 id。 */
    const contentId = toggleButton.getAttribute("aria-controls");

    /* 新增：根据 id 获取当前按钮对应的内容区域。 */
    const contentPanel = document.getElementById(contentId);

    /* 新增：获取按钮中需要随状态切换的文字节点。 */
    const toggleText = toggleButton.querySelector(
      ".sidebar-panel-toggle-text"
    );

    /* 新增：结构不完整时跳过当前按钮，避免影响页面其他功能。 */
    if (!contentPanel || !toggleText) {
      return;
    }

    /* 新增：读取 HTML 中配置的收起状态文案。 */
    const collapsedText =
      toggleButton.dataset.collapsedText || toggleText.textContent.trim();

    /* 新增：读取 HTML 中配置的展开状态文案。 */
    const expandedText =
      toggleButton.dataset.expandedText || "收起内容";

    /* 新增：集中同步内容显隐、按钮文案与无障碍状态。 */
    function setExpanded(isExpanded) {
      /* 新增：aria-expanded 同时供屏幕阅读器和 CSS 箭头样式读取。 */
      toggleButton.setAttribute("aria-expanded", String(isExpanded));

      /* 新增：使用原生 hidden 属性控制内容是否占据页面空间。 */
      contentPanel.hidden = !isExpanded;

      /* 新增：展开与收起时同步更新按钮的操作文案。 */
      toggleText.textContent = isExpanded ? expandedText : collapsedText;
    }

    /* 新增：根据 HTML 的 aria-expanded 初始化内容，防止状态不一致。 */
    setExpanded(toggleButton.getAttribute("aria-expanded") === "true");

    /* 新增：点击按钮时切换当前卡片的展开状态。 */
    toggleButton.addEventListener("click", function () {
      /* 新增：读取点击前的展开状态。 */
      const isExpanded =
        toggleButton.getAttribute("aria-expanded") === "true";

      /* 新增：把当前卡片切换为相反状态。 */
      setExpanded(!isExpanded);
    });
  });
});
