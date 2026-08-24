/* ==================== 题库筛选区独立脚本 ==================== */

/*
 * 接入方式：
 * 1. 用 problem-filter-section.html 替换原页面的筛选区。
 * 2. 在原 problems.js 之后加载本文件。
 * 3. 本组件使用新的表单 id 和 data 属性，因此原 problems.js 中旧筛选代码会自动停止工作，
 *    列表/预览、排序、题单和打印等其他功能不受影响。
 */

(function () {
  "use strict";

  const FILTER_FIELDS = ["year", "source", "type", "level"];

  const STORAGE_KEYS = {
    mode: "problem-bank-filter-mode-v2",
    pinned: "problem-bank-filter-pinned-v2"
  };

  /* 兼容上一版题目数据中的训练价值名称；新题目可直接使用颜色值。 */
  const LEVEL_EQUIVALENTS = {
    red: ["red", "basic"],
    orange: ["orange"],
    yellow: ["yellow", "typical"],
    green: ["green", "challenge"],
    cyan: ["cyan"],
    blue: ["blue", "important"],
    purple: ["purple"],
    black: ["black"],
    white: ["white"]
  };

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  onReady(function initializeProblemBankFilter() {
    const form = document.getElementById("problem-bank-filter-form");

    if (!form || form.dataset.filterInitialized === "true") {
      return;
    }

    form.dataset.filterInitialized = "true";

    const panel = form.closest(".bank-filter-panel");
    const groups = new Map();
    const selections = {};
    const pinnedValues = {};
    let openPopoverField = "";
    let openPopoverTrigger = null;

    FILTER_FIELDS.forEach(function (field) {
      const group = form.querySelector('[data-filter-group="' + field + '"]');

      if (group) {
        groups.set(field, group);
      }

      selections[field] = new Set();
      pinnedValues[field] = new Set();
    });

    buildYearCatalog();

    const savedMode = readStorage(STORAGE_KEYS.mode, form.dataset.filterMode || "single");
    let filterMode = savedMode === "multiple" ? "multiple" : "single";
    const savedPinned = readJsonStorage(STORAGE_KEYS.pinned, {});

    initializePinnedValues(savedPinned);
    initializeSelectionsFromInputs();
    renderAllPinnedOptions();
    syncPinnedControls();
    syncFilterInterface();
    setFilterMode(filterMode, false);

    /* ==================== 本地设置 ==================== */

    function readStorage(key, fallbackValue) {
      try {
        const value = window.localStorage.getItem(key);
        return value === null ? fallbackValue : value;
      } catch (error) {
        return fallbackValue;
      }
    }

    function writeStorage(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        /* 浏览器禁止本地存储时，当前页面仍可正常筛选。 */
      }
    }

    function readJsonStorage(key, fallbackValue) {
      try {
        const parsedValue = JSON.parse(readStorage(key, ""));
        return parsedValue && typeof parsedValue === "object" ? parsedValue : fallbackValue;
      } catch (error) {
        return fallbackValue;
      }
    }

    function savePinnedValues() {
      const valueToSave = {};

      ["year", "source", "type"].forEach(function (field) {
        valueToSave[field] = Array.from(pinnedValues[field]);
      });

      writeStorage(STORAGE_KEYS.pinned, JSON.stringify(valueToSave));
    }

    /* ==================== 年份目录与常用标签 ==================== */

    function buildYearCatalog() {
      const yearGroup = groups.get("year");
      const catalog = yearGroup ? yearGroup.querySelector("[data-year-catalog]") : null;

      if (!catalog || catalog.children.length > 0) {
        return;
      }

      const startYear = Number(catalog.dataset.yearStart) || new Date().getFullYear();
      const endYear = Number(catalog.dataset.yearEnd) || startYear;
      const firstYear = Math.max(startYear, endYear);
      const lastYear = Math.min(startYear, endYear);
      const fragment = document.createDocumentFragment();

      fragment.appendChild(createCatalogItem("year", "", "全部", true));

      for (let year = firstYear; year >= lastYear; year -= 1) {
        fragment.appendChild(createCatalogItem("year", String(year), String(year), false));
      }

      catalog.appendChild(fragment);
    }

    function createCatalogItem(field, value, label, isAlwaysVisible) {
      const item = document.createElement("div");
      const choice = document.createElement("button");

      item.className = "bank-filter-catalog-item";
      choice.type = "button";
      choice.className = "bank-filter-catalog-choice";
      choice.dataset.filterChoice = "";
      choice.dataset.filterField = field;
      choice.dataset.filterValue = value;
      choice.setAttribute("aria-pressed", value === "" ? "true" : "false");
      choice.textContent = label;
      item.appendChild(choice);

      if (isAlwaysVisible) {
        const fixedLabel = document.createElement("span");
        fixedLabel.className = "bank-filter-pin-fixed";
        fixedLabel.textContent = "始终显示";
        item.appendChild(fixedLabel);
        return item;
      }

      const pinLabel = document.createElement("label");
      const pinInput = document.createElement("input");
      const pinText = document.createElement("span");

      pinLabel.className = "bank-filter-pin-control";
      pinInput.type = "checkbox";
      pinInput.dataset.filterPinField = field;
      pinInput.dataset.filterPinValue = value;
      pinText.textContent = "显示在筛选栏";
      pinLabel.append(pinInput, pinText);
      item.appendChild(pinLabel);

      return item;
    }

    function getCatalogChoices(field) {
      const group = groups.get(field);

      if (!group) {
        return [];
      }

      const popover = group.querySelector("[data-filter-popover]");

      return popover
        ? Array.from(popover.querySelectorAll("[data-filter-choice][data-filter-value]"))
        : [];
    }

    function getCatalogValues(field) {
      return getCatalogChoices(field)
        .map(function (choice) {
          return choice.dataset.filterValue;
        })
        .filter(Boolean);
    }

    function getDefaultPinnedValues(field) {
      const group = groups.get(field);
      const configuredValues = group
        ? String(group.dataset.defaultPinned || "").split(",").filter(Boolean)
        : [];
      const validValues = new Set(getCatalogValues(field));

      return configuredValues.filter(function (value) {
        return validValues.has(value);
      });
    }

    function initializePinnedValues(savedValue) {
      ["year", "source", "type"].forEach(function (field) {
        const validValues = new Set(getCatalogValues(field));
        const savedFieldValues = Array.isArray(savedValue[field])
          ? savedValue[field]
          : getDefaultPinnedValues(field);

        pinnedValues[field] = new Set(
          savedFieldValues.filter(function (value) {
            return validValues.has(value);
          })
        );
      });
    }

    function getCatalogLabel(field, value) {
      const choice = getCatalogChoices(field).find(function (catalogChoice) {
        return catalogChoice.dataset.filterValue === value;
      });

      return choice ? choice.textContent.trim() : value;
    }

    function renderPinnedOptions(field) {
      const group = groups.get(field);
      const mainOptions = group ? group.querySelector('[data-filter-main="' + field + '"]') : null;
      const moreButton = mainOptions ? mainOptions.querySelector('[data-filter-more="' + field + '"]') : null;

      if (!mainOptions || !moreButton) {
        return;
      }

      mainOptions.querySelectorAll("[data-filter-pinned-main]").forEach(function (button) {
        button.remove();
      });

      pinnedValues[field].forEach(function (value) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.filterChoice = "";
        button.dataset.filterField = field;
        button.dataset.filterValue = value;
        button.dataset.filterPinnedMain = "";
        button.setAttribute("aria-pressed", "false");
        button.textContent = getCatalogLabel(field, value);
        mainOptions.insertBefore(button, moreButton);
      });
    }

    function renderAllPinnedOptions() {
      ["year", "source", "type"].forEach(renderPinnedOptions);
    }

    function syncPinnedControls() {
      form.querySelectorAll("[data-filter-pin-field][data-filter-pin-value]").forEach(function (input) {
        const field = input.dataset.filterPinField;
        input.checked = Boolean(pinnedValues[field]) && pinnedValues[field].has(input.dataset.filterPinValue);
      });
    }

    /* ==================== 筛选状态 ==================== */

    function parseInputValues(input) {
      return String(input ? input.value : "")
        .split(",")
        .map(function (value) {
          return value.trim();
        })
        .filter(Boolean);
    }

    function initializeSelectionsFromInputs() {
      FILTER_FIELDS.forEach(function (field) {
        const input = form.elements.namedItem(field);
        selections[field] = new Set(parseInputValues(input));
      });
    }

    function syncHiddenInputs() {
      FILTER_FIELDS.forEach(function (field) {
        const input = form.elements.namedItem(field);

        if (input) {
          input.value = Array.from(selections[field]).join(",");
        }
      });

      const modeInput = form.elements.namedItem("filter_mode");

      if (modeInput) {
        modeInput.value = filterMode;
      }
    }

    function syncChoiceButtons() {
      form.querySelectorAll("[data-filter-choice][data-filter-field][data-filter-value]").forEach(function (button) {
        const field = button.dataset.filterField;
        const value = button.dataset.filterValue;
        const fieldSelection = selections[field];
        const isActive = Boolean(fieldSelection) && (
          value === "" ? fieldSelection.size === 0 : fieldSelection.has(value)
        );

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));

        const catalogItem = button.closest(".bank-filter-catalog-item");
        if (catalogItem) {
          catalogItem.classList.toggle("has-active-choice", isActive);
        }
      });
    }

    function syncMoreButtonCounts() {
      ["year", "source", "type"].forEach(function (field) {
        const group = groups.get(field);
        const moreButton = group ? group.querySelector('[data-filter-more="' + field + '"]') : null;

        if (!moreButton) {
          return;
        }

        const hiddenSelectedCount = Array.from(selections[field]).filter(function (value) {
          return !pinnedValues[field].has(value);
        }).length;
        const countElement = moreButton.querySelector("[data-filter-hidden-count]");

        moreButton.classList.toggle("has-hidden-selection", hiddenSelectedCount > 0);

        if (countElement) {
          countElement.textContent = String(hiddenSelectedCount);
          countElement.hidden = hiddenSelectedCount === 0;
        }
      });
    }

    function syncFilterInterface() {
      syncHiddenInputs();
      syncChoiceButtons();
      syncMoreButtonCounts();
    }

    function chooseFilterValue(field, value) {
      const fieldSelection = selections[field];

      if (!fieldSelection) {
        return;
      }

      if (value === "") {
        fieldSelection.clear();
      } else if (filterMode === "single") {
        fieldSelection.clear();
        fieldSelection.add(value);
      } else if (fieldSelection.has(value)) {
        fieldSelection.delete(value);
      } else {
        fieldSelection.add(value);
      }

      syncFilterInterface();
      applyFilters();
    }

    /* ==================== 单选 / 多选切换 ==================== */

    function setFilterMode(nextMode, shouldSave) {
      filterMode = nextMode === "multiple" ? "multiple" : "single";

      if (filterMode === "single") {
        FILTER_FIELDS.forEach(function (field) {
          const currentValues = Array.from(selections[field]);

          if (currentValues.length > 1) {
            selections[field] = new Set([currentValues[0]]);
          }
        });
      }

      form.dataset.filterMode = filterMode;

      const toggle = panel ? panel.querySelector("[data-filter-mode-toggle]") : null;
      const isMultiple = filterMode === "multiple";

      if (toggle) {
        toggle.checked = isMultiple;
        toggle.setAttribute("aria-checked", String(isMultiple));
        toggle.title = isMultiple
          ? "已允许同一筛选行选择多个条件"
          : "开启后，同一筛选行可以选择多个条件";
      }

      syncFilterInterface();

      if (shouldSave) {
        writeStorage(STORAGE_KEYS.mode, filterMode);
        applyFilters();
      }
    }

    const modeToggle = panel ? panel.querySelector("[data-filter-mode-toggle]") : null;

    if (modeToggle) {
      modeToggle.addEventListener("change", function () {
        setFilterMode(modeToggle.checked ? "multiple" : "single", true);
      });
    }

    /* ==================== 小窗打开、关闭与固定设置 ==================== */

    function closeFilterPopover(shouldRestoreFocus) {
      if (!openPopoverField) {
        return;
      }

      const group = groups.get(openPopoverField);
      const popover = group ? group.querySelector('[data-filter-popover="' + openPopoverField + '"]') : null;
      const trigger = openPopoverTrigger;

      if (popover) {
        popover.hidden = true;
      }

      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }

      openPopoverField = "";
      openPopoverTrigger = null;

      if (shouldRestoreFocus && trigger) {
        trigger.focus();
      }
    }

    function openFilterPopover(field, trigger) {
      if (openPopoverField === field) {
        closeFilterPopover(false);
        return;
      }

      closeFilterPopover(false);

      const group = groups.get(field);
      const popover = group ? group.querySelector('[data-filter-popover="' + field + '"]') : null;

      if (!popover) {
        return;
      }

      popover.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      openPopoverField = field;
      openPopoverTrigger = trigger;

      const firstChoice = popover.querySelector("[data-filter-choice]");
      if (firstChoice) {
        firstChoice.focus({ preventScroll: true });
      }
    }

    form.querySelectorAll("[data-filter-more]").forEach(function (button) {
      button.addEventListener("click", function () {
        openFilterPopover(button.dataset.filterMore, button);
      });
    });

    form.querySelectorAll("[data-filter-popover-close]").forEach(function (button) {
      button.addEventListener("click", function () {
        closeFilterPopover(true);
      });
    });

    form.addEventListener("change", function (event) {
      const input = event.target.closest("[data-filter-pin-field][data-filter-pin-value]");

      if (!input || !form.contains(input)) {
        return;
      }

      const field = input.dataset.filterPinField;
      const value = input.dataset.filterPinValue;

      if (!pinnedValues[field]) {
        return;
      }

      if (input.checked) {
        pinnedValues[field].add(value);
      } else {
        pinnedValues[field].delete(value);
      }

      renderPinnedOptions(field);
      syncFilterInterface();
      savePinnedValues();
    });

    document.addEventListener("pointerdown", function (event) {
      if (!openPopoverField) {
        return;
      }

      const group = groups.get(openPopoverField);

      if (group && !group.contains(event.target)) {
        closeFilterPopover(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && openPopoverField) {
        event.preventDefault();
        closeFilterPopover(true);
      }
    });

    /* 事件代理可同时处理 HTML 中的按钮和脚本动态生成的常用标签。 */
    form.addEventListener("click", function (event) {
      const choice = event.target.closest("[data-filter-choice][data-filter-field][data-filter-value]");

      if (!choice || !form.contains(choice)) {
        return;
      }

      chooseFilterValue(choice.dataset.filterField, choice.dataset.filterValue);
    });

    /* ==================== 题目匹配与结果同步 ==================== */

    function normalizeText(value) {
      return String(value || "").trim().toLocaleLowerCase("zh-CN");
    }

    function splitDatasetValues(value) {
      return normalizeText(value).split(/[\s,|]+/).filter(Boolean);
    }

    function valueMatchesItem(field, selectedValue, item) {
      const itemValues = splitDatasetValues(item.dataset[field]);

      if (field !== "level") {
        return itemValues.includes(normalizeText(selectedValue));
      }

      const equivalentValues = LEVEL_EQUIVALENTS[selectedValue] || [selectedValue];

      return equivalentValues.some(function (value) {
        return itemValues.includes(value);
      });
    }

    function itemMatchesFilters(item, keyword) {
      if (keyword && !normalizeText(item.textContent).includes(keyword)) {
        return false;
      }

      return FILTER_FIELDS.every(function (field) {
        const selectedValues = Array.from(selections[field]);

        if (selectedValues.length === 0) {
          return true;
        }

        /* 同一行中的多个值使用 OR；不同 field 由 every() 连接为 AND。 */
        return selectedValues.some(function (value) {
          return valueMatchesItem(field, value, item);
        });
      });
    }

    function collectProblemElements() {
      const listView = document.getElementById("list-view");
      const previewView = document.getElementById("preview-view");
      const views = [listView, previewView].filter(Boolean);
      const listCandidates = listView
        ? Array.from(listView.querySelectorAll("[data-problem-id]"))
        : [];
      const listItems = [];
      const seenListIds = new Set();

      listCandidates.forEach(function (item) {
        const problemId = item.dataset.problemId;

        if (problemId && !seenListIds.has(problemId)) {
          seenListIds.add(problemId);
          listItems.push(item);
        }
      });

      const allElementsById = new Map();

      views.forEach(function (view) {
        view.querySelectorAll("[data-problem-id]").forEach(function (element) {
          const problemId = element.dataset.problemId;

          if (!allElementsById.has(problemId)) {
            allElementsById.set(problemId, []);
          }

          allElementsById.get(problemId).push(element);
        });
      });

      return { views: views, listItems: listItems, allElementsById: allElementsById };
    }

    function syncBatchSelectAll(views) {
      const selectAll = document.getElementById("batch-select-all");

      if (!selectAll) {
        return;
      }

      const activeView = views.find(function (view) {
        return !view.hidden;
      }) || views[0];

      if (!activeView) {
        selectAll.disabled = true;
        return;
      }

      const visibleProblemIds = new Set();

      activeView.querySelectorAll("[data-problem-id]").forEach(function (element) {
        if (!element.hidden && element.dataset.problemId) {
          visibleProblemIds.add(element.dataset.problemId);
        }
      });

      const checkedProblemIds = new Set();

      document.querySelectorAll(".bank-result-problem-select-checkbox[data-problem-id]:checked").forEach(function (checkbox) {
        checkedProblemIds.add(checkbox.dataset.problemId);
      });

      const visibleSelectedCount = Array.from(visibleProblemIds).filter(function (problemId) {
        return checkedProblemIds.has(problemId);
      }).length;

      selectAll.disabled = visibleProblemIds.size === 0;
      selectAll.checked = visibleProblemIds.size > 0 && visibleSelectedCount === visibleProblemIds.size;
      selectAll.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleProblemIds.size;
    }

    function getFiltersForEvent(keyword) {
      const filters = { keyword: keyword };

      FILTER_FIELDS.forEach(function (field) {
        filters[field] = Array.from(selections[field]);
      });

      return filters;
    }

    function applyFilters() {
      const keywordInput = form.elements.namedItem("keyword");
      const keyword = normalizeText(keywordInput ? keywordInput.value : "");
      const problemElements = collectProblemElements();
      const matchedIds = new Set();

      problemElements.listItems.forEach(function (item) {
        if (itemMatchesFilters(item, keyword)) {
          matchedIds.add(item.dataset.problemId);
        }
      });

      problemElements.allElementsById.forEach(function (elements, problemId) {
        elements.forEach(function (element) {
          element.hidden = !matchedIds.has(problemId);
        });
      });

      problemElements.views.forEach(function (view) {
        view.dataset.empty = String(matchedIds.size === 0);
      });

      const problemCount = document.getElementById("problem-count");

      if (problemCount) {
        const hasActiveFilter = keyword !== "" || FILTER_FIELDS.some(function (field) {
          return selections[field].size > 0;
        });
        const totalCount = Number(problemCount.dataset.totalCount) || problemElements.listItems.length;

        problemCount.textContent = (
          hasActiveFilter ? matchedIds.size : totalCount
        ).toLocaleString("zh-CN");
      }

      syncBatchSelectAll(problemElements.views);

      document.dispatchEvent(
        new CustomEvent("problem-bank:filter-applied", {
          detail: {
            mode: filterMode,
            filters: getFiltersForEvent(keyword),
            matchedProblemIds: Array.from(matchedIds)
          }
        })
      );
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      applyFilters();
    });

    form.addEventListener("reset", function (event) {
      event.preventDefault();

      FILTER_FIELDS.forEach(function (field) {
        selections[field].clear();
      });

      const keywordInput = form.elements.namedItem("keyword");
      if (keywordInput) {
        keywordInput.value = "";
      }

      closeFilterPopover(false);
      syncFilterInterface();
      applyFilters();
    });

    /* 初始化时显示完整结果，并同步旧版训练价值名称。 */
    applyFilters();
  });
})();
