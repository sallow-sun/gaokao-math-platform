/* ==================== 极简首页交互脚本 ==================== */

/*
 * 使用说明：
 * 1. 普通版主页地址写在 index.html 的 data-normal-home-url 中。
 * 2. 随机跳题的题号和地址模板写在 index.html 的 body 数据属性中。
 * 3. 背景和夜间模式只保存在当前浏览器，不会上传到网站。
 * 4. 本脚本不依赖第三方库，可直接配合 index.html 使用。
 */

(function () {
  "use strict";

  const STORAGE_KEYS = {
    theme: "mathverse-home-theme",
    background: "mathverse-home-background",
    lastRandomProblem: "mathverse-home-last-random-problem"
  };

  /* 浏览器禁止本地存储时返回空值，不影响页面的当前使用。 */
  function readSetting(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function saveSetting(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const modeToggle = document.querySelector("[data-home-mode-toggle]");
    const randomProblemButton = document.querySelector("[data-random-problem]");
    const settingsToggle = document.querySelector("[data-settings-toggle]");
    const settingsMenu = document.querySelector("[data-settings-menu]");
    const backgroundPicker = document.querySelector("[data-background-picker]");
    const backgroundInput = document.querySelector("[data-background-input]");
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const status = document.querySelector("[data-home-status]");

    function announce(message) {
      if (status) {
        status.textContent = message;
      }
    }

    function applyTheme(theme, shouldSave) {
      const isDark = theme === "dark";

      document.documentElement.dataset.theme = isDark ? "dark" : "light";

      if (themeToggle) {
        themeToggle.textContent = "夜间模式：" + (isDark ? "开" : "关");
        themeToggle.setAttribute("aria-pressed", String(isDark));
      }

      if (shouldSave) {
        saveSetting(STORAGE_KEYS.theme, isDark ? "dark" : "light");
      }
    }

    function applyBackground(imageData, shouldSave) {
      document.body.style.setProperty("--home-background-image", 'url("' + imageData + '")');
      document.body.dataset.hasBackground = "true";

      if (shouldSave) {
        return saveSetting(STORAGE_KEYS.background, imageData);
      }

      return true;
    }

    function closeSettingsMenu(shouldReturnFocus) {
      if (!settingsToggle || !settingsMenu) {
        return;
      }

      settingsMenu.hidden = true;
      settingsToggle.setAttribute("aria-expanded", "false");

      if (shouldReturnFocus) {
        settingsToggle.focus();
      }
    }

    /* 读取并恢复当前浏览器保存的界面设置。 */
    applyTheme(readSetting(STORAGE_KEYS.theme) === "dark" ? "dark" : "light", false);

    const savedBackground = readSetting(STORAGE_KEYS.background);
    if (savedBackground.indexOf("data:image/") === 0) {
      applyBackground(savedBackground, false);
    }

    if (modeToggle) {
      modeToggle.addEventListener("change", function () {
        if (!modeToggle.checked) {
          return;
        }

        const normalHomeUrl = document.body.dataset.normalHomeUrl;

        /* 地址尚未配置时恢复极简状态，不跳转到无效页面。 */
        if (!normalHomeUrl) {
          modeToggle.checked = false;
          return;
        }

        window.location.assign(normalHomeUrl);
      });
    }

    if (randomProblemButton) {
      randomProblemButton.addEventListener("click", function () {
        const problemIds = (document.body.dataset.randomProblemIds || "")
          .split(",")
          .map(function (problemId) {
            return problemId.trim();
          })
          .filter(Boolean);
        const urlTemplate = document.body.dataset.randomProblemUrlTemplate || "";

        /* 配置不完整时退回题库，避免按钮跳转到无效地址。 */
        if (!problemIds.length || urlTemplate.indexOf("{problemId}") === -1) {
          window.location.assign("problems.html");
          return;
        }

        const lastProblemId = readSetting(STORAGE_KEYS.lastRandomProblem);
        const availableIds = problemIds.length > 1
          ? problemIds.filter(function (problemId) {
            return problemId !== lastProblemId;
          })
          : problemIds;
        const randomIndex = Math.floor(Math.random() * availableIds.length);
        const problemId = availableIds[randomIndex];
        const problemUrl = urlTemplate.replace("{problemId}", encodeURIComponent(problemId));

        saveSetting(STORAGE_KEYS.lastRandomProblem, problemId);
        window.location.assign(problemUrl);
      });
    }

    if (settingsToggle && settingsMenu) {
      settingsToggle.addEventListener("click", function () {
        const willOpen = settingsMenu.hidden;

        settingsMenu.hidden = !willOpen;
        settingsToggle.setAttribute("aria-expanded", String(willOpen));
      });

      /* 点击菜单之外的区域时，按照 Google 的方式收起菜单。 */
      document.addEventListener("pointerdown", function (event) {
        if (!event.target.closest(".home-settings")) {
          closeSettingsMenu(false);
        }
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !settingsMenu.hidden) {
          closeSettingsMenu(true);
        }
      });
    }

    if (backgroundPicker && backgroundInput) {
      backgroundPicker.addEventListener("click", function () {
        closeSettingsMenu(false);
        backgroundInput.click();
      });

      backgroundInput.addEventListener("change", function () {
        const imageFile = backgroundInput.files && backgroundInput.files[0];

        if (!imageFile || imageFile.type.indexOf("image/") !== 0) {
          return;
        }

        const reader = new FileReader();

        reader.addEventListener("load", function () {
          const imageData = typeof reader.result === "string" ? reader.result : "";

          if (!imageData) {
            announce("未能读取所选背景图片");
            return;
          }

          const isSaved = applyBackground(imageData, true);
          announce(isSaved ? "背景图片已更换" : "背景图片已应用，但浏览器无法长期保存这张图片");
        });

        reader.readAsDataURL(imageFile);
        backgroundInput.value = "";
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener("click", function () {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";

        applyTheme(nextTheme, true);
        announce(nextTheme === "dark" ? "夜间模式已开启" : "夜间模式已关闭");
      });
    }
  });
})();
