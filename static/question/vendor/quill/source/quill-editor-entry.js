import Quill from "quill";
import MathLive from "mathlive/dist/mathlive.js";
import mathLiveBlot from "quill-mathlive-blot";

/*
 * Mathverse Quill 文档编辑器构建入口。
 * 浏览器实际加载 vendor/quill/quill-editor.min.js；公式块使用
 * quill-mathlive-blot，行内公式复用同一套 MathLive 输入能力。
 */

const Delta = Quill.import("delta");
const BlockEmbed = Quill.import("blots/block/embed");
const Embed = Quill.import("blots/embed");
const BaseLink = Quill.import("formats/link");
const editorInstances = new Map();
let nextEditorId = 1;

function normalizeFormulaValue(value) {
  if (value && typeof value === "object") {
    return String(value.latex || value.value || "");
  }
  return String(value || "");
}

function createMathField(node, content) {
  const mount = document.createElement("span");
  mount.className = "mathverse-mathlive-mount";
  node.setAttribute("contenteditable", "false");
  node.appendChild(mount);
  node.MathLiveField = MathLive.makeMathField(mount, mathLiveBlot.options);
  node.MathLiveField.$latex(normalizeFormulaValue(content), {
    suppressChangeNotifications: true
  });
  node.addEventListener("click", function () {
    node.MathLiveField.$focus();
  });
  return node;
}

/* 新增：插件原生公式是块级节点；行内公式使用同一 MathLive 配置。 */
class MathLiveInlineBlot extends Embed {
  static create(content) {
    return createMathField(super.create(), content);
  }

  static value(node) {
    return node.MathLiveField ? node.MathLiveField.$latex() : "";
  }
}

MathLiveInlineBlot.blotName = "mathLiveInline";
MathLiveInlineBlot.tagName = "span";
MathLiveInlineBlot.className = "mathLiveInlineBlot";

/* 新增：题解图片使用独立块节点，避免图片控制点进入保存内容。 */
class SolutionImageBlot extends BlockEmbed {
  static create(value) {
    const image = value && typeof value === "object" ? value : { src: value };
    const node = super.create();
    const picture = document.createElement("img");
    const handle = document.createElement("button");

    node.setAttribute("contenteditable", "false");
    node.setAttribute("draggable", "true");
    picture.src = String(image.src || "");
    picture.alt = String(image.alt || "题解图片").slice(0, 300);
    picture.title = String(image.title || "").slice(0, 300);
    picture.loading = "lazy";
    if (Number(image.width) > 0) {
      picture.width = Math.round(Number(image.width));
    }
    if (Number(image.height) > 0) {
      picture.height = Math.round(Number(image.height));
    }
    handle.type = "button";
    handle.className = "mathverse-image-resize";
    handle.setAttribute("aria-label", "拖动缩放图片");
    handle.tabIndex = -1;
    node.append(picture, handle);
    return node;
  }

  static value(node) {
    const image = node.querySelector("img");
    return image
      ? {
          src: image.currentSrc || image.src || "",
          alt: image.alt || "题解图片",
          title: image.title || "",
          width: image.width || image.naturalWidth || null,
          height: image.height || image.naturalHeight || null
        }
      : { src: "" };
  }
}

SolutionImageBlot.blotName = "solutionImage";
SolutionImageBlot.tagName = "figure";
SolutionImageBlot.className = "mathverse-image-blot";

class DividerBlot extends BlockEmbed {}

DividerBlot.blotName = "divider";
DividerBlot.tagName = "hr";
DividerBlot.className = "mathverse-divider-blot";

/* 修改：链接值同时保存地址与打开方式，并统一补充安全属性。 */
class MathverseLinkBlot extends BaseLink {
  static create(value) {
    const attributes =
      value && typeof value === "object" ? value : { href: value };
    const node = super.create(attributes.href || "");
    node.setAttribute("rel", "noopener noreferrer nofollow");
    if (attributes.target === "_blank") {
      node.setAttribute("target", "_blank");
    } else {
      node.removeAttribute("target");
    }
    return node;
  }

  static formats(node) {
    return {
      href: node.getAttribute("href") || "",
      target: node.getAttribute("target") === "_blank" ? "_blank" : ""
    };
  }

