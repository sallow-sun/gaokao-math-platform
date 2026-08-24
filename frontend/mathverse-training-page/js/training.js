/* ==================== 题单页面交互脚本 ==================== */

/*
 * 使用说明：
 * 1. 本文件已随完整压缩包以 training.js 格式提供，无需修改后缀。
 * 2. 本脚本不依赖第三方库，可直接配合 training.html 使用。
 */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const tabButtons = Array.from(
      document.querySelectorAll(".training-main-tab[data-training-tab]")
    );
    const tabPanels = Array.from(
      document.querySelectorAll(".training-tab-panel[data-training-panel]")
    );
    const seriesButtons = Array.from(
      document.querySelectorAll(".training-series-tab[data-series-target]")
    );
    const officialCards = Array.from(
      document.querySelectorAll("[data-official-grid] [data-training-card]")
    );
    const officialCount = document.getElementById("official-training-count");
    const openSquareButton = document.querySelector("[data-open-square]");

    /* 主菜单缺失时停止初始化，避免脚本影响页面中的其他模块。 */
    if (tabButtons.length === 0 || tabPanels.length === 0) {
      return;
    }

    const validTabs = tabButtons.map(function (button) {
      return button.dataset.trainingTab;
    });

    /* ==================== 主菜单切换 ==================== */

    function setActiveTab(tabName, shouldUpdateHash) {
      const targetName = validTabs.includes(tabName) ? tabName : "official";

      tabButtons.forEach(function (button) {
        const isActive = button.dataset.trainingTab === targetName;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        button.tabIndex = isActive ? 0 : -1;
      });

      tabPanels.forEach(function (panel) {
        panel.hidden = panel.dataset.trainingPanel !== targetName;
      });

      if (shouldUpdateHash) {
        window.history.replaceState(null, "", "#" + targetName);
      }
    }

    tabButtons.forEach(function (button, buttonIndex) {
      button.addEventListener("click", function () {
        setActiveTab(button.dataset.trainingTab, true);
      });

      /* 左右方向键可以在三个菜单间移动，行为与标准标签页一致。 */
      button.addEventListener("keydown", function (event) {
        let nextIndex = buttonIndex;

        if (event.key === "ArrowRight") {
          nextIndex = (buttonIndex + 1) % tabButtons.length;
        } else if (event.key === "ArrowLeft") {
          nextIndex = (buttonIndex - 1 + tabButtons.length) % tabButtons.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = tabButtons.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        tabButtons[nextIndex].focus();
        setActiveTab(tabButtons[nextIndex].dataset.trainingTab, true);
      });
    });

    window.addEventListener("hashchange", function () {
      setActiveTab(window.location.hash.slice(1), false);
    });

    if (openSquareButton) {
      openSquareButton.addEventListener("click", function () {
        setActiveTab("square", true);
        document.getElementById("training-tab-square").focus();
      });
    }

    /* ==================== 官方题单专题筛选 ==================== */

    function setActiveSeries(seriesName) {
      let visibleCount = 0;

      seriesButtons.forEach(function (button) {
        const isActive = button.dataset.seriesTarget === seriesName;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });

      officialCards.forEach(function (card) {
        const shouldShow = seriesName === "all" || card.dataset.series === seriesName;
        card.hidden = !shouldShow;

        if (shouldShow) {
          visibleCount += 1;
        }
      });

      if (officialCount) {
        officialCount.textContent = "共 " + visibleCount + " 份";
      }
    }

    seriesButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setActiveSeries(button.dataset.seriesTarget);
      });
    });

    /* 满进度题单使用实心圆环，避免在 HTML 中重复维护状态类。 */
    document.querySelectorAll(".training-card-progress").forEach(function (progress) {
      const progressValue = Number(progress.style.getPropertyValue("--progress"));
      progress.classList.toggle("is-complete", progressValue >= 100);
    });

    setActiveSeries("all");
    setActiveTab(window.location.hash.slice(1), false);
  });
})();
