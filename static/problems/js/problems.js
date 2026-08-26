/* ==================== 题库页面交互脚本 ==================== */

/*
 * 使用说明：
 * 1. 本文件已随完整压缩包以 problems.js 格式提供，无需修改后缀。
 * 2. 本脚本不依赖第三方库，可直接配合 problems.html 使用。
 */

(function () {
  "use strict";

  /* 页面状态在本地保存时使用独立键名，避免与网站其他页面冲突。 */
  const STORAGE_KEYS = {
    activeView: "problem-bank-active-view",
    practiceList: "problem-bank-practice-list",
    displayOptions: "problem-bank-display-options"
  };

  /* 训练价值的排序顺序与筛选框中的文字层级保持一致。 */
  const LEVEL_ORDER = {
    basic: 1,
    typical: 2,
    important: 3,
    challenge: 4
  };

  document.addEventListener("DOMContentLoaded", function () {
    const listView = document.getElementById("list-view");
    const previewView = document.getElementById("preview-view");
    const views = [listView, previewView].filter(Boolean);

    /* 关键视图不存在时停止初始化，避免脚本影响页面中的其他模块。 */
    if (views.length !== 2) {
      return;
    }

    const viewButtons = Array.from(
      document.querySelectorAll(".bank-header-view-switch-button[data-view-target]")
    );
    const displayFilter = document.querySelector(".bank-display-filter");
    const displayFilterToggle = document.getElementById("bank-display-filter-toggle");
    const displayFilterPopover = document.getElementById("bank-display-filter-popover");
    const filterForm = document.getElementById("problem-filter-form");
    const sortOrder = document.getElementById("sort-order");
    const problemCount = document.getElementById("problem-count");
    const filterOptionButtons = Array.from(
      document.querySelectorAll(".bank-filter-options button[data-filter-name][data-filter-value]")
    );
    const listSortButtons = Array.from(
      document.querySelectorAll(".bank-result-problem-list-sort[data-list-sort]")
    );
    const listItems = Array.from(
      listView.querySelectorAll(".bank-result-problem-panel-view-item[data-problem-id]")
    );
    const allProblemElements = Array.from(
      document.querySelectorAll("[data-problem-id].bank-result-problem-panel-view-item, " +
        "[data-problem-id].bank-result-problem-panel-view-card")
    );
    const allCheckboxes = Array.from(
      document.querySelectorAll(".bank-result-problem-select-checkbox[data-problem-id]")
    );

    /* 同一道题在列表和预览视图中各有一个元素，这里按题号统一归组。 */
    const problemElementsById = new Map();
    allProblemElements.forEach(function (element, index) {
      const problemId = element.dataset.problemId;

      if (!problemElementsById.has(problemId)) {
        problemElementsById.set(problemId, []);
      }

      element.dataset.originalOrder = String(index);
      problemElementsById.get(problemId).push(element);
    });

    /* ==================== 通用状态与提示 ==================== */

    /* localStorage 在部分隐私模式下可能不可用，因此所有读写都进行容错。 */
    function readLocalStorage(key, fallbackValue) {
      try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallbackValue : value;
      } catch (error) {
        return fallbackValue;
      }
    }

    function writeLocalStorage(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        /* 本地保存失败不会阻断当前页面的筛选、切换和选择功能。 */
      }
    }

    /* 操作提示由脚本动态创建，避免为一个临时提示修改主体 HTML。 */
    const operationFeedback = document.createElement("p");
    operationFeedback.className = "bank-operation-feedback";
    operationFeedback.setAttribute("role", "status");
    operationFeedback.setAttribute("aria-live", "polite");
    operationFeedback.hidden = true;
    document.body.appendChild(operationFeedback);

    let feedbackTimer = 0;

    function showFeedback(message) {
      window.clearTimeout(feedbackTimer);
      operationFeedback.textContent = message;
      operationFeedback.hidden = false;

      window.requestAnimationFrame(function () {
        operationFeedback.classList.add("is-visible");
      });

      feedbackTimer = window.setTimeout(function () {
        operationFeedback.classList.remove("is-visible");

        window.setTimeout(function () {
          operationFeedback.hidden = true;
        }, 180);
      }, 1800);
    }

    /* ==================== 列表与预览模式切换 ==================== */

    function setActiveView(targetId, shouldSave) {
      const targetView = document.getElementById(targetId);

      if (!targetView || !views.includes(targetView)) {
        return;
      }

      views.forEach(function (view) {
        view.hidden = view.id !== targetId;
      });

      viewButtons.forEach(function (button) {
        const isActive = button.dataset.viewTarget === targetId;
        button.setAttribute("aria-pressed", String(isActive));
        button.classList.toggle("is-active", isActive);
      });

      if (displayFilter) {
        displayFilter.hidden = targetId !== "preview-view";
      }

      if (targetId !== "preview-view") {
        closeDisplayFilter();
      }

      if (shouldSave) {
        writeLocalStorage(STORAGE_KEYS.activeView, targetId);
      }

      updateBatchControls();
    }

    viewButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setActiveView(button.dataset.viewTarget, true);
      });
    });

    const savedView = readLocalStorage(STORAGE_KEYS.activeView, "preview-view");

    /* ==================== 完整模式展示筛选 ==================== */

    const DISPLAY_OPTION_NAMES = ["selection", "problem-id", "tags", "value", "source", "export"];
    const displayOptionControls = Array.from(
      document.querySelectorAll("[data-display-option-control]")
    );
    let displayOptions = DISPLAY_OPTION_NAMES.reduce(function (options, name) {
      options[name] = true;
      return options;
    }, {});

    try {
      const savedDisplayOptions = JSON.parse(
        readLocalStorage(STORAGE_KEYS.displayOptions, "{}")
      );

      DISPLAY_OPTION_NAMES.forEach(function (name) {
        if (typeof savedDisplayOptions[name] === "boolean") {
          displayOptions[name] = savedDisplayOptions[name];
        }
      });
    } catch (error) {
      /* 保存内容损坏时使用全部显示，不影响题目浏览。 */
    }

    function closeDisplayFilter() {
      if (!displayFilterToggle || !displayFilterPopover) {
        return;
      }

      displayFilterToggle.setAttribute("aria-expanded", "false");
      displayFilterPopover.hidden = true;
    }

    function applyDisplayOptions(shouldSave) {
      DISPLAY_OPTION_NAMES.forEach(function (name) {
        previewView.querySelectorAll('[data-display-option="' + name + '"]').forEach(function (element) {
          element.hidden = !displayOptions[name];
        });
      });

      displayOptionControls.forEach(function (control) {
        control.checked = displayOptions[control.dataset.displayOptionControl];
      });

      previewView.classList.toggle(
        "is-minimal-display",
        !displayOptions.selection && !displayOptions.tags && !displayOptions.value
      );
      /* 单独隐藏选择框时同步收回预留列，避免题目标题被挤窄。 */
      previewView.classList.toggle("is-selection-hidden", !displayOptions.selection);

      if (shouldSave) {
        writeLocalStorage(STORAGE_KEYS.displayOptions, JSON.stringify(displayOptions));
      }
    }

    if (displayFilterToggle && displayFilterPopover) {
      displayFilterToggle.addEventListener("click", function () {
        const shouldOpen = displayFilterPopover.hidden;
        displayFilterPopover.hidden = !shouldOpen;
        displayFilterToggle.setAttribute("aria-expanded", String(shouldOpen));
      });

      displayFilterPopover.querySelectorAll("[data-display-filter-close]").forEach(function (button) {
        button.addEventListener("click", closeDisplayFilter);
      });

      displayOptionControls.forEach(function (control) {
        control.addEventListener("change", function () {
          displayOptions[control.dataset.displayOptionControl] = control.checked;
          applyDisplayOptions(true);
        });
      });

      const minimalButton = displayFilterPopover.querySelector("[data-display-minimal]");
      const showAllButton = displayFilterPopover.querySelector("[data-display-all]");

      if (minimalButton) {
        minimalButton.addEventListener("click", function () {
          DISPLAY_OPTION_NAMES.forEach(function (name) {
            displayOptions[name] = false;
          });
          applyDisplayOptions(true);
          showFeedback("已切换为最整洁显示");
        });
      }

      if (showAllButton) {
        showAllButton.addEventListener("click", function () {
          DISPLAY_OPTION_NAMES.forEach(function (name) {
            displayOptions[name] = true;
          });
          applyDisplayOptions(true);
          showFeedback("已恢复全部显示内容");
        });
      }
    }

    document.addEventListener("click", function (event) {
      if (displayFilter && !displayFilter.contains(event.target)) {
        closeDisplayFilter();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDisplayFilter();
      }
    });

    applyDisplayOptions(false);

    /* ==================== 批量选择与跨视图同步 ==================== */

    const batchToolbar = document.getElementById("batch-selection-toolbar");
    const batchSelectAll = document.getElementById("batch-select-all");
    const selectedProblemCount = document.getElementById("selected-problem-count");
    const batchClear = document.getElementById("batch-selection-clear");
    const batchPrint = document.getElementById("batch-print");
    const batchAddToList = document.getElementById("batch-add-to-list");
    const selectedProblemIds = new Set();

    function getActiveView() {
      return views.find(function (view) {
        return !view.hidden;
      }) || listView;
    }

    /* “全选本页”只处理当前筛选后仍可见的题目。 */
    function getVisibleProblemIds() {
      const visibleIds = new Set();

      getActiveView()
        .querySelectorAll("article[data-problem-id]")
        .forEach(function (article) {
          if (!article.hidden) {
            visibleIds.add(article.dataset.problemId);
          }
        });

      return Array.from(visibleIds);
    }

    function syncProblemSelection(problemId, isSelected) {
      allCheckboxes.forEach(function (checkbox) {
        if (checkbox.dataset.problemId === problemId) {
          checkbox.checked = isSelected;
        }
      });

      (problemElementsById.get(problemId) || []).forEach(function (element) {
        element.classList.toggle("is-selected", isSelected);
      });

      if (isSelected) {
        selectedProblemIds.add(problemId);
      } else {
        selectedProblemIds.delete(problemId);
      }
    }

    function updateBatchControls() {
      const visibleIds = getVisibleProblemIds();
      const visibleSelectedCount = visibleIds.filter(function (problemId) {
        return selectedProblemIds.has(problemId);
      }).length;
      const selectedCount = selectedProblemIds.size;

      if (selectedProblemCount) {
        selectedProblemCount.textContent = String(selectedCount);
      }

      /* 参考版列表始终显示选择框；只有选中题目后才展开批量命令。 */
      if (batchToolbar) {
        batchToolbar.hidden = selectedCount === 0;
      }

      if (batchSelectAll) {
        batchSelectAll.disabled = visibleIds.length === 0;
        batchSelectAll.checked = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
        batchSelectAll.indeterminate =
          visibleSelectedCount > 0 && visibleSelectedCount < visibleIds.length;
      }

      [batchClear, batchPrint, batchAddToList].forEach(function (button) {
        if (button) {
          button.disabled = selectedCount === 0;
        }
      });
    }

    function clearSelection() {
      Array.from(selectedProblemIds).forEach(function (problemId) {
        syncProblemSelection(problemId, false);
      });
      updateBatchControls();
    }

    allCheckboxes.forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        syncProblemSelection(checkbox.dataset.problemId, checkbox.checked);
        updateBatchControls();
      });
    });

    if (batchSelectAll) {
      batchSelectAll.addEventListener("change", function () {
        getVisibleProblemIds().forEach(function (problemId) {
          syncProblemSelection(problemId, batchSelectAll.checked);
        });
        updateBatchControls();
      });
    }

    if (batchClear) {
      batchClear.addEventListener("click", clearSelection);
    }

    /* 选择框始终可用，批量工具栏由选中数量自动控制。 */
    document.body.classList.add("is-batch-selecting");
    updateBatchControls();

    /* 批量控件完成初始化后再恢复视图，避免初始化期间读取尚未建立的选择状态。 */
    setActiveView(savedView === "list-view" ? "list-view" : "preview-view", false);

    /* ==================== 关键词与条件筛选 ==================== */

    function normalizeText(value) {
      return String(value || "").trim().toLocaleLowerCase("zh-CN");
    }

    /* 横向筛选按钮与隐藏字段保持同步，HTML 表单仍可按常规方式提交。 */
    function syncFilterOptionButtons() {
      filterOptionButtons.forEach(function (button) {
        const input = filterForm
          ? filterForm.elements.namedItem(button.dataset.filterName)
          : null;
        const isActive = Boolean(input) && String(input.value) === button.dataset.filterValue;

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    filterOptionButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        if (!filterForm) {
          return;
        }

        const input = filterForm.elements.namedItem(button.dataset.filterName);
        if (input) {
          input.value = button.dataset.filterValue;
          syncFilterOptionButtons();
        }
      });
    });

    function itemMatchesFilters(item, filters) {
      if (filters.keyword && !normalizeText(item.textContent).includes(filters.keyword)) {
        return false;
      }

      return ["year", "source", "type", "level"].every(function (field) {
        return !filters[field] || item.dataset[field] === filters[field];
      });
    }

    function applyFilters() {
      if (!filterForm) {
        return;
      }

      const formData = new FormData(filterForm);
      const filters = {
        keyword: normalizeText(formData.get("keyword")),
        year: String(formData.get("year") || ""),
        source: String(formData.get("source") || ""),
        type: String(formData.get("type") || ""),
        level: String(formData.get("level") || "")
      };
      const matchedIds = new Set();

      listItems.forEach(function (item) {
        if (itemMatchesFilters(item, filters)) {
          matchedIds.add(item.dataset.problemId);
        }
      });

      problemElementsById.forEach(function (elements, problemId) {
        elements.forEach(function (element) {
          element.hidden = !matchedIds.has(problemId);
        });
      });

      views.forEach(function (view) {
        view.dataset.empty = String(matchedIds.size === 0);
      });

      if (problemCount) {
        const hasActiveFilter = Object.values(filters).some(Boolean);
        const totalCount = Number(problemCount.dataset.totalCount) || matchedIds.size;
        const visibleCount = hasActiveFilter ? matchedIds.size : totalCount;

        problemCount.textContent = visibleCount.toLocaleString("zh-CN");
      }

      updateBatchControls();
    }

    if (filterForm) {
      filterForm.addEventListener("submit", function (event) {
        event.preventDefault();
        applyFilters();
      });

      filterForm.addEventListener("reset", function () {
        /* reset 事件发生时表单值尚未复原，下一帧再重新计算筛选结果。 */
        window.requestAnimationFrame(function () {
          ["year", "source", "type"].forEach(function (fieldName) {
            const input = filterForm.elements.namedItem(fieldName);
            if (input) {
              input.value = "";
            }
          });
          syncFilterOptionButtons();
          applyFilters();
        });
      });
    }

    /* ==================== 下拉框与标题栏排序 ==================== */

    function getSortValue(item, sortKey) {
      if (sortKey === "problem-id") {
        return Number(String(item.dataset.problemId || "").replace(/\D/g, "")) || 0;
      }

      if (sortKey === "year") {
        return Number(item.dataset.year) || 0;
      }

      if (sortKey === "level") {
        return LEVEL_ORDER[item.dataset.level] || 0;
      }

      return normalizeText(item.dataset[sortKey]);
    }

    function compareValues(firstValue, secondValue) {
      if (typeof firstValue === "number" && typeof secondValue === "number") {
        return firstValue - secondValue;
      }

      return String(firstValue).localeCompare(String(secondValue), "zh-CN");
    }

    function sortBothViews(sortKey, direction) {
      const directionFactor = direction === "descending" ? -1 : 1;

      views.forEach(function (view) {
        const articles = Array.from(view.querySelectorAll("article[data-problem-id]"));

        articles.sort(function (firstItem, secondItem) {
          const primaryResult = compareValues(
            getSortValue(firstItem, sortKey),
            getSortValue(secondItem, sortKey)
          );

          if (primaryResult !== 0) {
            return primaryResult * directionFactor;
          }

          /* 主字段相同时以题号升序作为稳定的第二排序条件。 */
          return compareValues(
            getSortValue(firstItem, "problem-id"),
            getSortValue(secondItem, "problem-id")
          );
        });

        articles.forEach(function (article) {
          view.appendChild(article);
        });
      });
    }

    function setSortIndicator(activeButton, direction) {
      listSortButtons.forEach(function (button) {
        button.removeAttribute("data-sort-direction");
        button.setAttribute("aria-pressed", "false");
      });

      if (activeButton) {
        activeButton.dataset.sortDirection = direction;
        activeButton.setAttribute("aria-pressed", "true");
      }
    }

    function removeCustomSortOption() {
      if (!sortOrder) {
        return;
      }

      const customOption = sortOrder.querySelector("option[data-custom-sort]");
      if (customOption) {
        customOption.remove();
      }
    }

    function syncSortSelect(sortKey, direction) {
      if (!sortOrder) {
        return;
      }

      removeCustomSortOption();

      const mappedValue =
        sortKey === "year"
          ? direction === "ascending" ? "oldest" : "newest"
          : sortKey === "level"
            ? direction === "ascending" ? "easy-first" : "hard-first"
            : "";

      if (mappedValue) {
        sortOrder.value = mappedValue;
        return;
      }

      /* 题号排序不在原下拉框中，临时增加一项以准确显示当前排序状态。 */
      const customOption = document.createElement("option");
      customOption.value = "custom-problem-id";
      customOption.dataset.customSort = "true";
      customOption.textContent = direction === "ascending" ? "题号升序" : "题号降序";
      sortOrder.appendChild(customOption);
      sortOrder.value = customOption.value;
    }

    function applySortOrder(value) {
      const sortMap = {
        newest: { key: "year", direction: "descending" },
        oldest: { key: "year", direction: "ascending" },
        "easy-first": { key: "level", direction: "ascending" },
        "hard-first": { key: "level", direction: "descending" }
      };
      const sortState = sortMap[value] || sortMap.newest;
      const activeButton = listSortButtons.find(function (button) {
        return button.dataset.listSort === sortState.key;
      });

      removeCustomSortOption();
      sortBothViews(sortState.key, sortState.direction);
      setSortIndicator(activeButton, sortState.direction);
    }

    if (sortOrder) {
      sortOrder.addEventListener("change", function () {
        applySortOrder(sortOrder.value);
      });
    }

    listSortButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const previousDirection = button.dataset.sortDirection;
        const nextDirection = previousDirection === "ascending" ? "descending" : "ascending";

        sortBothViews(button.dataset.listSort, nextDirection);
        setSortIndicator(button, nextDirection);
        syncSortSelect(button.dataset.listSort, nextDirection);
      });
    });

    syncFilterOptionButtons();
    applyFilters();
    applySortOrder(sortOrder ? sortOrder.value : "newest");

    /* ==================== 练习清单 ==================== */

    let practiceList = new Set();

    try {
      const savedPracticeList = JSON.parse(
        readLocalStorage(STORAGE_KEYS.practiceList, "[]")
      );
      practiceList = new Set(Array.isArray(savedPracticeList) ? savedPracticeList : []);
    } catch (error) {
      practiceList = new Set();
    }

    const practiceButtons = Array.from(
      document.querySelectorAll(".bank-result-problem-panel-view-card-footer [data-add-to-list]")
    );

    function updatePracticeButtons() {
      practiceButtons.forEach(function (button) {
        const card = button.closest("[data-problem-id]");
        const problemId = card ? card.dataset.problemId : "";
        const isAdded = practiceList.has(problemId);

        button.disabled = isAdded;
        button.textContent = isAdded ? "已加入题单" : "加入题单";
      });
    }

    function addProblemsToPracticeList(problemIds) {
      const uniqueIds = Array.from(new Set(problemIds)).filter(Boolean);
      const newlyAddedIds = uniqueIds.filter(function (problemId) {
        return !practiceList.has(problemId);
      });

      newlyAddedIds.forEach(function (problemId) {
        practiceList.add(problemId);
      });

      writeLocalStorage(STORAGE_KEYS.practiceList, JSON.stringify(Array.from(practiceList)));
      updatePracticeButtons();

      /* 自定义事件为后续接入后端题单接口预留统一入口。 */
      document.dispatchEvent(
        new CustomEvent("problem-bank:add-to-list", {
          detail: {
            problemIds: uniqueIds,
            newlyAddedProblemIds: newlyAddedIds
          }
        })
      );

      if (newlyAddedIds.length > 0) {
        showFeedback("已将 " + newlyAddedIds.length + " 道题目加入题单");
      } else {
        showFeedback("所选题目已在题单中");
      }
    }

    practiceButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const card = button.closest("[data-problem-id]");
        if (card) {
          addProblemsToPracticeList([card.dataset.problemId]);
        }
      });
    });

    if (batchAddToList) {
      batchAddToList.addEventListener("click", function () {
        addProblemsToPracticeList(Array.from(selectedProblemIds));
      });
    }

    updatePracticeButtons();

    /* ==================== 单题打印与导出 ==================== */

    let titleBeforePrint = "";

    function finishPrint() {
      document.body.classList.remove("is-printing-single");
      document.body.classList.remove("is-printing-selection");
      document.querySelectorAll(".is-selected-for-print").forEach(function (element) {
        element.classList.remove("is-selected-for-print");
      });

      if (titleBeforePrint) {
        document.title = titleBeforePrint;
        titleBeforePrint = "";
      }
    }

    function getCardExportData(card) {
      const title = card.querySelector("h3");
      const type = card.querySelector(".bank-problem-meta > span:last-child");
      const content = card.querySelector(".bank-result-problem-panel-view-card-content .math-content");
      const source = card.querySelector('[data-display-option="source"]');

      return {
        problemId: card.dataset.problemId || "problem",
        title: title ? title.textContent.trim() : "题目",
        type: type ? type.textContent.trim() : "",
        content: content ? content.textContent.trim() : "",
        source: source ? source.textContent.trim() : ""
      };
    }

    function getSafeFileName(value) {
      return String(value || "题目")
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "题目";
    }

    function printSingleCard(card, forPdf) {
      finishPrint();
      titleBeforePrint = document.title;

      const data = getCardExportData(card);
      document.title = getSafeFileName(data.title);
      card.classList.add("is-selected-for-print");
      document.body.classList.add("is-printing-single");

      if (forPdf) {
        showFeedback("请在打印窗口中选择“另存为 PDF”");
      }

      window.setTimeout(function () {
        window.print();
      }, 0);
    }

    function getPlainText(data) {
      return [
        data.title,
        data.type ? "题型：" + data.type : "",
        data.source ? "来源：" + data.source : "",
        "",
        data.content
      ].filter(function (line, index, lines) {
        return line || (index > 0 && index < lines.length - 1);
      }).join("\n");
    }

    function getMarkdown(data) {
      return [
        "## " + data.title,
        "",
        data.type ? "**题型：** " + data.type : "",
        data.source ? "**来源：** " + data.source : "",
        "",
        data.content
      ].filter(function (line, index, lines) {
        return line || (index > 0 && index < lines.length - 1);
      }).join("\n");
    }

    function escapeLatex(value) {
      const replacements = {
        "\\": "\\textbackslash{}",
        "#": "\\#",
        "$": "\\$",
        "%": "\\%",
        "&": "\\&",
        "_": "\\_",
        "{": "\\{",
        "}": "\\}",
        "^": "\\textasciicircum{}",
        "~": "\\textasciitilde{}"
      };

      return String(value || "").replace(/[\\#$%&_{}^~]/g, function (character) {
        return replacements[character];
      });
    }

    function getLatex(data) {
      const body = data.content
        .split("\n")
        .map(escapeLatex)
        .join("\\\\\n");

      return [
        "\\subsection*{" + escapeLatex(data.title) + "}",
        data.type ? "\\textbf{题型：" + escapeLatex(data.type) + "}" : "",
        data.source ? "\\textbf{来源：" + escapeLatex(data.source) + "}" : "",
        "",
        body
      ].filter(Boolean).join("\n\n");
    }

    function copyText(value) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(value);
      }

      return new Promise(function (resolve, reject) {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();

        try {
          const copied = document.execCommand("copy");
          textArea.remove();
          copied ? resolve() : reject(new Error("copy failed"));
        } catch (error) {
          textArea.remove();
          reject(error);
        }
      });
    }

    function getCanvasLines(context, value, maxWidth) {
      const lines = [];

      String(value || "").split("\n").forEach(function (paragraph) {
        if (!paragraph) {
          lines.push("");
          return;
        }

        let line = "";
        Array.from(paragraph).forEach(function (character) {
          const nextLine = line + character;

          if (line && context.measureText(nextLine).width > maxWidth) {
            lines.push(line);
            line = character;
          } else {
            line = nextLine;
          }
        });
        lines.push(line);
      });

      return lines;
    }

    /* 图片采用浏览器原生 Canvas 生成，页面离线打开时也可使用。 */
    function exportCardAsImage(card) {
      const data = getCardExportData(card);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        showFeedback("当前浏览器不支持图片导出");
        return;
      }

      const width = 1400;
      const horizontalPadding = 76;
      const contentWidth = width - horizontalPadding * 2;
      context.font = '26px "Noto Serif SC", "Songti SC", SimSun, serif';
      const bodyLines = getCanvasLines(context, data.content, contentWidth);
      const height = Math.max(520, 255 + bodyLines.length * 46 + 80);

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "#d6dfe6";
      context.lineWidth = 2;
      context.strokeRect(24, 24, width - 48, height - 48);

      context.fillStyle = "#092744";
      context.font = '700 36px "Noto Serif SC", "Songti SC", SimSun, serif';
      context.fillText(data.title, horizontalPadding, 105, contentWidth);

      context.fillStyle = "#526474";
      context.font = '20px "Noto Sans SC", "Microsoft YaHei", sans-serif';
      const meta = [data.type, data.source].filter(Boolean).join("  ·  ");
      context.fillText(meta, horizontalPadding, 153, contentWidth);

      context.strokeStyle = "#dce4ea";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(horizontalPadding, 188);
      context.lineTo(width - horizontalPadding, 188);
      context.stroke();

      context.fillStyle = "#172b3c";
      context.font = '26px "Noto Serif SC", "Songti SC", SimSun, serif';
      bodyLines.forEach(function (line, index) {
        context.fillText(line, horizontalPadding, 245 + index * 46, contentWidth);
      });

      function downloadImage(blob) {
        const link = document.createElement("a");
        link.download = getSafeFileName(data.title) + ".png";
        link.href = URL.createObjectURL(blob);
        link.click();
        window.setTimeout(function () {
          URL.revokeObjectURL(link.href);
        }, 1000);
        showFeedback("题目图片已导出");
      }

      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) {
            downloadImage(blob);
          }
        }, "image/png");
      } else {
        const link = document.createElement("a");
        link.download = getSafeFileName(data.title) + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        showFeedback("题目图片已导出");
      }
    }

    function closeExportMenus(exceptMenu) {
      document.querySelectorAll(".bank-problem-export-menu").forEach(function (menu) {
        const shouldKeepOpen = menu === exceptMenu;
        menu.hidden = !shouldKeepOpen;

        const toggle = menu.parentElement.querySelector("[data-export-toggle]");
        if (toggle) {
          toggle.setAttribute("aria-expanded", String(shouldKeepOpen));
        }
      });
    }

    document.querySelectorAll("[data-card-print]").forEach(function (button) {
      button.addEventListener("click", function () {
        const card = button.closest(".bank-result-problem-panel-view-card");
        if (card) {
          printSingleCard(card, false);
        }
      });
    });

    document.querySelectorAll("[data-export-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        const menu = button.parentElement.querySelector(".bank-problem-export-menu");
        const shouldOpen = menu && menu.hidden;
        closeExportMenus(shouldOpen ? menu : null);
      });
    });

    document.querySelectorAll("[data-export-format]").forEach(function (button) {
      button.addEventListener("click", function () {
        const card = button.closest(".bank-result-problem-panel-view-card");
        const format = button.dataset.exportFormat;

        closeExportMenus();
        if (!card) {
          return;
        }

        const data = getCardExportData(card);

        if (format === "pdf") {
          printSingleCard(card, true);
        } else if (format === "image") {
          exportCardAsImage(card);
        } else {
          const copyValue =
            format === "markdown"
              ? getMarkdown(data)
              : format === "latex"
                ? getLatex(data)
                : getPlainText(data);

          copyText(copyValue)
            .then(function () {
              const formatNames = { markdown: "Markdown", latex: "LaTeX", text: "纯文本" };
              showFeedback("已按" + formatNames[format] + "格式复制");
            })
            .catch(function () {
              showFeedback("复制失败，请检查浏览器剪贴板权限");
            });
        }
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".bank-problem-export")) {
        closeExportMenus();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeExportMenus();
      }
    });

    /* ==================== 批量打印 ==================== */

    if (batchPrint) {
      batchPrint.addEventListener("click", function () {
        if (selectedProblemIds.size === 0) {
          return;
        }

        previewView
          .querySelectorAll(".bank-result-problem-panel-view-card[data-problem-id]")
          .forEach(function (card) {
            card.classList.toggle(
              "is-selected-for-print",
              selectedProblemIds.has(card.dataset.problemId)
            );
          });

        titleBeforePrint = document.title;
        document.title = "题库-所选题目";
        document.body.classList.add("is-printing-selection");
        window.print();
      });
    }

    window.addEventListener("afterprint", finishPrint);

    /* ==================== 分页按钮 ==================== */

    const pagination = document.querySelector(".bank-pagination");

    if (pagination) {
      const pageLinks = Array.from(pagination.querySelectorAll("a"));
      const pageButtons = Array.from(pagination.querySelectorAll("button"));
      const previousButton = pageButtons[0];
      const nextButton = pageButtons[pageButtons.length - 1];
      const pageFromUrl = new URL(window.location.href).searchParams.get("page") || "1";
      let currentPageIndex = pageLinks.findIndex(function (link) {
        return normalizeText(link.textContent) === normalizeText(pageFromUrl);
      });

      if (currentPageIndex < 0) {
        currentPageIndex = 0;
      }

      pageLinks.forEach(function (link, index) {
        if (index === currentPageIndex) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });

      if (previousButton) {
        previousButton.disabled = currentPageIndex === 0;
        previousButton.addEventListener("click", function () {
          const previousLink = pageLinks[currentPageIndex - 1];
          if (previousLink) {
            window.location.assign(previousLink.href);
          }
        });
      }

      if (nextButton) {
        nextButton.disabled = currentPageIndex >= pageLinks.length - 1;
        nextButton.addEventListener("click", function () {
          const nextLink = pageLinks[currentPageIndex + 1];
          if (nextLink) {
            window.location.assign(nextLink.href);
          }
        });
      }
    }
  });
})();