  format(name, value) {
    if (name !== this.statics.blotName || !value) {
      super.format(name, value);
      return;
    }

    const attributes =
      value && typeof value === "object" ? value : { href: value };
    this.domNode.setAttribute("href", this.statics.sanitize(attributes.href));
    this.domNode.setAttribute("rel", "noopener noreferrer nofollow");
    if (attributes.target === "_blank") {
      this.domNode.setAttribute("target", "_blank");
    } else {
      this.domNode.removeAttribute("target");
    }
  }
}

MathverseLinkBlot.blotName = "link";

/* 修改：先注册插件原生块公式，再补充题解需要的行内公式和图片节点。 */
mathLiveBlot.options.smartMode = true;
mathLiveBlot.options.virtualKeyboardMode = "manual";
mathLiveBlot.options.virtualKeyboardLayout = "qwerty";
mathLiveBlot.options.virtualKeyboardTheme = "material";
mathLiveBlot.options.virtualKeyboards = "all";
mathLiveBlot.register(Quill);
Quill.register(MathLiveInlineBlot, true);
Quill.register(SolutionImageBlot, true);
Quill.register(DividerBlot, true);
Quill.register(MathverseLinkBlot, true);

function getInstanceForMathField(mathfield) {
  if (!mathfield || typeof mathfield.$el !== "function") {
    return null;
  }
  const mount = mathfield.$el();
  const container = mount && mount.closest("[data-mathverse-quill-id]");
  return container
    ? editorInstances.get(container.dataset.mathverseQuillId) || null
    : null;
}

mathLiveBlot.options.onFocus = function (mathfield) {
  const instance = getInstanceForMathField(mathfield);
  if (instance) {
    instance.activateFormula(mathfield);
  }
};

mathLiveBlot.options.onContentDidChange = function (mathfield) {
  const instance = getInstanceForMathField(mathfield);
  if (instance) {
    instance.handleFormulaChange(mathfield);
  }
};

mathLiveBlot.options.onMoveOutOf = function (mathfield, direction) {
  const instance = getInstanceForMathField(mathfield);
  if (!instance) {
    return true;
  }
  instance.moveOutOfFormula(mathfield, direction);
  return false;
};

function countDocumentText(text) {
  const value = String(text || "").trim();
  const chineseCharacters = (value.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || [])
    .length;
  const latinWords = (
    value
      .replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ")
      .match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []
  ).length;

  return {
    words: chineseCharacters + latinWords,
    characters: Array.from(value.replace(/\s/g, "")).length
  };
}

