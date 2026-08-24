"use strict";

/* 修改：等待页面与外部组件解析完成后，初始化三种草稿编辑模式。 */
document.addEventListener("DOMContentLoaded", function () {
  /* 修改：统一获取草稿区需要使用的页面元素。 */
  const draftPanel = document.querySelector(".draft-panel[data-problem-id]");
  const modeTabs = Array.from(document.querySelectorAll("[data-draft-mode]"));
  const modePanels = Array.from(document.querySelectorAll("[data-draft-panel]"));
  const richEditor = document.getElementById("draft-rich-editor");
  const insertFormulaButton = document.getElementById("draft-insert-formula");
  const formulaInsertButtons = Array.from(
    document.querySelectorAll("[data-formula-insert]")
  );
  const richCommandButtons = Array.from(
    document.querySelectorAll("[data-rich-command]")
  );
  const latexSource = document.getElementById("draft-latex-source");
  const latexPreview = document.getElementById("draft-latex-preview");
  const latexInsertButtons = Array.from(
    document.querySelectorAll("[data-latex-insert]")
  );
  const drawingCanvas = document.getElementById("draft-handwriting-canvas");
  const drawingViewport = document.getElementById("draft-canvas-viewport");
  const drawingBoard = document.getElementById("draft-canvas-board");
  const drawingImageLayer = document.getElementById("draft-canvas-images");
  const drawingCursor = document.getElementById("draft-canvas-cursor");
  const drawingToolButtons = Array.from(
    document.querySelectorAll("[data-drawing-tool]")
  );
  const drawingColorButtons = Array.from(
    document.querySelectorAll("[data-ink-color-value]")
  );
  const inkColor = document.getElementById("draft-ink-color");
  const inkWidth = document.getElementById("draft-ink-width");
  const insertImageButton = document.getElementById("draft-insert-image");
  const imageInput = document.getElementById("draft-image-input");
  const drawingUndoButton = document.getElementById("draft-drawing-undo");
  const drawingRedoButton = document.getElementById("draft-drawing-redo");
  const drawingClearButton = document.getElementById("draft-drawing-clear");
  const zoomOutButton = document.getElementById("draft-zoom-out");
  const zoomInButton = document.getElementById("draft-zoom-in");
  const zoomResetButton = document.getElementById("draft-zoom-reset");
  const zoomValue = document.getElementById("draft-zoom-value");
  const saveState = document.getElementById("draft-save-state");
  const actionStatus = document.getElementById("draft-action-status");
  const exportFormat = document.getElementById("draft-export-format");
  const exportButton = document.getElementById("draft-export");
  const publishButton = document.getElementById("draft-publish");

  /* 修改：结构不完整时停止初始化，避免影响题面与侧栏功能。 */
  if (
    !draftPanel ||
    !modeTabs.length ||
    !modePanels.length ||
    !richEditor ||
    !insertFormulaButton ||
    !formulaInsertButtons.length ||
    !latexSource ||
    !latexPreview ||
    !drawingCanvas ||
    !drawingViewport ||
    !drawingBoard ||
    !drawingImageLayer ||
    !drawingCursor ||
    !inkColor ||
    !inkWidth ||
    !insertImageButton ||
    !imageInput ||
    !drawingUndoButton ||
    !drawingRedoButton ||
    !drawingClearButton ||
    !zoomOutButton ||
    !zoomInButton ||
    !zoomResetButton ||
    !zoomValue ||
    !saveState ||
    !actionStatus ||
    !exportFormat ||
    !exportButton ||
    !publishButton
  ) {
    return;
  }

  /* 新增：避免页面框架重复触发初始化后叠加事件监听。 */
  if (draftPanel.dataset.draftInitialized === "true") {
    return;
  }
  draftPanel.dataset.draftInitialized = "true";

  /* 修改：题号同时用于本地草稿隔离、导出文件名与发布数据。 */
  const problemId = draftPanel.dataset.problemId;
  const storageKey = "mathverse:question-draft:" + problemId;
  const pendingPublishKey = "mathverse:pending-solution:" + problemId;
  const minimumBoardWidth = 1600;
  const minimumBoardHeight = 1100;
  const defaultBoardWidth = 3200;
  const defaultBoardHeight = 2200;
  const maximumBoardWidth = 4800;
  const maximumBoardHeight = 3200;
  const minimumBoardZoom = 0.5;
  const maximumBoardZoom = 2;
  const boardZoomStep = 0.25;
  const minimumImageSize = 72;
  const allowedRichTags = new Set([
    "P",
    "DIV",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "UL",
    "OL",
    "LI",
    "MATH-FIELD"
  ]);
  let activeMode = "rich";
  let saveTimer = null;
  let resizeTimer = null;
  let latexRenderTimer = null;
  let latexRenderVersion = 0;
  let savedRichRange = null;
  let activeInlineFormula = null;
  let drawingContext = null;
  let drawingStrokes = [];
  let drawingImages = [];
  let currentStroke = null;
  let activeDrawingTool = "pen";
  let drawingHistory = [];
  let drawingHistoryIndex = -1;
  let boardWidth = defaultBoardWidth;
  let boardHeight = defaultBoardHeight;
  let boardZoom = 1;
  let pendingViewportCenter = {
    x: defaultBoardWidth / 2,
    y: defaultBoardHeight / 2
  };
  let drawingViewportPositioned = false;
  let isExpandingDrawingBoard = false;
  let selectedDrawingImageId = null;
  let imageInteraction = null;
  let panInteraction = null;

  /* 修改：集中更新自动保存提示，保证视觉状态和无障碍播报一致。 */
  function setSaveState(message, state) {
    saveState.textContent = message;

    if (state) {
      saveState.dataset.state = state;
    } else {
      delete saveState.dataset.state;
    }
  }

  /* 修改：集中更新导出、发布操作的结果提示。 */
  function setActionStatus(message, state) {
    actionStatus.textContent = message;

    if (state) {
      actionStatus.dataset.state = state;
    } else {
      delete actionStatus.dataset.state;
    }
  }

  /* 修改：按照题头两段文字组合用于导出和发布的完整题目标题。 */
  function getProblemTitle() {
    const titleParts = document.querySelectorAll(
      ".header-panel-title-name > span"
    );

    if (!titleParts.length) {
      return "题目";
    }

    return Array.from(titleParts)
      .map(function (titlePart) {
        return titlePart.textContent.trim();
      })
      .join(" · ");
  }

  /* 新增：读取 MathLive 公式值，并兼容组件尚未完成注册的情况。 */
  function getMathFieldValue(mathField) {
    if (typeof mathField.value === "string") {
      return mathField.value.trim();
    }

    return (mathField.dataset.latex || mathField.textContent || "").trim();
  }

  /* 新增：恢复公式时优先使用 MathLive 的 value 属性。 */
  function setMathFieldValue(mathField, value) {
    const nextValue = value || "";
    mathField.dataset.latex = nextValue;

    if (typeof mathField.value === "string") {
      mathField.value = nextValue;
    } else {
      mathField.textContent = nextValue;
    }
  }

  /* 修改：常驻功能区取代弹出键盘，聚焦公式时始终收起旧键盘。 */
  function hideMathKeyboard() {
    const keyboard = window.mathVirtualKeyboard;

    if (!keyboard) {
      return;
    }

    if (typeof keyboard.hide === "function") {
      keyboard.hide();
    } else {
      keyboard.visible = false;
    }
  }

  /* 新增：聚焦当前公式，供键盘输入和 Word 式公式按钮共同使用。 */
  function focusInlineFormula(formula) {
    if (!formula || !formula.isConnected) {
      return;
    }

    activeInlineFormula = formula;
    insertFormulaButton.classList.add("is-active");
    hideMathKeyboard();
    /* 修改：立即聚焦保证点击“公式”后首个按键不会落回正文。 */
    formula.focus({ preventScroll: true });
    window.requestAnimationFrame(function () {
      if (document.activeElement !== formula) {
        formula.focus({ preventScroll: true });
      }
    });
  }

  /* 修改：为正文中的每个公式绑定输入保存与常驻公式功能区。 */
  function bindInlineFormula(formula, initialLatex) {
    formula.classList.add("draft-inline-formula");
    formula.setAttribute("contenteditable", "false");
    formula.setAttribute("math-virtual-keyboard-policy", "manual");
    formula.setAttribute("aria-label", "行内公式");
    formula.setAttribute("placeholder", "\\text{输入公式}");
    formula.tabIndex = 0;

    if (formula.dataset.draftBound !== "true") {
      formula.dataset.draftBound = "true";
      formula.addEventListener("input", function () {
        formula.dataset.latex = getMathFieldValue(formula);
        scheduleSave();
      });
      formula.addEventListener("focusin", function () {
        focusInlineFormula(formula);
      });
      formula.addEventListener("focusout", function () {
        window.setTimeout(function () {
          if (document.activeElement !== formula) {
            insertFormulaButton.classList.remove("is-active");
          }
        }, 0);
      });
    }

    setMathFieldValue(
      formula,
      typeof initialLatex === "string"
        ? initialLatex
        : formula.dataset.latex || formula.textContent || ""
    );

    /* 新增：组件稍后注册时再次写入值，避免动态公式丢失初始内容。 */
    if (
      window.customElements &&
      !window.customElements.get("math-field")
    ) {
      window.customElements.whenDefined("math-field").then(function () {
        formula.readOnly = false;
        formula.defaultMode = "inline-math";
        formula.mathVirtualKeyboardPolicy = "manual";
        setMathFieldValue(formula, formula.dataset.latex || "");

        if (activeInlineFormula === formula) {
          focusInlineFormula(formula);
        }
      });
    } else {
      formula.readOnly = false;
      formula.defaultMode = "inline-math";
      formula.mathVirtualKeyboardPolicy = "manual";
    }
  }

  /* 新增：仅保留草稿编辑器允许的基础排版与公式标签。 */
  function sanitizeRichHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";

    Array.from(
      template.content.querySelectorAll("script, style, iframe, object, embed")
    ).forEach(function (unsafeElement) {
      unsafeElement.remove();
    });

    Array.from(template.content.querySelectorAll("*")).forEach(function (
      element
    ) {
      if (!allowedRichTags.has(element.tagName)) {
        element.replaceWith.apply(element, Array.from(element.childNodes));
        return;
      }

      if (element.tagName === "MATH-FIELD") {
        const latex =
          element.getAttribute("data-latex") || element.textContent || "";
        Array.from(element.attributes).forEach(function (attribute) {
          element.removeAttribute(attribute.name);
        });
        element.className = "draft-inline-formula";
        element.setAttribute("contenteditable", "false");
        element.setAttribute("math-virtual-keyboard-policy", "manual");
        element.setAttribute("aria-label", "行内公式");
        element.setAttribute("data-latex", latex);
        element.textContent = latex;
        return;
      }

      Array.from(element.attributes).forEach(function (attribute) {
        element.removeAttribute(attribute.name);
      });
    });

    return template.innerHTML;
  }

  /* 新增：保存前把公式当前值写回可序列化的正文 HTML。 */
  function serializeRichHtml() {
    const clone = richEditor.cloneNode(true);
    const sourceFormulas = Array.from(
      richEditor.querySelectorAll("math-field")
    );
    const clonedFormulas = Array.from(clone.querySelectorAll("math-field"));

    clonedFormulas.forEach(function (formula, index) {
      const latex = sourceFormulas[index]
        ? getMathFieldValue(sourceFormulas[index])
        : "";
      formula.textContent = latex;
      formula.setAttribute("data-latex", latex);
    });

    return sanitizeRichHtml(clone.innerHTML);
  }

  /* 新增：将混排正文转换为可发布、可导出的纯文本与行内 LaTeX。 */
  function getRichPlainText() {
    const clone = richEditor.cloneNode(true);
    const sourceFormulas = Array.from(
      richEditor.querySelectorAll("math-field")
    );

    Array.from(clone.querySelectorAll("math-field")).forEach(function (
      formula,
      index
    ) {
      const latex = sourceFormulas[index]
        ? getMathFieldValue(sourceFormulas[index])
        : "";
      formula.replaceWith(
        document.createTextNode(latex ? "$" + latex + "$" : "")
      );
    });

    Array.from(clone.querySelectorAll("br")).forEach(function (lineBreak) {
      lineBreak.replaceWith(document.createTextNode("\n"));
    });

    Array.from(clone.querySelectorAll("li")).forEach(function (listItem) {
      listItem.insertBefore(document.createTextNode("• "), listItem.firstChild);
      listItem.appendChild(document.createTextNode("\n"));
    });

    Array.from(clone.querySelectorAll("p, div")).forEach(function (block) {
      block.appendChild(document.createTextNode("\n"));
    });

    return clone.textContent
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /* 新增：把旧版纯文本草稿安全地迁移到所见即所得编辑器。 */
  function restorePlainTextAsRichText(text) {
    richEditor.replaceChildren();

    String(text || "")
      .split(/\n{2,}/)
      .filter(function (paragraphText) {
        return paragraphText.trim();
      })
      .forEach(function (paragraphText) {
        const paragraph = document.createElement("p");
        const lines = paragraphText.split("\n");

        lines.forEach(function (line, index) {
          if (index) {
            paragraph.appendChild(document.createElement("br"));
          }
          paragraph.appendChild(document.createTextNode(line));
        });
        richEditor.appendChild(paragraph);
      });
  }

  /* 新增：恢复混排内容后重新初始化所有行内公式。 */
  function restoreRichHtml(html) {
    richEditor.innerHTML = sanitizeRichHtml(html);
    Array.from(richEditor.querySelectorAll("math-field")).forEach(function (
      formula
    ) {
      bindInlineFormula(
        formula,
        formula.dataset.latex || formula.textContent || ""
      );
    });
  }

  /* 新增：把三个模式的文字内容组合为题解区兼容的 Markdown。 */
  function buildMarkdown(richText, latex, hasHandwriting) {
    const sections = ["# " + problemId + " " + getProblemTitle()];

    if (richText) {
      sections.push("## 图文混排草稿", richText);
    }

    if (latex) {
      sections.push("## LaTeX 演算", "$$\n" + latex + "\n$$");
    }

    if (hasHandwriting) {
      sections.push("## 手写演算", "本题解包含手写笔迹或画布图片。");
    }

    return sections.join("\n\n") + "\n";
  }

  /* 新增：生成保存、导出和发布共用的完整草稿数据。 */
  function collectDraft(includeHandwritingImage) {
    const richText = getRichPlainText();
    const latex = latexSource.value.trim();
    const hasHandwriting =
      drawingStrokes.length > 0 || drawingImages.length > 0;
    const headerPanel = document.querySelector(".header-panel");
    const drawingViewportCenter = getDrawingViewportCenter();

    return {
      problemId: problemId,
      problemTitle: getProblemTitle(),
      questionType: headerPanel ? headerPanel.dataset.questionType || "" : "",
      activeMode: activeMode,
      richHtml: serializeRichHtml(),
      richText: richText,
      solutionText: richText,
      latex: latex,
      drawingStrokes: drawingStrokes,
      drawingImages: drawingImages,
      drawingBoard: {
        width: boardWidth,
        height: boardHeight,
        zoom: boardZoom,
        centerX: drawingViewportCenter.x,
        centerY: drawingViewportCenter.y
      },
      handwritingImage:
        includeHandwritingImage && hasHandwriting
          ? getHandwritingDataUrl()
          : "",
      markdown: buildMarkdown(richText, latex, hasHandwriting),
      updatedAt: new Date().toISOString()
    };
  }

  /* 新增：判断三种模式中是否已经存在可保存或导出的内容。 */
  function hasDraftContent(draft) {
    return Boolean(
      draft.richText ||
      draft.latex ||
      (Array.isArray(draft.drawingStrokes) &&
        draft.drawingStrokes.length) ||
      (Array.isArray(draft.drawingImages) &&
        draft.drawingImages.length)
    );
  }

  /* 修改：把当前三种模式的草稿一起保存到浏览器。 */
  function saveDraft() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(collectDraft(false)));
      setSaveState("已自动保存", "saved");
      return true;
    } catch (error) {
      setSaveState("本地保存失败", "error");
      return false;
    }
  }

  /* 修改：输入后稍作等待再保存，避免连续书写时频繁操作存储。 */
  function scheduleSave() {
    setSaveState("正在保存");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 320);
  }

  /* 新增：去掉常见数学定界符，交由 MathJax 直接编译内部 LaTeX。 */
  function stripLatexDelimiters(source) {
    const value = String(source || "").trim();

    if (value.startsWith("$$") && value.endsWith("$$")) {
      return value.slice(2, -2).trim();
    }

    if (
      (value.startsWith("\\[") && value.endsWith("\\]")) ||
      (value.startsWith("\\(") && value.endsWith("\\)"))
    ) {
      return value.slice(2, -2).trim();
    }

    if (value.startsWith("$") && value.endsWith("$")) {
      return value.slice(1, -1).trim();
    }

    return value;
  }

  /* 新增：普通回车自动编译为多行环境，显式 LaTeX 环境保持原样。 */
  function prepareLatexBlock(source) {
    const block = stripLatexDelimiters(source);
    const lines = block
      .split("\n")
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);

    if (lines.length <= 1 || /\\begin\s*\{[^}]+\}/.test(block)) {
      return block;
    }

    const normalizedLines = lines.map(function (line) {
      return line.replace(/\\\\(?:\[[^\]]*\])?\s*$/, "").trim();
    });
    const environment = normalizedLines.some(function (line) {
      return line.includes("&");
    })
      ? "aligned"
      : "gathered";

    return (
      "\\begin{" +
      environment +
      "}\n" +
      normalizedLines.join("\\\\[6pt]\n") +
      "\n\\end{" +
      environment +
      "}"
    );
  }

  /* 新增：分段编译允许空行分隔多组演算，并兼容简单 document 外壳。 */
  function getLatexRenderBlocks(source) {
    let value = String(source || "").replace(/\r\n?/g, "\n").trim();
    const documentMatch = value.match(
      /\\begin\s*\{document\}([\s\S]*?)\\end\s*\{document\}/
    );

    if (documentMatch) {
      value = documentMatch[1].trim();
    }

    if (/\\begin\s*\{[^}]+\}/.test(value)) {
      return [prepareLatexBlock(value)];
    }

    return value
      .split(/\n\s*\n+/)
      .map(prepareLatexBlock)
      .filter(Boolean);
  }

  /* 修改：使用 MathJax 编译多行 LaTeX，支持 AMS 与常用扩展环境。 */
  async function updateLatexPreview() {
    const latex = latexSource.value.trim();
    const renderVersion = ++latexRenderVersion;
    latexPreview.dataset.empty = latex ? "false" : "true";

    if (!latex) {
      latexPreview.replaceChildren();
      return;
    }

    try {
      if (
        !window.MathJax ||
        !window.MathJax.startup ||
        !window.MathJax.startup.promise
      ) {
        throw new Error("MathJax 尚未完成加载");
      }

      await window.MathJax.startup.promise;

      if (renderVersion !== latexRenderVersion) {
        return;
      }

      const fragment = document.createDocumentFragment();
      const blocks = getLatexRenderBlocks(latex);

      for (const block of blocks) {
        let rendered;

        if (typeof window.MathJax.tex2svgPromise === "function") {
          rendered = await window.MathJax.tex2svgPromise(block, {
            display: true
          });
        } else if (typeof window.MathJax.tex2svg === "function") {
          rendered = window.MathJax.tex2svg(block, { display: true });
        } else {
          throw new Error("MathJax 编译接口不可用");
        }

        if (renderVersion !== latexRenderVersion) {
          return;
        }

        const renderBlock = document.createElement("div");
        renderBlock.className = "draft-latex-render-block";
        renderBlock.appendChild(rendered);
        fragment.appendChild(renderBlock);
      }

      latexPreview.replaceChildren(fragment);
    } catch (error) {
      if (renderVersion !== latexRenderVersion) {
        return;
      }

      const errorMessage = document.createElement("pre");
      errorMessage.className = "draft-latex-error";
      errorMessage.textContent =
        "LaTeX 编译失败：\n" +
        (error && error.message ? error.message : "请检查命令或环境是否闭合");
      latexPreview.replaceChildren(errorMessage);
    }
  }

  /* 新增：连续输入时短暂合并编译任务，减少大公式反复重排。 */
  function scheduleLatexPreview() {
    window.clearTimeout(latexRenderTimer);
    latexRenderTimer = window.setTimeout(updateLatexPreview, 100);
  }

  /* 新增：LaTeX 工具栏在当前选区插入多行模板并立即编译。 */
  function insertLatexTemplate(template) {
    const start = latexSource.selectionStart;
    const end = latexSource.selectionEnd;
    latexSource.setRangeText(template, start, end, "end");
    latexSource.focus();
    scheduleLatexPreview();
    scheduleSave();
  }

  /* 新增：更新标签页的可见状态、键盘焦点与当前模式。 */
  function activateMode(mode, focusTab, shouldSave) {
    const selectedTab = modeTabs.find(function (tab) {
      return tab.dataset.draftMode === mode;
    });

    if (!selectedTab) {
      return;
    }

    activeMode = mode;
    modeTabs.forEach(function (tab) {
      const isActive = tab === selectedTab;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    modePanels.forEach(function (panel) {
      panel.hidden = panel.dataset.draftPanel !== mode;
    });

    if (mode !== "rich") {
      hideMathKeyboard();
    }

    if (mode === "handwriting") {
      window.requestAnimationFrame(function () {
        resizeDrawingCanvas();
        const center = pendingViewportCenter || getDrawingViewportCenter();
        positionDrawingViewport(center.x, center.y);
      });
    }

    if (focusTab) {
      selectedTab.focus();
    }

    if (shouldSave !== false) {
      scheduleSave();
    }
  }

  /* 新增：记录正文中的光标位置，点击工具栏后仍可在原位置操作。 */
  function rememberRichSelection() {
    const selection = window.getSelection();

    if (
      !selection ||
      !selection.rangeCount ||
      !richEditor.contains(selection.anchorNode)
    ) {
      return;
    }

    savedRichRange = selection.getRangeAt(0).cloneRange();
  }

  /* 新增：工具栏执行命令前恢复正文光标位置。 */
  function restoreRichSelection() {
    if (
      !savedRichRange ||
      !savedRichRange.commonAncestorContainer ||
      !savedRichRange.commonAncestorContainer.isConnected
    ) {
      return false;
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRichRange);
    return true;
  }

  /* 新增：在当前正文光标处插入可编辑的 MathLive 行内公式。 */
  function insertInlineFormula() {
    /* 修改：当前公式仍在编辑时，顶栏按钮只重新聚焦，不重复插入。 */
    if (
      activeInlineFormula &&
      activeInlineFormula.isConnected &&
      document.activeElement === activeInlineFormula
    ) {
      focusInlineFormula(activeInlineFormula);
      return activeInlineFormula;
    }

    const formula = document.createElement("math-field");
    const spacer = document.createTextNode("\u00a0");
    let range = savedRichRange;

    if (
      !range ||
      !range.commonAncestorContainer ||
      !range.commonAncestorContainer.isConnected ||
      !richEditor.contains(range.commonAncestorContainer)
    ) {
      range = document.createRange();
      range.selectNodeContents(richEditor);
      range.collapse(false);
    }

    range.deleteContents();
    range.insertNode(formula);
    formula.after(spacer);
    bindInlineFormula(formula, "");

    const selection = window.getSelection();
    const nextRange = document.createRange();
    nextRange.setStartAfter(spacer);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    savedRichRange = nextRange.cloneRange();

    focusInlineFormula(formula);

    if (typeof formula.executeCommand === "function") {
      formula.executeCommand("moveToMathfieldEnd");
    }

    scheduleSave();
    return formula;
  }

  /* 新增：Word 式功能区按钮把符号或结构直接写入当前公式。 */
  function insertFormulaTemplate(latex) {
    const formula =
      activeInlineFormula &&
      activeInlineFormula.isConnected &&
      document.activeElement === activeInlineFormula
        ? activeInlineFormula
        : insertInlineFormula();

    if (!formula || !latex) {
      return;
    }

    const applyTemplate = function () {
      focusInlineFormula(formula);

      if (typeof formula.insert === "function") {
        formula.insert(latex, {
          insertionMode: "replaceSelection",
          selectionMode: "placeholder"
        });
      } else if (typeof formula.executeCommand === "function") {
        formula.executeCommand(["insert", latex]);
      } else {
        setMathFieldValue(formula, getMathFieldValue(formula) + latex);
      }

      formula.dataset.latex = getMathFieldValue(formula);
      scheduleSave();
    };

    if (
      window.customElements &&
      !window.customElements.get("math-field")
    ) {
      window.customElements.whenDefined("math-field").then(applyTemplate);
    } else {
      applyTemplate();
    }
  }

  /* 新增：执行加粗、斜体、下划线和列表等基础所见即所得命令。 */
  function runRichCommand(command) {
    richEditor.focus();
    restoreRichSelection();

    if (typeof document.execCommand === "function") {
      document.execCommand(command, false, null);
      rememberRichSelection();
      scheduleSave();
    } else {
      setActionStatus("当前浏览器不支持此排版命令。", "warning");
    }
  }

  /* 新增：让纯文本粘贴进入草稿，避免带入外部页面脚本与杂乱样式。 */
  function pastePlainText(event) {
    const clipboard = event.clipboardData;

    if (!clipboard) {
      return;
    }

    event.preventDefault();
    const text = clipboard.getData("text/plain");

    if (typeof document.execCommand === "function") {
      document.execCommand("insertText", false, text);
      return;
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    }
  }

  /* 修改：取得画板可用的二维上下文；不支持画布时保留其他两种模式。 */
  function getDrawingContext(canvas) {
    try {
      return (canvas || drawingCanvas).getContext("2d");
    } catch (error) {
      return null;
    }
  }

  /* 新增：复制画板数据，供自动保存与双向撤销安全复用。 */
  function cloneDrawingStrokes(strokes) {
    return (strokes || []).map(function (stroke) {
      return {
        tool: stroke.tool === "eraser" ? "eraser" : "pen",
        color: stroke.color || "#000000",
        width: Number(stroke.width) || 3,
        coordinateSpace: "board",
        points: (stroke.points || []).map(function (point) {
          return { x: Number(point.x), y: Number(point.y) };
        })
      };
    });
  }

  /* 新增：图片数据使用独立副本，避免历史状态被拖动操作直接改写。 */
  function cloneDrawingImages(images) {
    return (images || []).map(function (image) {
      return {
        id: image.id,
        src: image.src,
        name: image.name || "画布图片",
        x: Number(image.x),
        y: Number(image.y),
        width: Number(image.width),
        height: Number(image.height)
      };
    });
  }

  /* 新增：生成画板历史快照，统一覆盖笔迹、图片与画布尺寸。 */
  function getDrawingSnapshot() {
    return {
      strokes: cloneDrawingStrokes(drawingStrokes),
      images: cloneDrawingImages(drawingImages),
      width: boardWidth,
      height: boardHeight
    };
  }

  /* 新增：恢复一份画板历史快照。 */
  function applyDrawingSnapshot(snapshot) {
    if (!snapshot) {
      return;
    }

    boardWidth = Math.max(
      minimumBoardWidth,
      Math.min(maximumBoardWidth, Number(snapshot.width) || defaultBoardWidth)
    );
    boardHeight = Math.max(
      minimumBoardHeight,
      Math.min(maximumBoardHeight, Number(snapshot.height) || defaultBoardHeight)
    );
    drawingStrokes = cloneDrawingStrokes(snapshot.strokes);
    drawingImages = cloneDrawingImages(snapshot.images);
    currentStroke = null;
    selectedDrawingImageId = null;
    resizeDrawingCanvas();
    renderDrawingImages();
    updateDrawingButtons();
  }

  /* 新增：恢复草稿后从当前内容建立双向撤销起点。 */
  function resetDrawingHistory() {
    drawingHistory = [getDrawingSnapshot()];
    drawingHistoryIndex = 0;
    updateDrawingButtons();
  }

  /* 新增：每个完整动作只写入一次历史记录，并丢弃已分叉的重做记录。 */
  function commitDrawingHistory() {
    drawingHistory = drawingHistory.slice(0, drawingHistoryIndex + 1);
    drawingHistory.push(getDrawingSnapshot());

    if (drawingHistory.length > 60) {
      drawingHistory.shift();
    }

    drawingHistoryIndex = drawingHistory.length - 1;
    updateDrawingButtons();
  }

  /* 新增：读取当前视口中心在画布逻辑坐标中的位置。 */
  function getDrawingViewportCenter() {
    if (!drawingViewportPositioned && pendingViewportCenter) {
      return {
        x: pendingViewportCenter.x,
        y: pendingViewportCenter.y
      };
    }

    return {
      x:
        (drawingViewport.scrollLeft + drawingViewport.clientWidth / 2) /
        boardZoom,
      y:
        (drawingViewport.scrollTop + drawingViewport.clientHeight / 2) /
        boardZoom
    };
  }

  /* 新增：把指定逻辑坐标放到视口中央，供恢复草稿与窗口变化复用。 */
  function positionDrawingViewport(centerX, centerY) {
    if (!drawingViewport.clientWidth || !drawingViewport.clientHeight) {
      pendingViewportCenter = {
        x: Number(centerX) || boardWidth / 2,
        y: Number(centerY) || boardHeight / 2
      };
      return;
    }

    drawingViewport.scrollLeft = Math.max(
      0,
      (Number(centerX) || boardWidth / 2) * boardZoom -
        drawingViewport.clientWidth / 2
    );
    drawingViewport.scrollTop = Math.max(
      0,
      (Number(centerY) || boardHeight / 2) * boardZoom -
        drawingViewport.clientHeight / 2
    );
    drawingViewportPositioned = true;
    pendingViewportCenter = null;
  }

  /* 新增：同步缩放百分比与按钮可用状态。 */
  function updateDrawingZoomControls() {
    zoomValue.value = Math.round(boardZoom * 100) + "%";
    zoomValue.textContent = zoomValue.value;
    zoomOutButton.disabled = boardZoom <= minimumBoardZoom;
    zoomInButton.disabled = boardZoom >= maximumBoardZoom;
    zoomResetButton.disabled = boardZoom === 1;
  }

  /* 新增：缩放时保持视口中心或指针下方的画布位置不跳动。 */
  function setDrawingZoom(nextZoom, anchorClientX, anchorClientY, shouldSave) {
    const clampedZoom = Math.max(
      minimumBoardZoom,
      Math.min(maximumBoardZoom, Number(nextZoom) || 1)
    );

    if (Math.abs(clampedZoom - boardZoom) < 0.001) {
      return;
    }

    const viewportRect = drawingViewport.getBoundingClientRect();
    const anchorX = Number.isFinite(Number(anchorClientX))
      ? Number(anchorClientX) - viewportRect.left
      : drawingViewport.clientWidth / 2;
    const anchorY = Number.isFinite(Number(anchorClientY))
      ? Number(anchorClientY) - viewportRect.top
      : drawingViewport.clientHeight / 2;
    const worldX = (drawingViewport.scrollLeft + anchorX) / boardZoom;
    const worldY = (drawingViewport.scrollTop + anchorY) / boardZoom;
    boardZoom = clampedZoom;
    resizeDrawingCanvas();
    drawingViewport.scrollLeft = Math.max(0, worldX * boardZoom - anchorX);
    drawingViewport.scrollTop = Math.max(0, worldY * boardZoom - anchorY);
    drawingViewportPositioned = true;
    updateDrawingZoomControls();

    if (shouldSave !== false) {
      scheduleSave();
    }
  }

  /* 修改：把指针位置转换为大画布中的绝对坐标。 */
  function getDrawingPoint(event) {
    const rect = drawingBoard.getBoundingClientRect();
    const scaleX = boardWidth / Math.max(1, rect.width);
    const scaleY = boardHeight / Math.max(1, rect.height);

    return {
      x: Math.max(
        0,
        Math.min(boardWidth, (event.clientX - rect.left) * scaleX)
      ),
      y: Math.max(
        0,
        Math.min(boardHeight, (event.clientY - rect.top) * scaleY)
      )
    };
  }

  /* 修改：在指定上下文中重画一条绝对坐标的画笔或橡皮轨迹。 */
  function drawStrokeOnContext(context, stroke, scale, offsetX, offsetY) {
    if (!context || !stroke || !stroke.points || !stroke.points.length) {
      return;
    }

    const drawingScale = Number(scale) || 1;
    const drawingOffsetX = Number(offsetX) || 0;
    const drawingOffsetY = Number(offsetY) || 0;
    const points = stroke.points;
    const firstPoint = points[0];
    context.save();
    context.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = stroke.color || "#000000";
    context.fillStyle = stroke.color || "#000000";
    context.lineWidth = Math.max(1, Number(stroke.width) * drawingScale);
    context.lineCap = "round";
    context.lineJoin = "round";

    if (points.length === 1) {
      context.beginPath();
      context.arc(
        (firstPoint.x - drawingOffsetX) * drawingScale,
        (firstPoint.y - drawingOffsetY) * drawingScale,
        context.lineWidth / 2,
        0,
        Math.PI * 2
      );
      context.fill();
      context.restore();
      return;
    }

    context.beginPath();
    context.moveTo(
      (firstPoint.x - drawingOffsetX) * drawingScale,
      (firstPoint.y - drawingOffsetY) * drawingScale
    );
    points.slice(1).forEach(function (point) {
      context.lineTo(
        (point.x - drawingOffsetX) * drawingScale,
        (point.y - drawingOffsetY) * drawingScale
      );
    });
    context.stroke();
    context.restore();
  }

  /* 修改：按照大画布逻辑尺寸重画全部已保存笔迹。 */
  function renderDrawing() {
    if (!drawingContext) {
      return;
    }

    drawingContext.clearRect(0, 0, boardWidth, boardHeight);
    drawingStrokes.forEach(function (stroke) {
      drawStrokeOnContext(drawingContext, stroke, 1, 0, 0);
    });

    if (currentStroke) {
      drawStrokeOnContext(drawingContext, currentStroke, 1, 0, 0);
    }
  }

  /* 修改：按设备像素比调整大画布，兼顾清晰度与连续书写性能。 */
  function resizeDrawingCanvas() {
    drawingBoard.style.width = boardWidth * boardZoom + "px";
    drawingBoard.style.height = boardHeight * boardZoom + "px";
    drawingBoard.style.setProperty(
      "--draft-grid-size",
      24 * boardZoom + "px"
    );
    const boardArea = boardWidth * boardHeight;
    const pixelRatio =
      boardArea > 6000000
        ? 1
        : Math.min(window.devicePixelRatio || 1, 1.25);
    const nextWidth = Math.round(boardWidth * pixelRatio);
    const nextHeight = Math.round(boardHeight * pixelRatio);

    if (
      drawingCanvas.width !== nextWidth ||
      drawingCanvas.height !== nextHeight
    ) {
      drawingCanvas.width = nextWidth;
      drawingCanvas.height = nextHeight;
    }

    drawingContext = getDrawingContext();
    if (drawingContext) {
      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
    renderDrawing();
    drawingImages.forEach(updateDrawingImageElement);
    updateDrawingCursorAppearance();
    updateDrawingZoomControls();
  }

  /* 新增：向左或向上扩展时平移已有内容，保持用户当前看到的位置不变。 */
  function shiftDrawingContent(deltaX, deltaY) {
    const shiftStrokes = function (strokes) {
      (strokes || []).forEach(function (stroke) {
        (stroke.points || []).forEach(function (point) {
          point.x += deltaX;
          point.y += deltaY;
        });
      });
    };
    const shiftImages = function (images) {
      (images || []).forEach(function (image) {
        image.x += deltaX;
        image.y += deltaY;
      });
    };

    shiftStrokes(drawingStrokes);
    shiftStrokes(currentStroke ? [currentStroke] : []);
    shiftImages(drawingImages);
    drawingHistory.forEach(function (snapshot) {
      shiftStrokes(snapshot.strokes);
      shiftImages(snapshot.images);
    });
  }

  /* 修改：接近任意边缘时分段扩展画板，支持向四面持续拖拽。 */
  function expandDrawingBoardIfNeeded() {
    if (isExpandingDrawingBoard) {
      return;
    }

    const threshold = 150;
    const visualWidth = boardWidth * boardZoom;
    const visualHeight = boardHeight * boardZoom;
    const reachesLeftEdge = drawingViewport.scrollLeft <= threshold;
    const reachesTopEdge = drawingViewport.scrollTop <= threshold;
    const reachesRightEdge =
      drawingViewport.scrollLeft + drawingViewport.clientWidth >=
      visualWidth - threshold;
    const reachesBottomEdge =
      drawingViewport.scrollTop + drawingViewport.clientHeight >=
      visualHeight - threshold;
    let remainingWidth = maximumBoardWidth - boardWidth;
    let remainingHeight = maximumBoardHeight - boardHeight;
    const addLeft = reachesLeftEdge
      ? Math.min(400, Math.max(0, remainingWidth))
      : 0;
    remainingWidth -= addLeft;
    const addRight = reachesRightEdge
      ? Math.min(400, Math.max(0, remainingWidth))
      : 0;
    const addTop = reachesTopEdge
      ? Math.min(300, Math.max(0, remainingHeight))
      : 0;
    remainingHeight -= addTop;
    const addBottom = reachesBottomEdge
      ? Math.min(300, Math.max(0, remainingHeight))
      : 0;

    if (!addLeft && !addRight && !addTop && !addBottom) {
      return;
    }

    isExpandingDrawingBoard = true;
    const previousScrollLeft = drawingViewport.scrollLeft;
    const previousScrollTop = drawingViewport.scrollTop;
    shiftDrawingContent(addLeft, addTop);
    boardWidth += addLeft + addRight;
    boardHeight += addTop + addBottom;
    drawingHistory.forEach(function (snapshot) {
      snapshot.width = boardWidth;
      snapshot.height = boardHeight;
    });
    resizeDrawingCanvas();
    renderDrawingImages();
    drawingViewport.scrollLeft =
      previousScrollLeft + addLeft * boardZoom;
    drawingViewport.scrollTop = previousScrollTop + addTop * boardZoom;
    if (panInteraction) {
      panInteraction.scrollLeft += addLeft * boardZoom;
      panInteraction.scrollTop += addTop * boardZoom;
    }
    drawingViewportPositioned = true;
    isExpandingDrawingBoard = false;
    scheduleSave();
  }

  /* 新增：固定使用双层圆形指针，白色墨水与橡皮范围均保持可见。 */
  function updateDrawingCursorAppearance() {
    const baseWidth = Math.max(1, Number(inkWidth.value) || 3);
    const isEraser = activeDrawingTool === "eraser";
    const cursorSize = isEraser
      ? Math.max(18, baseWidth * 3 * boardZoom)
      : Math.max(9, (baseWidth + 6) * boardZoom);

    drawingCursor.style.setProperty(
      "--draft-cursor-size",
      cursorSize + "px"
    );
    drawingCursor.style.setProperty(
      "--draft-cursor-color",
      isEraser ? "rgba(255, 255, 255, 0.78)" : inkColor.value
    );
    drawingCursor.classList.toggle("is-eraser", isEraser);

    if (activeDrawingTool === "move") {
      drawingCursor.classList.remove("is-visible");
    }
  }

  /* 新增：让自绘指针始终跟随画板内的鼠标或触控笔位置。 */
  function moveDrawingCursor(event) {
    if (activeDrawingTool === "move") {
      drawingCursor.classList.remove("is-visible");
      return;
    }

    const point = getDrawingPoint(event);
    drawingCursor.style.left = point.x * boardZoom + "px";
    drawingCursor.style.top = point.y * boardZoom + "px";
    drawingCursor.classList.add("is-visible");
  }

  /* 新增：指针离开画布后隐藏自绘标记。 */
  function hideDrawingCursor() {
    drawingCursor.classList.remove("is-visible");
  }

  /* 修改：开始一条新的手写轨迹。 */
  function beginDrawing(event) {
    if (
      activeDrawingTool === "move" ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    event.preventDefault();
    moveDrawingCursor(event);
    currentStroke = {
      tool: activeDrawingTool,
      color: inkColor.value,
      width:
        Number(inkWidth.value) * (activeDrawingTool === "eraser" ? 3 : 1),
      coordinateSpace: "board",
      points: [getDrawingPoint(event)]
    };

    if (typeof drawingCanvas.setPointerCapture === "function") {
      drawingCanvas.setPointerCapture(event.pointerId);
    }
    drawStrokeOnContext(drawingContext, currentStroke, 1, 0, 0);
  }

  /* 修改：书写时只绘制最新线段，避免大画布反复整张重画造成卡顿。 */
  function continueDrawing(event) {
    moveDrawingCursor(event);

    if (!currentStroke) {
      return;
    }

    event.preventDefault();
    const nextPoint = getDrawingPoint(event);
    const previousPoint = currentStroke.points[currentStroke.points.length - 1];
    currentStroke.points.push(nextPoint);
    drawStrokeOnContext(
      drawingContext,
      Object.assign({}, currentStroke, {
        points: [previousPoint, nextPoint]
      }),
      1,
      0,
      0
    );
  }

  /* 修改：结束轨迹后写入双向撤销历史与自动保存。 */
  function finishDrawing(event) {
    if (!currentStroke) {
      return;
    }

    if (event) {
      event.preventDefault();
      moveDrawingCursor(event);
    }
    const finalPoint = event ? getDrawingPoint(event) : null;
    const previousPoint = currentStroke.points[currentStroke.points.length - 1];

    if (
      finalPoint &&
      previousPoint &&
      (Math.abs(finalPoint.x - previousPoint.x) > 0.5 ||
        Math.abs(finalPoint.y - previousPoint.y) > 0.5)
    ) {
      currentStroke.points.push(finalPoint);
      drawStrokeOnContext(
        drawingContext,
        Object.assign({}, currentStroke, {
          points: [previousPoint, finalPoint]
        }),
        1,
        0,
        0
      );
    }

    drawingStrokes.push(currentStroke);
    currentStroke = null;
    commitDrawingHistory();
    scheduleSave();
  }

  /* 修改：统一切换移动、画笔与橡皮状态，并同步固定指针样式。 */
  function setDrawingTool(tool) {
    activeDrawingTool = ["move", "pen", "eraser"].includes(tool)
      ? tool
      : "pen";
    drawingToolButtons.forEach(function (button) {
      const isActive = button.dataset.drawingTool === activeDrawingTool;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    drawingBoard.dataset.drawingTool = activeDrawingTool;
    Array.from(drawingImageLayer.querySelectorAll(".draft-board-image")).forEach(
      function (element) {
        element.tabIndex = activeDrawingTool === "move" ? 0 : -1;
      }
    );
    updateDrawingCursorAppearance();
  }

  /* 新增：常用色和 RGB 取色器共享同一个当前墨水颜色。 */
  function setInkColor(color, activatePen) {
    if (!/^#[0-9a-f]{6}$/i.test(String(color || ""))) {
      return;
    }

    inkColor.value = color;
    drawingColorButtons.forEach(function (button) {
      const isActive =
        button.dataset.inkColorValue.toLowerCase() === color.toLowerCase();
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (activatePen) {
      setDrawingTool("pen");
    } else {
      updateDrawingCursorAppearance();
    }
  }

  /* 修改：根据历史位置与画板内容更新撤销、重做和清空按钮。 */
  function updateDrawingButtons() {
    drawingUndoButton.disabled = drawingHistoryIndex <= 0;
    drawingRedoButton.disabled =
      drawingHistoryIndex < 0 ||
      drawingHistoryIndex >= drawingHistory.length - 1;
    drawingClearButton.disabled =
      drawingStrokes.length === 0 && drawingImages.length === 0;
  }

  /* 修改：向前撤销一个完整的画板动作。 */
  function undoDrawing() {
    if (drawingHistoryIndex <= 0) {
      return;
    }

    drawingHistoryIndex -= 1;
    applyDrawingSnapshot(drawingHistory[drawingHistoryIndex]);
    scheduleSave();
  }

  /* 新增：向后重做刚刚撤销的画板动作。 */
  function redoDrawing() {
    if (drawingHistoryIndex >= drawingHistory.length - 1) {
      return;
    }

    drawingHistoryIndex += 1;
    applyDrawingSnapshot(drawingHistory[drawingHistoryIndex]);
    scheduleSave();
  }

  /* 修改：清空笔迹与图片，并作为一个可撤销动作记录。 */
  function clearDrawing() {
    if (!drawingStrokes.length && !drawingImages.length) {
      return;
    }

    drawingStrokes = [];
    drawingImages = [];
    selectedDrawingImageId = null;
    renderDrawing();
    renderDrawingImages();
    commitDrawingHistory();
    scheduleSave();
  }

  /* 修改：兼容旧版比例坐标，并把新草稿统一迁移到大画布绝对坐标。 */
  function normalizeDrawingStrokes(strokes) {
    if (!Array.isArray(strokes)) {
      return [];
    }

    const legacyWidth = Math.min(1180, boardWidth);
    const legacyHeight = Math.min(360, boardHeight);

    return strokes
      .filter(function (stroke) {
        return stroke && Array.isArray(stroke.points) && stroke.points.length;
      })
      .map(function (stroke) {
        const usesBoardCoordinates =
          stroke.coordinateSpace === "board" ||
          stroke.points.some(function (point) {
            return Number(point.x) > 1 || Number(point.y) > 1;
          });

        return {
          tool: stroke.tool === "eraser" ? "eraser" : "pen",
          color:
            typeof stroke.color === "string" ? stroke.color : "#000000",
          width: Math.max(1, Math.min(48, Number(stroke.width) || 3)),
          coordinateSpace: "board",
          points: stroke.points
            .filter(function (point) {
              return (
                point &&
                Number.isFinite(Number(point.x)) &&
                Number.isFinite(Number(point.y))
              );
            })
            .map(function (point) {
              return {
                x: Math.max(
                  0,
                  Math.min(
                    boardWidth,
                    usesBoardCoordinates
                      ? Number(point.x)
                      : Number(point.x) * legacyWidth
                  )
                ),
                y: Math.max(
                  0,
                  Math.min(
                    boardHeight,
                    usesBoardCoordinates
                      ? Number(point.y)
                      : Number(point.y) * legacyHeight
                  )
                )
              };
            })
        };
      })
      .filter(function (stroke) {
        return stroke.points.length;
      });
  }

  /* 新增：只接受本地图片数据，并限制其位置和尺寸。 */
  function normalizeDrawingImages(images) {
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .filter(function (image) {
        return (
          image &&
          typeof image.src === "string" &&
          image.src.indexOf("data:image/") === 0
        );
      })
      .map(function (image, index) {
        const width = Math.max(
          minimumImageSize,
          Math.min(boardWidth, Number(image.width) || 420)
        );
        const height = Math.max(
          minimumImageSize,
          Math.min(boardHeight, Number(image.height) || 280)
        );

        return {
          id: String(image.id || "restored-image-" + index),
          src: image.src,
          name: String(image.name || "画布图片"),
          x: Math.max(0, Math.min(boardWidth - width, Number(image.x) || 0)),
          y: Math.max(0, Math.min(boardHeight - height, Number(image.y) || 0)),
          width: width,
          height: height
        };
      });
  }

  /* 新增：生成不会与已有图片重复的本地标识。 */
  function createDrawingImageId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "drawing-image-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  /* 新增：更新图片选择框，不改变草稿历史。 */
  function selectDrawingImage(imageId) {
    selectedDrawingImageId = imageId || null;
    Array.from(drawingImageLayer.querySelectorAll(".draft-board-image")).forEach(
      function (element) {
        element.classList.toggle(
          "is-selected",
          element.dataset.imageId === selectedDrawingImageId
        );
      }
    );
  }

  /* 新增：找到已渲染图片节点，供移动、缩放与导出复用。 */
  function getDrawingImageElement(imageId) {
    return Array.from(
      drawingImageLayer.querySelectorAll(".draft-board-image")
    ).find(function (element) {
      return element.dataset.imageId === imageId;
    });
  }

  /* 新增：把图片状态同步到画布中的对应节点。 */
  function updateDrawingImageElement(image) {
    const element = image ? getDrawingImageElement(image.id) : null;

    if (!element) {
      return;
    }

    element.style.left = image.x * boardZoom + "px";
    element.style.top = image.y * boardZoom + "px";
    element.style.width = image.width * boardZoom + "px";
    element.style.height = image.height * boardZoom + "px";
  }

  /* 新增：删除选中的画布图片，并纳入撤销与重做。 */
  function deleteDrawingImage(imageId) {
    const nextImages = drawingImages.filter(function (image) {
      return image.id !== imageId;
    });

    if (nextImages.length === drawingImages.length) {
      return;
    }

    drawingImages = nextImages;
    selectedDrawingImageId = null;
    renderDrawingImages();
    commitDrawingHistory();
    scheduleSave();
  }

  /* 新增：开始拖动或缩放一张已插入图片。 */
  function beginImageInteraction(event, imageId, mode) {
    if (activeDrawingTool !== "move") {
      return;
    }

    const image = drawingImages.find(function (item) {
      return item.id === imageId;
    });

    if (!image) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectDrawingImage(imageId);
    imageInteraction = {
      id: imageId,
      mode: mode,
      startX: event.clientX,
      startY: event.clientY,
      original: cloneDrawingImages([image])[0]
    };
    window.addEventListener("pointermove", continueImageInteraction);
    window.addEventListener("pointerup", finishImageInteraction);
    window.addEventListener("pointercancel", finishImageInteraction);
  }

  /* 新增：实时移动或等比例缩放图片。 */
  function continueImageInteraction(event) {
    if (!imageInteraction) {
      return;
    }

    event.preventDefault();
    const image = drawingImages.find(function (item) {
      return item.id === imageInteraction.id;
    });

    if (!image) {
      return;
    }

    const rect = drawingBoard.getBoundingClientRect();
    const scaleX = boardWidth / Math.max(1, rect.width);
    const scaleY = boardHeight / Math.max(1, rect.height);
    const deltaX = (event.clientX - imageInteraction.startX) * scaleX;
    const deltaY = (event.clientY - imageInteraction.startY) * scaleY;
    const original = imageInteraction.original;

    if (imageInteraction.mode === "resize") {
      const ratio = original.width / Math.max(1, original.height);
      const widthDelta =
        Math.abs(deltaX) >= Math.abs(deltaY)
          ? deltaX
          : deltaY * ratio;
      const nextWidth = Math.max(
        minimumImageSize,
        Math.min(boardWidth - original.x, original.width + widthDelta)
      );
      image.width = nextWidth;
      image.height = Math.max(
        minimumImageSize,
        Math.min(boardHeight - original.y, nextWidth / ratio)
      );
    } else {
      image.x = Math.max(
        0,
        Math.min(boardWidth - image.width, original.x + deltaX)
      );
      image.y = Math.max(
        0,
        Math.min(boardHeight - image.height, original.y + deltaY)
      );
    }

    updateDrawingImageElement(image);
  }

  /* 新增：结束图片操作后只写入一条历史记录。 */
  function finishImageInteraction() {
    if (!imageInteraction) {
      return;
    }

    const image = drawingImages.find(function (item) {
      return item.id === imageInteraction.id;
    });
    const original = imageInteraction.original;
    const changed =
      image &&
      (image.x !== original.x ||
        image.y !== original.y ||
        image.width !== original.width ||
        image.height !== original.height);
    imageInteraction = null;
    window.removeEventListener("pointermove", continueImageInteraction);
    window.removeEventListener("pointerup", finishImageInteraction);
    window.removeEventListener("pointercancel", finishImageInteraction);

    if (changed) {
      commitDrawingHistory();
      scheduleSave();
    }
  }

  /* 新增：根据图片数据重建可移动、缩放和删除的画布对象。 */
  function renderDrawingImages() {
    drawingImageLayer.replaceChildren();

    drawingImages.forEach(function (image) {
      const element = document.createElement("div");
      const imageElement = document.createElement("img");
      const deleteButton = document.createElement("button");
      const resizeButton = document.createElement("button");
      element.className = "draft-board-image";
      element.dataset.imageId = image.id;
      element.tabIndex = activeDrawingTool === "move" ? 0 : -1;
      imageElement.src = image.src;
      imageElement.alt = image.name || "插入的画布图片";
      imageElement.draggable = false;
      deleteButton.type = "button";
      deleteButton.className = "draft-board-image-delete";
      deleteButton.setAttribute("aria-label", "删除图片");
      deleteButton.textContent = "×";
      resizeButton.type = "button";
      resizeButton.className = "draft-board-image-resize";
      resizeButton.setAttribute("aria-label", "缩放图片");
      resizeButton.textContent = "↘";
      element.append(imageElement, deleteButton, resizeButton);
      drawingImageLayer.appendChild(element);
      updateDrawingImageElement(image);

      element.addEventListener("pointerdown", function (event) {
        if (
          event.target === deleteButton ||
          event.target === resizeButton
        ) {
          return;
        }
        beginImageInteraction(event, image.id, "move");
      });
      element.addEventListener("focus", function () {
        selectDrawingImage(image.id);
      });
      deleteButton.addEventListener("pointerdown", function (event) {
        event.preventDefault();
        event.stopPropagation();
      });
      deleteButton.addEventListener("click", function () {
        deleteDrawingImage(image.id);
      });
      resizeButton.addEventListener("pointerdown", function (event) {
        beginImageInteraction(event, image.id, "resize");
      });
    });

    selectDrawingImage(selectedDrawingImageId);
  }

  /* 新增：移动模式可拖动画布视口，便于在大画布中导航。 */
  function beginCanvasPan(event) {
    if (
      activeDrawingTool !== "move" ||
      event.button !== 0 ||
      event.target.closest(".draft-board-image")
    ) {
      return;
    }

    event.preventDefault();
    selectDrawingImage(null);
    panInteraction = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: drawingViewport.scrollLeft,
      scrollTop: drawingViewport.scrollTop
    };
    drawingBoard.classList.add("is-panning");

    if (typeof drawingViewport.setPointerCapture === "function") {
      drawingViewport.setPointerCapture(event.pointerId);
    }
  }

  /* 新增：拖动时同步滚动画布视口。 */
  function continueCanvasPan(event) {
    if (!panInteraction || panInteraction.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    drawingViewport.scrollLeft =
      panInteraction.scrollLeft - (event.clientX - panInteraction.startX);
    drawingViewport.scrollTop =
      panInteraction.scrollTop - (event.clientY - panInteraction.startY);
  }

  /* 新增：结束画布平移并恢复移动指针。 */
  function finishCanvasPan(event) {
    if (!panInteraction || panInteraction.pointerId !== event.pointerId) {
      return;
    }

    panInteraction = null;
    drawingBoard.classList.remove("is-panning");
  }

  /* 新增：把本机图片压缩为适合浏览器草稿保存的画布资源。 */
  function prepareDrawingImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        reject(new Error("Unsupported image"));
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        reject(new Error("Image too large"));
        return;
      }

      const reader = new FileReader();
      reader.addEventListener("error", function () {
        reject(new Error("Image read failed"));
      });
      reader.addEventListener("load", function () {
        const sourceImage = new Image();
        sourceImage.addEventListener("error", function () {
          reject(new Error("Image decode failed"));
        });
        sourceImage.addEventListener("load", function () {
          const maximumDimension = 1400;
          const scale = Math.min(
            1,
            maximumDimension /
              Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight)
          );
          const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
          const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
          const imageCanvas = document.createElement("canvas");
          imageCanvas.width = width;
          imageCanvas.height = height;
          const imageContext = getDrawingContext(imageCanvas);

          if (!imageContext) {
            reject(new Error("Image canvas unavailable"));
            return;
          }

          imageContext.fillStyle = "#ffffff";
          imageContext.fillRect(0, 0, width, height);
          imageContext.drawImage(sourceImage, 0, 0, width, height);
          resolve({
            /* 修改：统一压缩为白底 JPEG，避免本地草稿被超大图片占满。 */
            src: imageCanvas.toDataURL("image/jpeg", 0.86),
            width: width,
            height: height,
            name: file.name || "画布图片"
          });
        });
        sourceImage.src = reader.result;
      });
      reader.readAsDataURL(file);
    });
  }

  /* 新增：将处理后的图片插入当前可见画布中央。 */
  async function insertDrawingImage(file) {
    insertImageButton.disabled = true;
    insertImageButton.textContent = "处理中…";

    try {
      const preparedImage = await prepareDrawingImage(file);
      const maximumWidth = 720;
      const maximumHeight = 520;
      const scale = Math.min(
        1,
        maximumWidth / preparedImage.width,
        maximumHeight / preparedImage.height
      );
      const width = Math.max(minimumImageSize, preparedImage.width * scale);
      const height = Math.max(minimumImageSize, preparedImage.height * scale);
      const x = Math.max(
        24,
        Math.min(
          boardWidth - width,
          (drawingViewport.scrollLeft +
            drawingViewport.clientWidth / 2) /
            boardZoom -
            width / 2
        )
      );
      const y = Math.max(
        24,
        Math.min(
          boardHeight - height,
          (drawingViewport.scrollTop +
            drawingViewport.clientHeight / 2) /
            boardZoom -
            height / 2
        )
      );
      const image = {
        id: createDrawingImageId(),
        src: preparedImage.src,
        name: preparedImage.name,
        x: x,
        y: y,
        width: width,
        height: height
      };
      drawingImages.push(image);
      setDrawingTool("move");
      selectedDrawingImageId = image.id;
      renderDrawingImages();
      commitDrawingHistory();
      scheduleSave();
      setActionStatus("图片已插入画布，可拖动或缩放。", "success");
    } catch (error) {
      setActionStatus("图片无法插入，请选择 15 MB 以内的常见图片格式。", "error");
    } finally {
      imageInput.value = "";
      insertImageButton.disabled = false;
      insertImageButton.textContent = "插入图片";
    }
  }

  /* 新增：等待已插入图片完成解码后再导出，避免图片区域空白。 */
  function waitForDrawingImages() {
    return Promise.all(
      Array.from(drawingImageLayer.querySelectorAll("img")).map(function (image) {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise(function (resolve) {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      })
    );
  }

  /* 新增：计算笔迹与图片的实际边界，导出时自动裁掉大画布空白。 */
  function getDrawingContentBounds() {
    let minimumX = boardWidth;
    let minimumY = boardHeight;
    let maximumX = 0;
    let maximumY = 0;

    drawingStrokes.forEach(function (stroke) {
      const padding = Math.max(4, Number(stroke.width) || 3);
      stroke.points.forEach(function (point) {
        minimumX = Math.min(minimumX, point.x - padding);
        minimumY = Math.min(minimumY, point.y - padding);
        maximumX = Math.max(maximumX, point.x + padding);
        maximumY = Math.max(maximumY, point.y + padding);
      });
    });
    drawingImages.forEach(function (image) {
      minimumX = Math.min(minimumX, image.x);
      minimumY = Math.min(minimumY, image.y);
      maximumX = Math.max(maximumX, image.x + image.width);
      maximumY = Math.max(maximumY, image.y + image.height);
    });

    if (minimumX > maximumX || minimumY > maximumY) {
      return null;
    }

    const margin = 36;
    const x = Math.max(0, minimumX - margin);
    const y = Math.max(0, minimumY - margin);
    return {
      x: x,
      y: y,
      width: Math.max(1, Math.min(boardWidth, maximumX + margin) - x),
      height: Math.max(1, Math.min(boardHeight, maximumY + margin) - y)
    };
  }

  /* 修改：把画布图片与透明笔迹合成为自动裁边的白底 PNG。 */
  function getHandwritingDataUrl() {
    const bounds = getDrawingContentBounds();

    if (!bounds) {
      return "";
    }

    const drawingScale = Math.min(2, 1600 / Math.max(1, bounds.width));
    const exportWidth = Math.max(1, Math.round(bounds.width * drawingScale));
    const exportHeight = Math.max(1, Math.round(bounds.height * drawingScale));
    const exportCanvas = document.createElement("canvas");
    const inkCanvas = document.createElement("canvas");
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    inkCanvas.width = exportWidth;
    inkCanvas.height = exportHeight;
    const exportContext = getDrawingContext(exportCanvas);
    const inkContext = getDrawingContext(inkCanvas);

    if (!exportContext || !inkContext) {
      return "";
    }

    exportContext.fillStyle = "#ffffff";
    exportContext.fillRect(0, 0, exportWidth, exportHeight);
    drawingImages.forEach(function (image) {
      const element = getDrawingImageElement(image.id);
      const imageElement = element ? element.querySelector("img") : null;

      if (imageElement && imageElement.complete && imageElement.naturalWidth) {
        exportContext.drawImage(
          imageElement,
          (image.x - bounds.x) * drawingScale,
          (image.y - bounds.y) * drawingScale,
          image.width * drawingScale,
          image.height * drawingScale
        );
      }
    });
    drawingStrokes.forEach(function (stroke) {
      drawStrokeOnContext(
        inkContext,
        stroke,
        drawingScale,
        bounds.x,
        bounds.y
      );
    });
    exportContext.drawImage(inkCanvas, 0, 0);

    try {
      return exportCanvas.toDataURL("image/png");
    } catch (error) {
      return "";
    }
  }

  /* 修改：重新打开同一道题时恢复三个模式及上次所在标签页。 */
  function restoreDraft() {
    try {
      const savedDraft = JSON.parse(localStorage.getItem(storageKey) || "null");

      if (!savedDraft) {
        updateLatexPreview();
        resizeDrawingCanvas();
        renderDrawingImages();
        resetDrawingHistory();
        return;
      }

      if (savedDraft.richHtml) {
        restoreRichHtml(savedDraft.richHtml);
      } else if (savedDraft.solutionText) {
        restorePlainTextAsRichText(savedDraft.solutionText);
      }
      latexSource.value = savedDraft.latex || "";
      boardWidth = Math.max(
        minimumBoardWidth,
        Math.min(
          maximumBoardWidth,
          Number(savedDraft.drawingBoard && savedDraft.drawingBoard.width) ||
            defaultBoardWidth
        )
      );
      boardHeight = Math.max(
        minimumBoardHeight,
        Math.min(
          maximumBoardHeight,
          Number(savedDraft.drawingBoard && savedDraft.drawingBoard.height) ||
            defaultBoardHeight
        )
      );
      boardZoom = Math.max(
        minimumBoardZoom,
        Math.min(
          maximumBoardZoom,
          Number(savedDraft.drawingBoard && savedDraft.drawingBoard.zoom) || 1
        )
      );
      pendingViewportCenter = {
        x:
          Number(savedDraft.drawingBoard && savedDraft.drawingBoard.centerX) ||
          boardWidth / 2,
        y:
          Number(savedDraft.drawingBoard && savedDraft.drawingBoard.centerY) ||
          boardHeight / 2
      };
      drawingViewportPositioned = false;
      drawingStrokes = normalizeDrawingStrokes(savedDraft.drawingStrokes);
      drawingImages = normalizeDrawingImages(savedDraft.drawingImages);
      updateLatexPreview();
      resizeDrawingCanvas();
      renderDrawingImages();
      resetDrawingHistory();
      activateMode(savedDraft.activeMode || "rich", false, false);
      setSaveState("已恢复草稿", "saved");
    } catch (error) {
      setSaveState("草稿恢复失败", "error");
      updateLatexPreview();
      drawingStrokes = [];
      drawingImages = [];
      resizeDrawingCanvas();
      renderDrawingImages();
      resetDrawingHistory();
    }
  }

  /* 新增：将浏览器生成的文件交给用户下载。 */
  function downloadBlob(blob, fileName) {
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(downloadUrl);
    }, 0);
  }

  /* 新增：将 MathLive 公式转换为导出纸张可渲染的静态标记。 */
  function createStaticFormula(latex, className) {
    const container = document.createElement("span");
    container.className = className || "draft-export-formula";

    try {
      if (
        window.MathLive &&
        typeof window.MathLive.convertLatexToMarkup === "function"
      ) {
        container.innerHTML = window.MathLive.convertLatexToMarkup(latex);
      } else {
        container.textContent = latex;
      }
    } catch (error) {
      container.textContent = latex;
    }

    return container;
  }

  /* 新增：构造图片与 PDF 共用的整洁白底导出纸张。 */
  function buildExportSheet(draft) {
    const sheet = document.createElement("article");
    const title = document.createElement("h1");
    const meta = document.createElement("p");
    sheet.className = "draft-export-sheet";
    title.textContent = problemId + " " + getProblemTitle();
    meta.className = "draft-export-meta";
    meta.textContent = "Mathverse 演算草稿";
    sheet.append(title, meta);

    if (draft.richText) {
      const section = document.createElement("section");
      const heading = document.createElement("h2");
      const richContent = document.createElement("div");
      section.className = "draft-export-section";
      heading.textContent = "图文混排";
      richContent.className = "draft-export-rich";
      richContent.innerHTML = draft.richHtml;

      Array.from(richContent.querySelectorAll("math-field")).forEach(function (
        formula
      ) {
        formula.replaceWith(
          createStaticFormula(
            formula.dataset.latex || formula.textContent || "",
            "draft-export-formula"
          )
        );
      });
      section.append(heading, richContent);
      sheet.appendChild(section);
    }

    if (draft.latex) {
      const section = document.createElement("section");
      const heading = document.createElement("h2");
      const render = document.createElement("div");
      const source = document.createElement("pre");
      section.className = "draft-export-section";
      heading.textContent = "LaTeX 演算";
      render.className = "draft-export-latex-render";
      Array.from(latexPreview.childNodes).forEach(function (renderedNode) {
        render.appendChild(renderedNode.cloneNode(true));
      });
      source.className = "draft-export-latex-source";
      source.textContent = draft.latex;
      section.append(heading, render, source);
      sheet.appendChild(section);
    }

    if (draft.drawingStrokes.length || draft.drawingImages.length) {
      const handwritingImage = getHandwritingDataUrl();

      if (handwritingImage) {
        const section = document.createElement("section");
        const heading = document.createElement("h2");
        const image = document.createElement("img");
        section.className = "draft-export-section";
        heading.textContent = "手写演算";
        image.className = "draft-export-handwriting";
        image.src = handwritingImage;
        image.alt = "手写演算草稿";
        section.append(heading, image);
        sheet.appendChild(section);
      }
    }

    document.body.appendChild(sheet);
    return sheet;
  }

  /* 新增：等待字体和手写图片就绪后再生成图片，避免导出缺字或空白。 */
  async function waitForExportSheet(sheet) {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (error) {
        /* 字体等待失败时继续使用浏览器回退字体。 */
      }
    }

    await Promise.all(
      Array.from(sheet.querySelectorAll("img")).map(function (image) {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise(function (resolve) {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      })
    );
  }

  /* 新增：使用 html2canvas 将导出纸张转换为高分辨率画布。 */
  async function renderExportCanvas(sheet) {
    if (typeof window.html2canvas !== "function") {
      throw new Error("Image export component unavailable");
    }

    await waitForExportSheet(sheet);
    return window.html2canvas(sheet, {
      backgroundColor: "#ffffff",
      logging: false,
      scale: 2,
      useCORS: true
    });
  }

  /* 新增：把画布安全地转换为 PNG Blob。 */
  function canvasToPngBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (typeof canvas.toBlob !== "function") {
        reject(new Error("Canvas Blob unavailable"));
        return;
      }

      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("PNG export failed"));
        }
      }, "image/png");
    });
  }

  /* 新增：生成包含三种模式文字提示的纯文本版本。 */
  function buildPlainText(draft) {
    const sections = [
      problemId + " " + getProblemTitle(),
      "Mathverse 演算草稿"
    ];

    if (draft.richText) {
      sections.push("【图文混排】\n" + draft.richText);
    }

    if (draft.latex) {
      sections.push("【LaTeX 演算】\n" + draft.latex);
    }

    if (draft.drawingStrokes.length || draft.drawingImages.length) {
      sections.push(
        "【手写演算】\n本草稿包含手写笔迹或插入图片，请使用图片或 PDF 查看完整画布。"
      );
    }

    return sections.join("\n\n") + "\n";
  }

  /* 新增：将导出画布按 A4 页面高度分片，避免长草稿被裁切。 */
  function saveCanvasAsPdf(canvas, fileName) {
    if (
      !window.jspdf ||
      typeof window.jspdf.jsPDF !== "function"
    ) {
      throw new Error("PDF export component unavailable");
    }

    const JsPdf = window.jspdf.jsPDF;
    const pdf = new JsPdf({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const pageSliceHeight = Math.max(
      1,
      Math.floor((canvas.width * usableHeight) / usableWidth)
    );
    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      const sliceHeight = Math.min(
        pageSliceHeight,
        canvas.height - offsetY
      );
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const pageContext = pageCanvas.getContext("2d");

      if (!pageContext) {
        throw new Error("PDF page canvas unavailable");
      }

      pageContext.fillStyle = "#ffffff";
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        pageCanvas.toDataURL("image/png"),
        "PNG",
        margin,
        margin,
        usableWidth,
        (sliceHeight * usableWidth) / canvas.width,
        undefined,
        "FAST"
      );
      offsetY += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(fileName);
  }

  /* 修改：按照下拉框选择导出 PNG、PDF 或纯文本。 */
  async function exportDraft() {
    const draft = collectDraft(false);

    if (!hasDraftContent(draft)) {
      setActionStatus("请先在任一模式中填写草稿。", "warning");
      return;
    }

    saveDraft();
    exportButton.disabled = true;
    const originalText = exportButton.textContent;
    exportButton.textContent = "导出中…";

    try {
      if (exportFormat.value === "text") {
        const textBlob = new Blob(["\ufeff" + buildPlainText(draft)], {
          type: "text/plain;charset=utf-8"
        });
        downloadBlob(textBlob, problemId + "-演算草稿.txt");
        setActionStatus("草稿已导出为纯文本。", "success");
        return;
      }

      await waitForDrawingImages();
      if (draft.latex) {
        window.clearTimeout(latexRenderTimer);
        await updateLatexPreview();
      }
      const sheet = buildExportSheet(draft);

      try {
        const canvas = await renderExportCanvas(sheet);

        if (exportFormat.value === "pdf") {
          saveCanvasAsPdf(canvas, problemId + "-演算草稿.pdf");
          setActionStatus("草稿已导出为 PDF。", "success");
        } else {
          const imageBlob = await canvasToPngBlob(canvas);
          downloadBlob(imageBlob, problemId + "-演算草稿.png");
          setActionStatus("草稿已导出为图片。", "success");
        }
      } finally {
        sheet.remove();
      }
    } catch (error) {
      setActionStatus(
        "导出组件未能完成加载，请刷新页面后重试。",
        "error"
      );
    } finally {
      exportButton.disabled = false;
      exportButton.textContent = originalText;
    }
  }

  /* 修改：接口暂不可用时保留待发布内容，防止用户的题解丢失。 */
  function savePendingPublication(draft) {
    try {
      const pendingDraft = Object.assign({}, draft, {
        handwritingImage: ""
      });
      localStorage.setItem(
        pendingPublishKey,
        JSON.stringify(pendingDraft)
      );
      setActionStatus(
        "当前未连接题解接口，内容已保存为待发布题解。",
        "warning"
      );
    } catch (error) {
      setActionStatus("发布失败，请先导出草稿后重试。", "error");
    }
  }

  /* 修改：向题解接口提交三个编辑模式的标准 JSON 数据。 */
  async function publishDraft() {
    const draft = collectDraft(false);

    if (!hasDraftContent(draft)) {
      setActionStatus("请先在任一模式中填写草稿。", "warning");
      return;
    }

    saveDraft();
    publishButton.disabled = true;
    publishButton.textContent = "发布中…";
    setActionStatus("正在提交到题解区……");

    await waitForDrawingImages();
    draft.handwritingImage = getHandwritingDataUrl();

    /* 修改：派发公开事件，便于后续页面框架接管发布流程。 */
    const publishEvent = new CustomEvent("mathverse:publish-solution", {
      detail: draft,
      cancelable: true
    });
    const handledByPage = !window.dispatchEvent(publishEvent);

    try {
      if (handledByPage) {
        setActionStatus("题解已交给页面发布流程。", "success");
        return;
      }

      const publishEndpoint = draftPanel.dataset.publishEndpoint;

      if (!publishEndpoint) {
        savePendingPublication(draft);
        return;
      }

      const response = await fetch(publishEndpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(draft)
      });

      if (!response.ok) {
        throw new Error("Publish request failed");
      }

      localStorage.removeItem(pendingPublishKey);
      setActionStatus("题解发布成功。", "success");
    } catch (error) {
      savePendingPublication(draft);
    } finally {
      publishButton.disabled = false;
      publishButton.textContent = "发布到题解区";
    }
  }

  /* 新增：为三个标签页绑定点击与方向键切换。 */
  modeTabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () {
      activateMode(tab.dataset.draftMode, false, true);
    });
    tab.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        (index + direction + modeTabs.length) % modeTabs.length;
      activateMode(
        modeTabs[nextIndex].dataset.draftMode,
        true,
        true
      );
    });
  });

  /* 新增：混排工具栏保持正文选区，并触发对应排版命令。 */
  richCommandButtons.forEach(function (button) {
    button.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });
    button.addEventListener("click", function () {
      runRichCommand(button.dataset.richCommand);
    });
  });
  insertFormulaButton.addEventListener("mousedown", function (event) {
    event.preventDefault();
  });
  insertFormulaButton.addEventListener("click", insertInlineFormula);
  formulaInsertButtons.forEach(function (button) {
    button.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });
    button.addEventListener("click", function () {
      insertFormulaTemplate(button.dataset.formulaInsert);
    });
  });
  richEditor.addEventListener("input", scheduleSave);
  richEditor.addEventListener("keyup", rememberRichSelection);
  richEditor.addEventListener("mouseup", rememberRichSelection);
  richEditor.addEventListener("focus", rememberRichSelection);
  richEditor.addEventListener("paste", pastePlainText);
  document.addEventListener("selectionchange", rememberRichSelection);

  /* 新增：LaTeX 输入区支持实时渲染，并允许 Tab 键插入两个空格。 */
  latexSource.addEventListener("input", function () {
    scheduleLatexPreview();
    scheduleSave();
  });
  latexSource.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    const start = latexSource.selectionStart;
    const end = latexSource.selectionEnd;
    latexSource.setRangeText("  ", start, end, "end");
    scheduleLatexPreview();
    scheduleSave();
  });
  latexInsertButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      insertLatexTemplate(button.dataset.latexInsert);
    });
  });

  /* 修改：画板工具、快捷色、图片与双向撤销共用同一套草稿状态。 */
  drawingToolButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setDrawingTool(button.dataset.drawingTool);
    });
  });
  drawingColorButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setInkColor(button.dataset.inkColorValue, true);
    });
  });
  inkColor.addEventListener("input", function () {
    setInkColor(inkColor.value, true);
  });
  inkWidth.addEventListener("input", updateDrawingCursorAppearance);
  insertImageButton.addEventListener("click", function () {
    imageInput.click();
  });
  imageInput.addEventListener("change", function () {
    if (imageInput.files && imageInput.files[0]) {
      insertDrawingImage(imageInput.files[0]);
    }
  });
  drawingUndoButton.addEventListener("click", undoDrawing);
  drawingRedoButton.addEventListener("click", redoDrawing);
  drawingClearButton.addEventListener("click", clearDrawing);
  zoomOutButton.addEventListener("click", function () {
    setDrawingZoom(boardZoom - boardZoomStep);
  });
  zoomInButton.addEventListener("click", function () {
    setDrawingZoom(boardZoom + boardZoomStep);
  });
  zoomResetButton.addEventListener("click", function () {
    setDrawingZoom(1);
  });
  drawingCanvas.addEventListener("pointerdown", beginDrawing);
  drawingCanvas.addEventListener("pointermove", continueDrawing);
  drawingCanvas.addEventListener("pointerup", finishDrawing);
  drawingCanvas.addEventListener("pointercancel", finishDrawing);
  drawingCanvas.addEventListener("pointerenter", moveDrawingCursor);
  drawingCanvas.addEventListener("pointerleave", hideDrawingCursor);
  drawingViewport.addEventListener("pointerdown", beginCanvasPan);
  drawingViewport.addEventListener("pointermove", continueCanvasPan);
  drawingViewport.addEventListener("pointerup", finishCanvasPan);
  drawingViewport.addEventListener("pointercancel", finishCanvasPan);
  drawingViewport.addEventListener("scroll", expandDrawingBoardIfNeeded, {
    passive: true
  });
  drawingViewport.addEventListener(
    "wheel",
    function (event) {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();
      setDrawingZoom(
        boardZoom + (event.deltaY < 0 ? boardZoomStep : -boardZoomStep),
        event.clientX,
        event.clientY
      );
    },
    { passive: false }
  );
  drawingViewport.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();

    if (
      activeDrawingTool === "move" &&
      selectedDrawingImageId &&
      (event.key === "Delete" || event.key === "Backspace")
    ) {
      event.preventDefault();
      deleteDrawingImage(selectedDrawingImageId);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();

      if (event.shiftKey) {
        redoDrawing();
      } else {
        undoDrawing();
      }
    } else if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      redoDrawing();
    }
  });

  /* 修改：导出与发布按钮分别调用新的三模式数据流程。 */
  exportButton.addEventListener("click", exportDraft);
  publishButton.addEventListener("click", publishDraft);

  /* 新增：窗口宽度变化时按比例重画手写内容，不清除已有笔迹。 */
  window.addEventListener("resize", function () {
    const center = getDrawingViewportCenter();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      resizeDrawingCanvas();
      positionDrawingViewport(center.x, center.y);
    }, 120);
  });

  /* 新增：页面切到后台前立即保存，减少关闭标签页造成的草稿丢失。 */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      window.clearTimeout(saveTimer);
      saveDraft();
    }
  });

  restoreDraft();
  setDrawingTool("pen");
  resizeDrawingCanvas();
});
