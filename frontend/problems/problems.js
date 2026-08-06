/* ==================== 题库页面交互脚本 ==================== */

/*
 * 使用说明：
 * 1. 为避免下载 JavaScript 文件时出现异常，本文件以 .txt 格式提供。
 * 2. 使用前请将文件名由 problems.txt 改为 problems.js。
 * 3. 本脚本不依赖第三方库，可直接配合 problems.html 使用。
 */

(function () {
  "use strict";

  /* 页面状态在本地保存时使用独立键名，避免与网站其他页面冲突。 */
  const STORAGE_KEYS = {
    activeView: "problem-bank-active-view",
    practiceList: "problem-bank-practice-list"
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
    const filterForm = document.getElementById("problem-filter-form");
    const sortOrder = document.getElementById("sort-order");
    const problemCount = document.getElementById("problem-count");
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

    const savedView = readLocalStorage(STORAGE_KEYS.activeView, "list-view");

    /* ==================== 批量选择与跨视图同步 ==================== */

    const batchToggle = document.getElementById("batch-select-toggle");
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

    function setBatchMode(isActive) {
      document.body.classList.toggle("is-batch-selecting", isActive);

      if (batchToggle) {
        batchToggle.setAttribute("aria-pressed", String(isActive));
        batchToggle.textContent = isActive ? "退出批量" : "批量选中";
      }

      if (batchToolbar) {
        batchToolbar.hidden = !isActive;
      }

      [batchPrint, batchAddToList].forEach(function (button) {
        if (button) {
          button.hidden = !isActive;
        }
      });

      document.querySelectorAll(".bank-result-problem-select").forEach(function (label) {
        label.hidden = !isActive;
      });

      /* 退出批量模式时清空选择，防止隐藏状态下仍保留误操作对象。 */
      if (!isActive) {
        clearSelection();
      }

      updateBatchControls();
    }

    if (batchToggle) {
      batchToggle.addEventListener("click", function () {
        const isActive = batchToggle.getAttribute("aria-pressed") === "true";
        setBatchMode(!isActive);
      });
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

    setBatchMode(false);
    /* 批量控件完成初始化后再恢复视图，避免初始化期间读取尚未建立的选择状态。 */
    setActiveView(savedView === "preview-view" ? "preview-view" : "list-view", false);

    /* ==================== 关键词与条件筛选 ==================== */

    function normalizeText(value) {
      return String(value || "").trim().toLocaleLowerCase("zh-CN");
    }

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
        problemCount.textContent = String(matchedIds.size);
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
        window.requestAnimationFrame(applyFilters);
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
      document.querySelectorAll(".bank-result-problem-panel-view-card-footer button")
    );

    function updatePracticeButtons() {
      practiceButtons.forEach(function (button) {
        const card = button.closest("[data-problem-id]");
        const problemId = card ? card.dataset.problemId : "";
        const isAdded = practiceList.has(problemId);

        button.disabled = isAdded;
        button.textContent = isAdded ? "已加入练习清单" : "加入练习清单";
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
        showFeedback("已将 " + newlyAddedIds.length + " 道题目加入练习清单");
      } else {
        showFeedback("所选题目已在练习清单中");
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

    /* ==================== 批量打印 ==================== */

    function finishSelectionPrint() {
      document.body.classList.remove("is-printing-selection");
      document.querySelectorAll(".is-selected-for-print").forEach(function (element) {
        element.classList.remove("is-selected-for-print");
      });
    }

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

        document.body.classList.add("is-printing-selection");
        window.print();
      });
    }

    window.addEventListener("afterprint", finishSelectionPrint);

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