function deltaToPlainText(delta) {
  return (delta && Array.isArray(delta.ops) ? delta.ops : [])
    .map(function (operation) {
      if (typeof operation.insert === "string") {
        return operation.insert;
      }
      if (operation.insert && operation.insert.mathLiveInline !== undefined) {
        return "$" + normalizeFormulaValue(operation.insert.mathLiveInline) + "$";
      }
      if (operation.insert && operation.insert.mathLive !== undefined) {
        return "\n$$\n" + normalizeFormulaValue(operation.insert.mathLive) + "\n$$\n";
      }
      if (operation.insert && operation.insert.solutionImage) {
        return "\n[图片：" + (operation.insert.solutionImage.alt || "题解图片") + "]\n";
      }
      return operation.insert && operation.insert.divider ? "\n---\n" : "";
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tiptapJsonToHtml(documentJson) {
  if (!documentJson || documentJson.type !== "doc") {
    return "<p></p>";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderNode(node) {
    if (!node) {
      return "";
    }
    if (node.type === "text") {
      let text = escapeHtml(node.text);
      (node.marks || []).forEach(function (mark) {
        if (mark.type === "bold") text = "<strong>" + text + "</strong>";
        if (mark.type === "italic") text = "<em>" + text + "</em>";
        if (mark.type === "underline") text = "<u>" + text + "</u>";
        if (mark.type === "strike") text = "<s>" + text + "</s>";
        if (mark.type === "subscript") text = "<sub>" + text + "</sub>";
        if (mark.type === "superscript") text = "<sup>" + text + "</sup>";
        if (mark.type === "link") {
          text = '<a href="' + escapeHtml(mark.attrs && mark.attrs.href) + '">' + text + "</a>";
        }
      });
      return text;
    }
    if (node.type === "hardBreak") return "<br>";
    if (node.type === "horizontalRule") return "<hr>";
    if (node.type === "inlineMath") {
      const latex = escapeHtml(node.attrs && node.attrs.latex);
      return '<span data-type="inline-math" data-latex="' + latex + '"></span>';
    }
    if (node.type === "blockMath") {
      const latex = escapeHtml(node.attrs && node.attrs.latex);
      return '<div data-type="block-math" data-latex="' + latex + '"></div>';
    }
    if (node.type === "image") {
      const attrs = node.attrs || {};
      return (
        '<img src="' + escapeHtml(attrs.src) + '" alt="' +
        escapeHtml(attrs.alt || "题解图片") + '">'
      );
    }

    const content = (node.content || []).map(renderNode).join("");
    if (node.type === "paragraph") return "<p>" + content + "</p>";
    if (node.type === "heading") {
      const level = Math.max(2, Math.min(4, Number(node.attrs && node.attrs.level) || 2));
      return "<h" + level + ">" + content + "</h" + level + ">";
    }
    if (node.type === "blockquote") return "<blockquote>" + content + "</blockquote>";
    if (node.type === "codeBlock") return "<pre>" + content + "</pre>";
    if (node.type === "bulletList") return "<ul>" + content + "</ul>";
    if (node.type === "orderedList") return "<ol>" + content + "</ol>";
    if (node.type === "listItem") return "<li>" + content + "</li>";
    return content;
  }

  return (documentJson.content || []).map(renderNode).join("") || "<p></p>";
}

function createDocumentEditor(options) {
  if (!options || !options.element) {
    throw new Error("Quill editor mount element is required");
  }

  const editorId = String(nextEditorId++);
  const element = options.element;
  let stateFrame = null;
  let suppressUpdates = true;
  let activeFormulaNode = null;
  let savedRange = { index: 0, length: 0 };
  let resizeState = null;

  element.dataset.mathverseQuillId = editorId;
  const quill = new Quill(element, {
    theme: "snow",
    placeholder:
      options.placeholder ||
      "从这里开始写题目解析。支持标题、列表、图片和可直接编辑的数学公式。",
    modules: {
      toolbar: false,
      history: { delay: 700, maxStack: 120, userOnly: true },
      clipboard: { matchVisual: false }
    },
    formats: [
      "header", "bold", "italic", "underline", "strike", "script",
      "color", "background", "list", "indent", "align", "blockquote",
      "code-block", "link", "mathLive", "mathLiveInline", "solutionImage",
      "divider"
    ]
  });

  quill.root.classList.add("draft-document-content");
  quill.root.setAttribute("role", "textbox");
  quill.root.setAttribute("aria-label", "数学题解析正文");
  quill.root.setAttribute("aria-multiline", "true");
  quill.root.setAttribute("spellcheck", "true");

  function getRange() {
    const range = quill.getSelection();
    return range || savedRange || { index: Math.max(0, quill.getLength() - 1), length: 0 };
  }

  function notifyState() {
    if (typeof options.onStateChange !== "function") {
      return;
    }
    if (stateFrame !== null) {
      window.cancelAnimationFrame(stateFrame);
    }
    stateFrame = window.requestAnimationFrame(function () {
      stateFrame = null;
      options.onStateChange(api.getState());
    });
  }

  function notifyUpdate() {
    if (suppressUpdates) {
      return;
    }
    if (typeof options.onUpdate === "function") {
      options.onUpdate();
    }
    notifyState();
  }

  function getFormulaNodeForField(mathfield) {
    const mount = mathfield && typeof mathfield.$el === "function" ? mathfield.$el() : null;
    return mount ? mount.closest(".mathLiveBlot, .mathLiveInlineBlot") : null;
  }

  function setActiveFormula(node) {
    if (activeFormulaNode && activeFormulaNode !== node) {
      activeFormulaNode.classList.remove("is-active");
    }
    activeFormulaNode = node || null;
    if (activeFormulaNode) {
      activeFormulaNode.classList.add("is-active");
    }
    if (typeof options.onFormulaFocus === "function") {
      options.onFormulaFocus(api.getActiveFormula());
    }
  }

  function getFormulaIndex(node) {
    try {
      const blot = node ? Quill.find(node) : null;
      return blot ? quill.getIndex(blot) : -1;
    } catch (error) {
      return -1;
    }
  }

  function findFormulaAt(type, position) {
    const selector = type === "blockMath" ? ".mathLiveBlot" : ".mathLiveInlineBlot";
    return Array.from(quill.root.querySelectorAll(selector)).find(function (node) {
      return getFormulaIndex(node) === Number(position);
    }) || null;
  }

  function focusFormulaAt(type, position) {
    window.requestAnimationFrame(function () {
      const node = findFormulaAt(type, position);
      if (!node || !node.MathLiveField) {
        return;
      }
      setActiveFormula(node);
      node.MathLiveField.$focus();
    });
  }

  function convertHtmlToDelta(html) {
    const container = document.createElement("div");
    container.innerHTML = String(html || "<p></p>");

    Array.from(container.querySelectorAll("math-field[data-latex]")).forEach(function (field) {
      const replacement = document.createElement("span");
      replacement.dataset.type = "inline-math";
      replacement.dataset.latex = field.dataset.latex || field.textContent || "";
      field.replaceWith(replacement);
    });
    return quill.clipboard.convert(container.innerHTML);
  }

  quill.clipboard.addMatcher("SPAN", function (node, delta) {
    if (node.dataset && node.dataset.type === "inline-math") {
      return new Delta().insert({
        mathLiveInline: node.dataset.latex || node.textContent || ""
      });
    }
    return delta;
  });
  quill.clipboard.addMatcher("DIV", function (node, delta) {
    if (node.dataset && node.dataset.type === "block-math") {
      return new Delta().insert({
        mathLive: node.dataset.latex || node.textContent || ""
      });
    }
    return delta;
  });
  quill.clipboard.addMatcher("IMG", function (node) {
    return new Delta().insert({
      solutionImage: {
        src: node.getAttribute("src") || "",
        alt: node.getAttribute("alt") || "题解图片",
        title: node.getAttribute("title") || "",
        width: Number(node.getAttribute("width")) || null,
        height: Number(node.getAttribute("height")) || null
      }
    });
  });
  quill.clipboard.addMatcher("HR", function () {
    return new Delta().insert({ divider: true });
  });

  function setContent(content) {
    suppressUpdates = true;
    try {
      let delta;
      if (content && Array.isArray(content.ops)) {
        delta = new Delta(content.ops);
      } else if (content && content.type === "doc") {
        delta = convertHtmlToDelta(tiptapJsonToHtml(content));
      } else {
        delta = convertHtmlToDelta(content || "<p></p>");
      }
      quill.setContents(delta, Quill.sources.SILENT);
      quill.history.clear();
      savedRange = { index: Math.max(0, quill.getLength() - 1), length: 0 };
      quill.setSelection(savedRange.index, 0, Quill.sources.SILENT);
    } finally {
      suppressUpdates = false;
      notifyState();
    }
  }

  function serializeHtml() {
    const sourceFormulaNodes = Array.from(
      quill.root.querySelectorAll(".mathLiveBlot, .mathLiveInlineBlot")
    );
    const clone = quill.root.cloneNode(true);
    const cloneFormulaNodes = Array.from(
      clone.querySelectorAll(".mathLiveBlot, .mathLiveInlineBlot")
    );

    /* 修改：Quill 的呈现类转换为可独立发布的内联样式。 */
    Array.from(clone.querySelectorAll("[class]")).forEach(function (node) {
      ["center", "right", "justify"].forEach(function (alignment) {
        if (node.classList.contains("ql-align-" + alignment)) {
          node.style.textAlign = alignment;
        }
      });
      const indentClass = Array.from(node.classList).find(function (className) {
        return /^ql-indent-[1-8]$/.test(className);
      });
      if (indentClass) {
        node.style.marginLeft = String(Number(indentClass.slice(-1)) * 2) + "em";
      }
    });

    sourceFormulaNodes.forEach(function (node, index) {
      const latex = node.MathLiveField ? node.MathLiveField.$latex() : "";
      const isBlock = node.classList.contains("mathLiveBlot");
      const replacement = document.createElement(isBlock ? "div" : "span");
      replacement.dataset.type = isBlock ? "block-math" : "inline-math";
      replacement.dataset.latex = latex;
      replacement.textContent = isBlock ? "\\[" + latex + "\\]" : "\\(" + latex + "\\)";
      if (cloneFormulaNodes[index]) {
        cloneFormulaNodes[index].replaceWith(replacement);
      }
    });

    Array.from(clone.querySelectorAll("figure.mathverse-image-blot")).forEach(function (figure) {
      const source = figure.querySelector("img");
      if (!source) {
        figure.remove();
        return;
      }
      const image = document.createElement("img");
      image.src = source.getAttribute("src") || "";
      image.alt = source.getAttribute("alt") || "题解图片";
      image.title = source.getAttribute("title") || "";
      if (source.getAttribute("width")) image.setAttribute("width", source.getAttribute("width"));
      if (source.getAttribute("height")) image.setAttribute("height", source.getAttribute("height"));
      figure.replaceWith(image);
    });
    Array.from(clone.querySelectorAll("hr.mathverse-divider-blot")).forEach(function (divider) {
      divider.removeAttribute("class");
      divider.removeAttribute("contenteditable");
    });
    clone.removeAttribute("contenteditable");
    clone.removeAttribute("data-gramm");
    return clone.innerHTML;
  }

  function formatToggle(name, value) {
    const range = getRange();
    const current = quill.getFormat(range)[name];
    quill.focus();
    quill.setSelection(range.index, range.length, Quill.sources.SILENT);
    quill.format(name, current === value || (value === true && current) ? false : value, Quill.sources.USER);
    return true;
  }

  function applyFormat(name, value) {
    const range = getRange();
    quill.focus();
    quill.setSelection(range.index, range.length, Quill.sources.SILENT);
    quill.format(name, value, Quill.sources.USER);
    return true;
  }

  const commandMap = {
    undo: function () { quill.history.undo(); return true; },
    redo: function () { quill.history.redo(); return true; },
    bold: function () { return formatToggle("bold", true); },
    italic: function () { return formatToggle("italic", true); },
    underline: function () { return formatToggle("underline", true); },
    strike: function () { return formatToggle("strike", true); },
    superscript: function () { return formatToggle("script", "super"); },
    subscript: function () { return formatToggle("script", "sub"); },
    bulletList: function () { return formatToggle("list", "bullet"); },
    orderedList: function () { return formatToggle("list", "ordered"); },
    blockquote: function () { return formatToggle("blockquote", true); },
    codeBlock: function () { return formatToggle("code-block", true); },
    alignLeft: function () { return applyFormat("align", false); },
    alignCenter: function () { return formatToggle("align", "center"); },
    alignRight: function () { return formatToggle("align", "right"); },
    alignJustify: function () { return formatToggle("align", "justify"); },
    indent: function () { return applyFormat("indent", "+1"); },
    outdent: function () { return applyFormat("indent", "-1"); },
    clearFormatting: function () {
      const range = getRange();
      if (range.length) {
        quill.removeFormat(range.index, range.length, Quill.sources.USER);
      } else {
        quill.focus();
        quill.setSelection(range.index, 0, Quill.sources.SILENT);
        ["bold", "italic", "underline", "strike", "script", "color", "background", "link"]
          .forEach(function (format) { quill.format(format, false, Quill.sources.USER); });
      }
      return true;
    },
    horizontalRule: function () {
      const range = getRange();
      quill.insertEmbed(range.index, "divider", true, Quill.sources.USER);
      quill.insertText(range.index + 1, "\n", Quill.sources.SILENT);
      quill.setSelection(range.index + 2, 0, Quill.sources.SILENT);
      return true;
    }
  };

  const api = {
    quill: quill,
    run: function (name) {
      const result = commandMap[name] ? commandMap[name]() : false;
      notifyState();
      return result;
    },
    focus: function () {
      quill.focus();
      quill.setSelection(savedRange.index, savedRange.length, Quill.sources.SILENT);
    },
    getHTML: serializeHtml,
    getDelta: function () {
      return JSON.parse(JSON.stringify(quill.getContents()));
    },
    getJSON: function () {
      return api.getDelta();
    },
    getText: function () {
      return deltaToPlainText(quill.getContents());
    },
    setContent: setContent,
    setBlockStyle: function (style) {
      const range = getRange();
      quill.setSelection(range.index, range.length, Quill.sources.SILENT);
      quill.format("blockquote", false, Quill.sources.USER);
      quill.format("code-block", false, Quill.sources.USER);
      quill.format("header", false, Quill.sources.USER);
      if (/^heading-[234]$/.test(style)) {
        quill.format("header", Number(style.slice(-1)), Quill.sources.USER);
      } else if (style === "blockquote") {
        quill.format("blockquote", true, Quill.sources.USER);
      } else if (style === "codeBlock") {
        quill.format("code-block", true, Quill.sources.USER);
      }
      return true;
    },
    setColor: function (color) {
      return applyFormat("color", color);
    },
    unsetColor: function () {
      return applyFormat("color", false);
    },
    setHighlight: function (color) {
      return applyFormat("background", color);
    },
    unsetHighlight: function () {
      return applyFormat("background", false);
    },
    getSelectionText: function () {
      const range = getRange();
      return range.length ? quill.getText(range.index, range.length) : "";
    },
    getLinkAttributes: function () {
      const link = quill.getFormat(getRange()).link;
      return typeof link === "string" ? { href: link, target: "_blank" } : link || {};
    },
    setLink: function (href, text, openInNewTab) {
      const range = getRange();
      const value = { href: href, target: openInNewTab ? "_blank" : "" };
      if (range.length) {
        quill.formatText(range.index, range.length, "link", value, Quill.sources.USER);
      } else {
        const label = text || href;
        quill.insertText(range.index, label, "link", value, Quill.sources.USER);
        quill.setSelection(range.index + label.length, 0, Quill.sources.SILENT);
      }
      return true;
    },
    unsetLink: function () {
      const range = getRange();
      quill.formatText(range.index, Math.max(1, range.length), "link", false, Quill.sources.USER);
      return true;
    },
    insertImage: function (image) {
      const range = getRange();
      quill.insertEmbed(range.index, "solutionImage", image, Quill.sources.USER);
      quill.insertText(range.index + 1, "\n", Quill.sources.SILENT);
      quill.setSelection(range.index + 2, 0, Quill.sources.SILENT);
      return true;
    },
    insertFormula: function (type, latex) {
      const range = getRange();
      const isBlock = type === "blockMath";
      quill.insertEmbed(
        range.index,
        isBlock ? "mathLive" : "mathLiveInline",
        latex || "",
        Quill.sources.USER
      );
      if (isBlock) {
        quill.insertText(range.index + 1, "\n", Quill.sources.SILENT);
      }
      savedRange = { index: range.index + 1, length: 0 };
      quill.setSelection(savedRange.index, 0, Quill.sources.SILENT);
      focusFormulaAt(type, range.index);
      return true;
    },
    updateFormula: function (type, position, latex) {
      const node = findFormulaAt(type, position);
      if (!node || !node.MathLiveField) return false;
      node.MathLiveField.$latex(latex || "");
      setActiveFormula(node);
      return true;
    },
    deleteFormula: function (type, position) {
      const node = findFormulaAt(type, position);
      const index = getFormulaIndex(node);
      if (index < 0) return false;
      quill.deleteText(index, 1, Quill.sources.USER);
      setActiveFormula(null);
      return true;
    },
    getActiveFormula: function () {
      if (!activeFormulaNode || !activeFormulaNode.isConnected) {
        return null;
      }
      return {
        type: activeFormulaNode.classList.contains("mathLiveBlot")
          ? "blockMath"
          : "inlineMath",
        latex: activeFormulaNode.MathLiveField
          ? activeFormulaNode.MathLiveField.$latex()
          : "",
        pos: getFormulaIndex(activeFormulaNode)
      };
    },
    insertFormulaTemplate: function (latex) {
      if (!activeFormulaNode || !activeFormulaNode.MathLiveField) {
        return false;
      }
      activeFormulaNode.MathLiveField.$focus();
      activeFormulaNode.MathLiveField.$insert(latex, {
        insertionMode: "replaceSelection",
        selectionMode: "placeholder",
        focus: true
      });
      return true;
    },
    deleteActiveFormula: function () {
      const formula = api.getActiveFormula();
      return formula ? api.deleteFormula(formula.type, formula.pos) : false;
    },
    getState: function () {
      const range = getRange();
      const format = quill.getFormat(range);
      const count = countDocumentText(deltaToPlainText(quill.getContents()));
      let blockStyle = "paragraph";
      if ([2, 3, 4].includes(Number(format.header))) {
        blockStyle = "heading-" + Number(format.header);
      } else if (format.blockquote) {
        blockStyle = "blockquote";
      } else if (format["code-block"]) {
        blockStyle = "codeBlock";
      }
      return {
        active: {
          bold: Boolean(format.bold),
          italic: Boolean(format.italic),
          underline: Boolean(format.underline),
          strike: Boolean(format.strike),
          superscript: format.script === "super",
          subscript: format.script === "sub",
          bulletList: format.list === "bullet",
          orderedList: format.list === "ordered",
          blockquote: Boolean(format.blockquote),
          alignLeft: !format.align,
          alignCenter: format.align === "center",
          alignRight: format.align === "right",
          alignJustify: format.align === "justify",
          link: Boolean(format.link)
        },
        blockStyle: blockStyle,
        canUndo: quill.history.stack.undo.length > 0,
        canRedo: quill.history.stack.redo.length > 0,
        words: count.words,
        characters: count.characters,
        activeFormula: api.getActiveFormula()
      };
    },
    activateFormula: function (mathfield) {
      setActiveFormula(getFormulaNodeForField(mathfield));
      notifyState();
    },
    handleFormulaChange: function (mathfield) {
      setActiveFormula(getFormulaNodeForField(mathfield));
      notifyUpdate();
    },
    moveOutOfFormula: function (mathfield, direction) {
      const node = getFormulaNodeForField(mathfield);
      const index = getFormulaIndex(node);
      if (index < 0) return;
      savedRange = { index: direction === "backward" ? index : index + 1, length: 0 };
      quill.setSelection(savedRange.index, 0, Quill.sources.USER);
      quill.focus();
    },
    destroy: function () {
      if (stateFrame !== null) window.cancelAnimationFrame(stateFrame);
      editorInstances.delete(editorId);
      element.removeEventListener("paste", handleFileTransfer, true);
      element.removeEventListener("drop", handleFileTransfer, true);
      quill.off("text-change", handleTextChange);
      quill.off("selection-change", handleSelectionChange);
      quill.disable();
    }
  };

  function handleTextChange(_delta, _oldDelta, source) {
    if (source !== Quill.sources.SILENT) notifyUpdate();
  }

  function handleSelectionChange(range) {
    if (range) savedRange = { index: range.index, length: range.length };
    notifyState();
  }

  function handleFileTransfer(event) {
    const transfer = event.clipboardData || event.dataTransfer;
    const files = Array.from((transfer && transfer.files) || []);
    const image = files.find(function (file) {
      return file.type && file.type.indexOf("image/") === 0;
    });
    if (!image || typeof options.onImageFile !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    options.onImageFile(image);
  }

  function stopImageResize() {
    if (!resizeState) return;
    window.removeEventListener("pointermove", resizeImage);
    window.removeEventListener("pointerup", stopImageResize);
    window.removeEventListener("pointercancel", stopImageResize);
    resizeState = null;
    notifyUpdate();
  }

  function resizeImage(event) {
    if (!resizeState) return;
    const width = Math.max(96, Math.min(720, resizeState.width + event.clientX - resizeState.x));
    const ratio = resizeState.height / resizeState.width;
    resizeState.image.width = Math.round(width);
    resizeState.image.height = Math.round(width * ratio);
  }

  element.addEventListener("pointerdown", function (event) {
    const handle = event.target.closest && event.target.closest(".mathverse-image-resize");
    if (!handle) return;
    const image = handle.parentElement.querySelector("img");
    if (!image) return;
    event.preventDefault();
    resizeState = {
      image: image,
      x: event.clientX,
      width: image.getBoundingClientRect().width || image.width || 320,
      height: image.getBoundingClientRect().height || image.height || 180
    };
    window.addEventListener("pointermove", resizeImage);
    window.addEventListener("pointerup", stopImageResize);
    window.addEventListener("pointercancel", stopImageResize);
  });

  quill.on("text-change", handleTextChange);
  quill.on("selection-change", handleSelectionChange);
  element.addEventListener("paste", handleFileTransfer, true);
  element.addEventListener("drop", handleFileTransfer, true);
  editorInstances.set(editorId, api);
  setContent(options.content || "<p></p>");
  suppressUpdates = false;
  notifyState();
  return api;
}

window.MathverseQuillEditor = Object.freeze({
  create: createDocumentEditor,
  version: "1.0.0",
  engine: "Quill " + Quill.version,
  formulaPlugin: "quill-mathlive-blot 1.5.0"
});
