const canvas = document.querySelector("#galaxy-canvas");
const stage = document.querySelector("#galaxy-stage");
const context = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const typeColors = {
  galaxy: "#f2d49a",
  module: "#a49aff",
  concept: "#59d7ee",
  tag: "#e6b96f",
  problem: "#dce5ff"
};

const typeNames = {
  galaxy: "学科星云",
  module: "知识模块",
  concept: "知识点",
  tag: "结构 / 方法标签",
  problem: "题目"
};

const fieldColors = {
  function: "#7376ed",
  geometry: "#45c8dc",
  sequence: "#d3a057",
  probability: "#4cb493"
};

const fieldNames = {
  function: "函数与导数",
  geometry: "几何与向量",
  sequence: "代数与数列",
  probability: "概率与统计"
};

const nodes = [
  {
    id: "galaxy-function", label: "函数与导数", type: "galaxy", field: "function", x: 0, y: 0, progress: 67,
    description: "研究变量之间的关系、变化趋势与局部性质，是高中数学中连接最广泛的知识星云。",
    path: ["高中数学", "函数与导数"], tags: ["导数", "函数零点", "单调性"], methods: 6
  },
  {
    id: "galaxy-geometry", label: "几何与向量", type: "galaxy", field: "geometry", x: 760, y: -350, progress: 34,
    description: "从空间关系、坐标表达与向量语言出发，连接平面几何、立体几何和解析几何。",
    path: ["高中数学", "几何与向量"], tags: ["圆锥曲线", "空间向量", "解析几何"], methods: 4
  },
  {
    id: "galaxy-sequence", label: "代数与数列", type: "galaxy", field: "sequence", x: -740, y: -330, progress: 52,
    description: "在数、式与离散变化中寻找规律，理解递推、求和与不等关系。",
    path: ["高中数学", "代数与数列"], tags: ["数列", "不等式", "递推"], methods: 5
  },
  {
    id: "galaxy-probability", label: "概率与统计", type: "galaxy", field: "probability", x: 650, y: 500, progress: 18,
    description: "研究随机现象、数据规律与不确定性，建立从样本到推断的思维方式。",
    path: ["高中数学", "概率与统计"], tags: ["条件概率", "随机变量", "统计推断"], methods: 3
  },

  { id: "module-basic-function", label: "基本函数", type: "module", field: "function", x: -225, y: -95, progress: 72, parent: "galaxy-function", description: "理解函数的表示、性质与基本模型。", path: ["高中数学", "函数与导数", "基本函数"], tags: ["定义域", "奇偶性", "周期性"] },
  { id: "module-derivative", label: "导数", type: "module", field: "function", x: 105, y: -190, progress: 78, parent: "galaxy-function", description: "使用局部变化率研究函数的单调性、极值与切线。", path: ["高中数学", "函数与导数", "导数"], tags: ["单调性", "极值", "切线"] },
  { id: "module-zero", label: "函数零点", type: "module", field: "function", x: 235, y: 82, progress: 55, parent: "galaxy-function", description: "研究方程的根与函数图像之间的联系。", path: ["高中数学", "函数与导数", "函数零点"], tags: ["零点个数", "隐零点", "存在性"] },
  { id: "module-inequality", label: "函数与不等式", type: "module", field: "function", x: -125, y: 188, progress: 61, parent: "galaxy-function", description: "把恒成立、最值和参数范围转化为函数问题。", path: ["高中数学", "函数与导数", "函数与不等式"], tags: ["恒成立", "参数范围", "最值"] },

  { id: "concept-domain", label: "定义域与值域", type: "concept", field: "function", x: -345, y: -168, progress: 84, parent: "module-basic-function", description: "确定函数可以输入与能够输出的范围。", path: ["高中数学", "函数与导数", "基本函数", "定义域与值域"] },
  { id: "concept-parity", label: "奇偶性与周期", type: "concept", field: "function", x: -355, y: -30, progress: 68, parent: "module-basic-function", description: "通过对称与重复结构简化函数研究。", path: ["高中数学", "函数与导数", "基本函数", "奇偶性与周期"] },
  { id: "concept-monotonic", label: "单调性", type: "concept", field: "function", x: 54, y: -315, progress: 86, parent: "module-derivative", description: "利用导数符号研究函数在区间内的增减趋势。", path: ["高中数学", "函数与导数", "导数", "单调性"] },
  { id: "concept-extrema", label: "极值与最值", type: "concept", field: "function", x: 235, y: -270, progress: 74, parent: "module-derivative", description: "研究函数在局部或整体范围内的极端取值。", path: ["高中数学", "函数与导数", "导数", "极值与最值"] },
  { id: "concept-tangent", label: "切线与几何意义", type: "concept", field: "function", x: -22, y: -135, progress: 58, parent: "module-derivative", description: "把导数理解为曲线在一点处的切线斜率。", path: ["高中数学", "函数与导数", "导数", "切线"] },
  { id: "concept-hidden-zero", label: "隐零点", type: "concept", field: "function", x: 380, y: 90, progress: 42, parent: "module-zero", description: "不直接求出零点，而是利用其满足的关系完成代换与估计。", path: ["高中数学", "函数与导数", "函数零点", "隐零点"] },
  { id: "concept-zero-count", label: "零点个数", type: "concept", field: "function", x: 275, y: 200, progress: 64, parent: "module-zero", description: "结合单调性、极值和端点行为判断零点数量。", path: ["高中数学", "函数与导数", "函数零点", "零点个数"] },
  { id: "concept-constant", label: "恒成立问题", type: "concept", field: "function", x: -85, y: 305, progress: 57, parent: "module-inequality", description: "将不等式恒成立转化为最值或参数分离问题。", path: ["高中数学", "函数与导数", "函数与不等式", "恒成立"] },

  { id: "tag-construct", label: "构造函数", type: "tag", field: "function", x: 118, y: 25, progress: 48, parent: "concept-hidden-zero", description: "根据目标式结构重新构造一个便于研究的新函数。", path: ["高中数学", "函数与导数", "方法", "构造函数"] },
  { id: "tag-isomorphism", label: "同构变形", type: "tag", field: "function", x: 405, y: -62, progress: 36, parent: "concept-hidden-zero", description: "识别两个表达式的相似结构，用函数关系进行统一。", path: ["高中数学", "函数与导数", "方法", "同构变形"] },
  { id: "tag-classify", label: "分类讨论", type: "tag", field: "function", x: 350, y: 280, progress: 79, parent: "concept-zero-count", description: "依据参数、符号或位置关系划分完整且互斥的情形。", path: ["高中数学", "函数与导数", "方法", "分类讨论"] },
  { id: "tag-separate", label: "分离参数", type: "tag", field: "function", x: -10, y: 390, progress: 63, parent: "concept-constant", description: "把参数与变量分离，将恒成立问题转化为函数值域问题。", path: ["高中数学", "函数与导数", "方法", "分离参数"] },
  { id: "tag-substitute", label: "换元法", type: "tag", field: "function", x: -310, y: 190, progress: 71, parent: "module-inequality", description: "通过引入新变量显露表达式中的标准结构。", path: ["高中数学", "函数与导数", "方法", "换元法"] },
  { id: "tag-graph", label: "数形结合", type: "tag", field: "function", x: -395, y: 65, progress: 82, parent: "module-basic-function", description: "在代数表达与几何图像之间切换，以获得更直观的判断。", path: ["高中数学", "函数与导数", "方法", "数形结合"] },

  { id: "module-vector", label: "平面向量", type: "module", field: "geometry", x: 610, y: -490, progress: 45, parent: "galaxy-geometry", description: "用向量语言表示方向、长度与位置关系。", path: ["高中数学", "几何与向量", "平面向量"] },
  { id: "module-solid", label: "立体几何", type: "module", field: "geometry", x: 910, y: -475, progress: 29, parent: "galaxy-geometry", description: "研究空间中的点、线、面关系。", path: ["高中数学", "几何与向量", "立体几何"] },
  { id: "module-analytic", label: "解析几何", type: "module", field: "geometry", x: 920, y: -230, progress: 38, parent: "galaxy-geometry", description: "用坐标与方程研究几何图形。", path: ["高中数学", "几何与向量", "解析几何"] },
  { id: "concept-conic", label: "圆锥曲线", type: "concept", field: "geometry", x: 1060, y: -210, progress: 33, parent: "module-analytic", description: "研究椭圆、双曲线与抛物线的统一结构。", path: ["高中数学", "几何与向量", "解析几何", "圆锥曲线"] },
  { id: "concept-dihedral", label: "二面角", type: "concept", field: "geometry", x: 955, y: -585, progress: 24, parent: "module-solid", description: "度量两个平面之间的夹角。", path: ["高中数学", "几何与向量", "立体几何", "二面角"] },

  { id: "module-sequence", label: "数列", type: "module", field: "sequence", x: -930, y: -450, progress: 61, parent: "galaxy-sequence", description: "研究离散变化、递推与求和。", path: ["高中数学", "代数与数列", "数列"] },
  { id: "module-algebra-ineq", label: "不等式", type: "module", field: "sequence", x: -545, y: -430, progress: 47, parent: "galaxy-sequence", description: "比较数量关系并研究最值。", path: ["高中数学", "代数与数列", "不等式"] },
  { id: "module-complex", label: "复数", type: "module", field: "sequence", x: -800, y: -155, progress: 58, parent: "galaxy-sequence", description: "扩展实数体系并连接代数与几何。", path: ["高中数学", "代数与数列", "复数"] },
  { id: "concept-recurrence", label: "递推关系", type: "concept", field: "sequence", x: -1080, y: -470, progress: 54, parent: "module-sequence", description: "用相邻项关系描述数列。", path: ["高中数学", "代数与数列", "数列", "递推关系"] },
  { id: "concept-sum", label: "数列求和", type: "concept", field: "sequence", x: -1000, y: -300, progress: 67, parent: "module-sequence", description: "通过错位相减、裂项等方法求和。", path: ["高中数学", "代数与数列", "数列", "数列求和"] },

  { id: "module-classical", label: "古典概型", type: "module", field: "probability", x: 470, y: 650, progress: 26, parent: "galaxy-probability", description: "在等可能样本空间中计算事件概率。", path: ["高中数学", "概率与统计", "古典概型"] },
  { id: "module-random", label: "随机变量", type: "module", field: "probability", x: 795, y: 660, progress: 14, parent: "galaxy-probability", description: "用变量刻画随机试验结果。", path: ["高中数学", "概率与统计", "随机变量"] },
  { id: "module-statistics", label: "统计", type: "module", field: "probability", x: 820, y: 410, progress: 21, parent: "galaxy-probability", description: "从数据中提取规律并进行推断。", path: ["高中数学", "概率与统计", "统计"] },
  { id: "concept-conditional", label: "条件概率", type: "concept", field: "probability", x: 395, y: 770, progress: 17, parent: "module-classical", description: "在已知事件发生的条件下重新计算概率。", path: ["高中数学", "概率与统计", "古典概型", "条件概率"] },
  { id: "concept-expectation", label: "期望与方差", type: "concept", field: "probability", x: 930, y: 730, progress: 12, parent: "module-random", description: "描述随机变量的中心位置与波动程度。", path: ["高中数学", "概率与统计", "随机变量", "期望与方差"] }
];

const edges = [];
nodes.forEach((node) => {
  if (node.parent) edges.push({ from: node.parent, to: node.id, kind: "hierarchy" });
});
edges.push(
  { from: "concept-monotonic", to: "concept-zero-count", kind: "related" },
  { from: "concept-extrema", to: "concept-zero-count", kind: "related" },
  { from: "tag-construct", to: "concept-constant", kind: "related" },
  { from: "tag-isomorphism", to: "concept-monotonic", kind: "related" },
  { from: "tag-graph", to: "concept-zero-count", kind: "related" },
  { from: "tag-classify", to: "concept-extrema", kind: "related" }
);

const questionParents = [
  "concept-monotonic", "concept-extrema", "concept-hidden-zero", "concept-zero-count",
  "concept-constant", "tag-construct", "tag-isomorphism", "tag-classify",
  "tag-separate", "tag-substitute", "tag-graph"
];

const questionTitles = [
  "导数与单调区间", "函数零点个数", "双变量恒成立", "极值点偏移",
  "含参函数讨论", "隐零点代换", "切线与最值", "同构函数比较",
  "分离参数求范围", "构造函数证明", "数形结合判断", "函数不等式"
];

function seeded(index) {
  const value = Math.sin(index * 917.31 + 13.7) * 43758.5453;
  return value - Math.floor(value);
}

for (let index = 0; index < 36; index += 1) {
  const parentId = questionParents[index % questionParents.length];
  const parent = nodes.find((node) => node.id === parentId);
  const angle = seeded(index + 1) * Math.PI * 2;
  const radius = 48 + seeded(index + 40) * 70;
  const year = 2021 + index % 5;
  const id = `Q-${year}-${String(index + 1).padStart(3, "0")}`;
  nodes.push({
    id,
    label: id,
    title: questionTitles[index % questionTitles.length],
    type: "problem",
    field: "function",
    x: parent.x + Math.cos(angle) * radius,
    y: parent.y + Math.sin(angle) * radius,
    progress: index % 6 === 0 ? 100 : index % 4 === 0 ? 65 : index % 3 === 0 ? 35 : 0,
    parent: parentId,
    description: `${year} 年题目样本：${questionTitles[index % questionTitles.length]}。`,
    path: [...parent.path, id],
    tags: [parent.label, index % 2 ? "高考真题" : "模拟题"]
  });
  edges.push({ from: parentId, to: id, kind: "hierarchy" });
}

const progressStorageKey = "mathverse.galaxy.progress.v1";
const tagStorageKey = "mathverse.galaxy.personal-tags.v1";
let progressOverrides = readStorage(progressStorageKey, {});
const storedTags = readStorage(tagStorageKey, []);

storedTags.forEach((tag) => {
  if (!tag || !tag.id || !tag.label || !nodes.some((node) => node.id === tag.parent)) return;
  nodes.push(tag);
  edges.push({ from: tag.parent, to: tag.id, kind: "personal" });
});

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    announce("当前浏览器无法保存个人星系数据");
  }
}

function effectiveProgress(node) {
  const override = Number(progressOverrides[node.id]);
  return Number.isFinite(override) ? override : node.progress || 0;
}

const nodeMap = new Map();
function rebuildNodeMap() {
  nodeMap.clear();
  nodes.forEach((node) => nodeMap.set(node.id, node));
}
rebuildNodeMap();

const adjacency = new Map();
function rebuildAdjacency() {
  adjacency.clear();
  nodes.forEach((node) => adjacency.set(node.id, new Set()));
  edges.forEach((edge) => {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  });
}
rebuildAdjacency();

const visibleFields = new Set(Object.keys(fieldColors));
let viewMode = "atlas";
let selectedNode = nodeMap.get("galaxy-function");
let hoveredNode = null;
let selectionEmphasisActive = false;
let canvasWidth = 1;
let canvasHeight = 1;
let dpr = 1;
let dragState = null;
let didDrag = false;
let hintDismissed = false;

const camera = {
  x: 30,
  y: 40,
  scale: .5,
  targetX: 30,
  targetY: 40,
  targetScale: .5
};

const stars = Array.from({ length: 260 }, (_, index) => ({
  x: seeded(index + 120) * 2 - 1,
  y: seeded(index + 530) * 2 - 1,
  size: .35 + seeded(index + 810) * 1.1,
  alpha: .08 + seeded(index + 280) * .32,
  layer: .15 + seeded(index + 680) * .45
}));

const nebulaDust = {};
const spiralDust = {};
Object.keys(fieldColors).forEach((field, fieldIndex) => {
  nebulaDust[field] = Array.from({ length: field === "function" ? 120 : 72 }, (_, index) => {
    const angle = seeded(index + fieldIndex * 173) * Math.PI * 2;
    const radius = Math.pow(seeded(index + 900 + fieldIndex * 41), .65);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * (.48 + seeded(index + 330) * .34),
      size: 1 + seeded(index + 610) * 3,
      alpha: .08 + seeded(index + 770) * .22
    };
  });
  spiralDust[field] = Array.from({ length: field === "function" ? 260 : 150 }, (_, index) => {
    const arm = index % 3;
    const radius = Math.pow(seeded(index + 1400 + fieldIndex * 73), .72);
    const jitter = (seeded(index + 1700) - .5) * (.42 - radius * .18);
    const angle = arm * Math.PI * 2 / 3 + radius * 6.1 + jitter;
    return {
      radius,
      angle,
      vertical: (seeded(index + 2000) - .5) * (1 - radius) * .18,
      size: .45 + seeded(index + 2200) * 1.55,
      alpha: .08 + seeded(index + 2450) * .34,
      warmth: seeded(index + 2700)
    };
  });
});

const distantGalaxies = Array.from({ length: 7 }, (_, index) => ({
  x: .08 + seeded(index + 3000) * .84,
  y: .08 + seeded(index + 3100) * .78,
  size: 16 + seeded(index + 3200) * 34,
  angle: seeded(index + 3300) * Math.PI,
  alpha: .025 + seeded(index + 3400) * .055
}));

const shockwaves = [];
const particleBursts = [];
let pointerGlowX = .5;
let pointerGlowY = .5;
let modePulseStarted = 0;

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = Math.max(1, rect.width);
  canvasHeight = Math.max(1, rect.height);
  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function worldToScreen(x, y) {
  return {
    x: (x - camera.x) * camera.scale + canvasWidth / 2,
    y: (y - camera.y) * camera.scale + canvasHeight / 2
  };
}

function screenToWorld(x, y) {
  return {
    x: (x - canvasWidth / 2) / camera.scale + camera.x,
    y: (y - canvasHeight / 2) / camera.scale + camera.y
  };
}

function hexToRgb(hex) {
  const number = Number.parseInt(hex.slice(1), 16);
  return { r: number >> 16, g: number >> 8 & 255, b: number & 255 };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function nodeThreshold(node) {
  if (node.type === "galaxy") return 0;
  if (node.type === "module") return .38;
  if (node.type === "concept") return .63;
  if (node.type === "tag") return .78;
  return .93;
}

function nodeIsVisible(node) {
  return visibleFields.has(node.field) && camera.scale >= nodeThreshold(node);
}

function drawEllipticalGlow(x, y, radiusX, radiusY, color, alpha, rotation = 0) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(1, radiusY / radiusX);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(.24, rgba(color, alpha * .68));
  gradient.addColorStop(.62, rgba(color, alpha * .18));
  gradient.addColorStop(1, rgba(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radiusX, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBackground(time) {
  context.fillStyle = "#040610";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const backgroundGradient = context.createRadialGradient(canvasWidth * .5, canvasHeight * .45, 0, canvasWidth * .5, canvasHeight * .45, Math.max(canvasWidth, canvasHeight) * .72);
  backgroundGradient.addColorStop(0, "rgba(27, 33, 77, .26)");
  backgroundGradient.addColorStop(.55, "rgba(7, 9, 22, .08)");
  backgroundGradient.addColorStop(1, "rgba(0, 0, 4, .45)");
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  context.save();
  context.translate(canvasWidth * .5, canvasHeight * .5);
  context.rotate(-.28);
  const milkyWay = context.createLinearGradient(0, -canvasHeight * .55, 0, canvasHeight * .55);
  milkyWay.addColorStop(0, "rgba(80, 86, 165, 0)");
  milkyWay.addColorStop(.28, "rgba(92, 101, 189, .018)");
  milkyWay.addColorStop(.43, "rgba(168, 154, 187, .045)");
  milkyWay.addColorStop(.5, "rgba(15, 17, 38, .08)");
  milkyWay.addColorStop(.57, "rgba(133, 139, 202, .038)");
  milkyWay.addColorStop(.72, "rgba(76, 84, 164, .015)");
  milkyWay.addColorStop(1, "rgba(76, 84, 164, 0)");
  context.fillStyle = milkyWay;
  context.fillRect(-canvasWidth * 1.2, -canvasHeight * .72, canvasWidth * 2.4, canvasHeight * 1.44);
  context.restore();

  distantGalaxies.forEach((galaxy) => {
    const x = galaxy.x * canvasWidth - camera.x * .015;
    const y = galaxy.y * canvasHeight - camera.y * .015;
    context.save();
    context.translate(x, y);
    context.rotate(galaxy.angle);
    context.scale(1, .34);
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, galaxy.size);
    glow.addColorStop(0, `rgba(220, 214, 239, ${galaxy.alpha * 1.8})`);
    glow.addColorStop(.18, `rgba(117, 129, 209, ${galaxy.alpha})`);
    glow.addColorStop(1, "rgba(83, 92, 174, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, galaxy.size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  const pointerGlow = context.createRadialGradient(pointerGlowX * canvasWidth, pointerGlowY * canvasHeight, 0, pointerGlowX * canvasWidth, pointerGlowY * canvasHeight, 170);
  pointerGlow.addColorStop(0, "rgba(91, 105, 219, .045)");
  pointerGlow.addColorStop(1, "rgba(91, 105, 219, 0)");
  context.fillStyle = pointerGlow;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  stars.forEach((star, index) => {
    const parallaxX = -camera.x * camera.scale * star.layer * .12;
    const parallaxY = -camera.y * camera.scale * star.layer * .12;
    const x = ((star.x + 1) / 2 * canvasWidth + parallaxX + canvasWidth * 2) % canvasWidth;
    const y = ((star.y + 1) / 2 * canvasHeight + parallaxY + canvasHeight * 2) % canvasHeight;
    const shimmer = reduceMotion ? 1 : .75 + Math.sin(time * .0007 + index) * .25;
    context.beginPath();
    context.arc(x, y, star.size, 0, Math.PI * 2);
    const starTint = index % 19 === 0 ? "241, 202, 148" : index % 13 === 0 ? "158, 184, 255" : "207, 217, 250";
    context.fillStyle = `rgba(${starTint}, ${star.alpha * shimmer})`;
    context.fill();
    if (star.size > 1.18 && shimmer > .9) {
      context.strokeStyle = `rgba(${starTint}, ${star.alpha * .15})`;
      context.lineWidth = .5;
      context.beginPath();
      context.moveTo(x - star.size * 5, y);
      context.lineTo(x + star.size * 5, y);
      context.moveTo(x, y - star.size * 5);
      context.lineTo(x, y + star.size * 5);
      context.stroke();
    }
  });

  if (!reduceMotion) {
    for (let index = 0; index < 2; index += 1) {
      const phase = (time + index * 7900) % 17000;
      if (phase > 920) continue;
      const progress = phase / 920;
      const x = canvasWidth * (.84 - progress * .42);
      const y = canvasHeight * (.14 + index * .28 + progress * .18);
      const length = 75 * (1 - progress * .35);
      const trail = context.createLinearGradient(x, y, x + length, y - length * .42);
      trail.addColorStop(0, `rgba(232, 239, 255, ${Math.sin(progress * Math.PI) * .55})`);
      trail.addColorStop(1, "rgba(142, 161, 239, 0)");
      context.strokeStyle = trail;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + length, y - length * .42);
      context.stroke();
    }
  }
}

function drawNebula(field, time) {
  if (!visibleFields.has(field)) return;
  const core = nodes.find((node) => node.type === "galaxy" && node.field === field);
  const screen = worldToScreen(core.x, core.y);
  const color = fieldColors[field];
  const progress = effectiveProgress(core) / 100;
  const personalStrength = .18 + progress * .82;
  const strength = viewMode === "personal" ? personalStrength : .72;
  const worldRadius = field === "function" ? 410 : 300;
  const radius = worldRadius * camera.scale;
  if (screen.x < -radius || screen.x > canvasWidth + radius || screen.y < -radius || screen.y > canvasHeight + radius) return;

  context.save();
  context.globalCompositeOperation = "lighter";
  drawEllipticalGlow(screen.x, screen.y, Math.max(70, radius), Math.max(48, radius * .62), color, .14 * strength, -.18);
  drawEllipticalGlow(screen.x - radius * .08, screen.y + radius * .04, Math.max(55, radius * .74), Math.max(38, radius * .34), color, .1 * strength, .34);
  drawEllipticalGlow(screen.x + radius * .12, screen.y - radius * .08, Math.max(45, radius * .58), Math.max(30, radius * .26), progress > .65 ? "#e8c792" : "#9aa4f2", .055 * strength, -.5);

  nebulaDust[field].forEach((dust, index) => {
    const drift = reduceMotion ? 0 : Math.sin(time * .00012 + index * .7) * 3;
    const x = screen.x + dust.x * radius * .92 + drift;
    const y = screen.y + dust.y * radius * .75;
    context.beginPath();
    context.arc(x, y, Math.max(.45, dust.size * Math.min(1.2, camera.scale + .3)), 0, Math.PI * 2);
    context.fillStyle = rgba(color, dust.alpha * strength * .66);
    context.fill();
  });

  const fieldIndex = Object.keys(fieldColors).indexOf(field);
  const rotation = reduceMotion ? 0 : time * (.000018 + fieldIndex * .000003);
  spiralDust[field].forEach((dust) => {
    const angle = dust.angle + rotation * (1.2 - dust.radius * .45);
    const x = screen.x + Math.cos(angle) * dust.radius * radius;
    const y = screen.y + Math.sin(angle) * dust.radius * radius * .43 + dust.vertical * radius;
    const particleColor = dust.warmth > .84 ? "#f3d49b" : dust.warmth < .18 ? "#b8cbff" : color;
    const particleAlpha = dust.alpha * strength * (.32 + progress * .5);
    context.beginPath();
    context.arc(x, y, Math.max(.35, dust.size * Math.min(1.3, camera.scale + .38)), 0, Math.PI * 2);
    context.fillStyle = rgba(particleColor, particleAlpha);
    context.fill();
  });

  if (viewMode === "personal" && modePulseStarted) {
    const elapsed = time - modePulseStarted;
    if (elapsed < 1600) {
      const pulse = elapsed / 1600;
      context.beginPath();
      context.arc(screen.x, screen.y, Math.max(20, radius * pulse * 1.08), 0, Math.PI * 2);
      context.strokeStyle = rgba(color, Math.sin(pulse * Math.PI) * .24 * progress);
      context.lineWidth = 1.1;
      context.stroke();
    }
  }
  context.restore();

  context.save();
  context.translate(screen.x, screen.y);
  context.rotate(-.2);
  context.scale(1, .2);
  const dustLane = context.createRadialGradient(0, 0, radius * .05, 0, 0, radius * .72);
  dustLane.addColorStop(0, "rgba(2, 3, 10, .3)");
  dustLane.addColorStop(.48, "rgba(3, 4, 12, .11)");
  dustLane.addColorStop(1, "rgba(3, 4, 12, 0)");
  context.fillStyle = dustLane;
  context.beginPath();
  context.arc(0, 0, radius * .72, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function isEmphasized(node) {
  if (!hoveredNode && !selectionEmphasisActive) return true;
  const focus = hoveredNode || selectedNode;
  if (!focus) return true;
  return node.id === focus.id || adjacency.get(focus.id)?.has(node.id);
}

function drawEdges(time) {
  const focus = hoveredNode || (selectionEmphasisActive ? selectedNode : null);
  edges.forEach((edge) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to || !nodeIsVisible(from) || !nodeIsVisible(to)) return;
    if (edge.kind === "related" && (!focus || (focus.id !== from.id && focus.id !== to.id))) return;

    const start = worldToScreen(from.x, from.y);
    const end = worldToScreen(to.x, to.y);
    const highlighted = focus && (focus.id === from.id || focus.id === to.id);
    const alpha = highlighted ? .56 : edge.kind === "personal" ? .22 : .075;
    context.save();
    context.beginPath();
    context.moveTo(start.x, start.y);
    const curve = Math.min(55, Math.hypot(end.x - start.x, end.y - start.y) * .14);
    const controlX = (start.x + end.x) / 2 + curve * .2;
    const controlY = (start.y + end.y) / 2 - curve;
    context.quadraticCurveTo(controlX, controlY, end.x, end.y);
    context.strokeStyle = edge.kind === "personal" ? `rgba(209, 123, 235, ${alpha})` : `rgba(159, 173, 234, ${alpha})`;
    context.lineWidth = highlighted ? 1.1 : .65;
    if (edge.kind === "related" || edge.kind === "personal") context.setLineDash([3, 5]);
    context.stroke();

    const flowStrength = (effectiveProgress(from) + effectiveProgress(to)) / 200;
    if (!reduceMotion && (highlighted || (viewMode === "personal" && flowStrength > .42))) {
      const seedOffset = (from.x * .013 + to.y * .017) % 1;
      const travel = (time * .00018 + seedOffset + 1) % 1;
      const inverse = 1 - travel;
      const flowX = inverse * inverse * start.x + 2 * inverse * travel * controlX + travel * travel * end.x;
      const flowY = inverse * inverse * start.y + 2 * inverse * travel * controlY + travel * travel * end.y;
      context.setLineDash([]);
      context.beginPath();
      context.arc(flowX, flowY, highlighted ? 1.8 : 1.05, 0, Math.PI * 2);
      context.fillStyle = edge.kind === "personal" ? "rgba(223,145,245,.75)" : `rgba(206,219,255,${.28 + flowStrength * .5})`;
      context.shadowColor = edge.kind === "personal" ? "#d177ef" : "#9aa9ff";
      context.shadowBlur = 7;
      context.fill();
    }
    context.restore();
  });
}

function nodeRadius(node) {
  if (node.type === "galaxy") return 15;
  if (node.type === "module") return 8;
  if (node.type === "concept") return 5.5;
  if (node.type === "tag") return node.personal ? 4.5 : 3.8;
  return 1.7;
}

function drawNode(node, time) {
  if (!nodeIsVisible(node)) return;
  const basePosition = worldToScreen(node.x, node.y);
  const float = reduceMotion || node.type === "problem" ? 0 : Math.sin(time * .00055 + node.x * .017 + node.y * .011) * (node.type === "galaxy" ? 1.6 : .65);
  const x = basePosition.x;
  const y = basePosition.y + float;
  if (x < -80 || x > canvasWidth + 80 || y < -80 || y > canvasHeight + 80) return;

  const progress = effectiveProgress(node) / 100;
  const emphasis = isEmphasized(node);
  const dimFactor = emphasis ? 1 : .16;
  const personalFactor = viewMode === "personal" ? .12 + progress * .88 : .78;
  const alpha = personalFactor * dimFactor;
  const color = node.personal ? "#d177ef" : typeColors[node.type];
  const radius = nodeRadius(node) * Math.max(.82, Math.min(1.35, camera.scale + .48));
  const isSelected = selectionEmphasisActive && selectedNode?.id === node.id;
  const isHovered = hoveredNode?.id === node.id;

  context.save();
  context.globalCompositeOperation = "lighter";
  const haloRadius = radius * (node.type === "galaxy" ? 3.8 : node.type === "problem" ? 3 : 2.7);
  const gradient = context.createRadialGradient(x, y, 0, x, y, haloRadius);
  gradient.addColorStop(0, rgba(progress > .82 ? "#fff8e9" : color, .85 * alpha));
  gradient.addColorStop(.22, rgba(color, (.42 + progress * .3) * alpha));
  gradient.addColorStop(1, rgba(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, haloRadius, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
  context.fillStyle = rgba(progress > .82 ? "#fffaf0" : color, Math.max(.18, alpha));
  context.fill();

  if (progress > .58 && node.type !== "problem") {
    const spikeLength = radius * (2.2 + progress * 2.5);
    context.strokeStyle = rgba(progress > .82 ? "#fff4d8" : color, (.12 + progress * .15) * dimFactor);
    context.lineWidth = .55;
    context.beginPath();
    context.moveTo(x - spikeLength, y);
    context.lineTo(x + spikeLength, y);
    context.moveTo(x, y - spikeLength);
    context.lineTo(x, y + spikeLength);
    context.stroke();
  }

  if (node.type === "galaxy") {
    const orbitSpin = reduceMotion ? 0 : time * .000045;
    context.save();
    context.translate(x, y);
    context.rotate(-.23 + orbitSpin);
    context.scale(1, .42);
    context.beginPath();
    context.arc(0, 0, radius + 13 + progress * 8, -.2, Math.PI * 1.35);
    context.strokeStyle = rgba(fieldColors[node.field], (.16 + progress * .18) * dimFactor);
    context.lineWidth = .75;
    context.stroke();
    context.restore();
  }

  if (node.personal) {
    context.beginPath();
    context.arc(x, y, radius + 4, 0, Math.PI * 2);
    context.setLineDash([2, 3]);
    context.strokeStyle = rgba("#d177ef", .75 * dimFactor);
    context.lineWidth = .8;
    context.stroke();
  }

  if (isSelected || isHovered) {
    context.beginPath();
    context.arc(x, y, radius + (node.type === "galaxy" ? 11 : 7), 0, Math.PI * 2);
    context.strokeStyle = rgba(color, isSelected ? .72 : .45);
    context.lineWidth = .8;
    context.stroke();
  }
  context.restore();

  const alwaysLabel = node.type === "galaxy";
  const moduleLabel = node.type === "module" && camera.scale >= .47;
  const conceptLabel = node.type === "concept" && camera.scale >= .78;
  const tagLabel = (node.type === "tag" && camera.scale >= 1.03) || node.personal;
  const problemLabel = node.type === "problem" && camera.scale >= 1.55;
  if (alwaysLabel || moduleLabel || conceptLabel || tagLabel || problemLabel || isSelected || isHovered) {
    drawNodeLabel(node, x, y, radius, alpha, isSelected || isHovered);
  }

  if ((node.type === "concept" || node.type === "tag") && camera.scale >= .72 && camera.scale < 1.05) {
    const count = edges.filter((edge) => edge.from === node.id && nodeMap.get(edge.to)?.type === "problem").length;
    if (count) {
      context.fillStyle = `rgba(218, 225, 250, ${.24 * dimFactor})`;
      context.font = "7px ui-monospace, Consolas, monospace";
      context.textAlign = "left";
      context.fillText(`${count} 题`, x + radius + 6, y + 3);
    }
  }
}

function drawNodeLabel(node, x, y, radius, alpha, focused) {
  const isGalaxy = node.type === "galaxy";
  const isProblem = node.type === "problem";
  const size = isGalaxy ? 14 : isProblem ? 7 : node.type === "module" ? 10 : 8;
  context.save();
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = `${isGalaxy ? 500 : 400} ${size}px ${isGalaxy ? "Georgia, serif" : '"Segoe UI", "PingFang SC", sans-serif'}`;
  context.fillStyle = `rgba(235, 239, 252, ${focused ? .9 : Math.max(.18, alpha * (isGalaxy ? .72 : .6))})`;
  context.fillText(node.type === "problem" ? node.id : node.label, x, y + radius + (isGalaxy ? 11 : 7));
  if (isGalaxy) {
    context.font = "6px ui-monospace, Consolas, monospace";
    context.fillStyle = `rgba(235, 239, 252, ${focused ? .38 : .18})`;
    context.fillText(`${effectiveProgress(node)}% EXPLORED`, x, y + radius + 31);
  }
  context.restore();
}

function triggerCosmicBurst(node, color = null, intensity = 1) {
  if (!node || reduceMotion) return;
  const burstColor = color || (node.personal ? "#d177ef" : typeColors[node.type]);
  const start = performance.now();
  shockwaves.push({ x: node.x, y: node.y, color: burstColor, start, intensity });
  particleBursts.push({
    x: node.x,
    y: node.y,
    color: burstColor,
    start,
    particles: Array.from({ length: Math.round(22 + intensity * 16) }, (_, index) => ({
      angle: seeded(index + start * .01) * Math.PI * 2,
      speed: 28 + seeded(index + 3800) * 88 * intensity,
      size: .6 + seeded(index + 4000) * 1.9,
      drift: (seeded(index + 4200) - .5) * .5
    }))
  });
}

function drawCosmicEffects(time) {
  context.save();
  context.globalCompositeOperation = "lighter";
  for (let index = shockwaves.length - 1; index >= 0; index -= 1) {
    const wave = shockwaves[index];
    const elapsed = time - wave.start;
    if (elapsed > 1500) {
      shockwaves.splice(index, 1);
      continue;
    }
    const progress = elapsed / 1500;
    const screen = worldToScreen(wave.x, wave.y);
    const radius = 8 + progress * 145 * wave.intensity;
    context.beginPath();
    context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    context.strokeStyle = rgba(wave.color, Math.sin(progress * Math.PI) * .48);
    context.lineWidth = 1.1 * (1 - progress) + .35;
    context.stroke();
    context.beginPath();
    context.arc(screen.x, screen.y, radius * .62, 0, Math.PI * 2);
    context.strokeStyle = rgba("#fff5dd", Math.sin(progress * Math.PI) * .16);
    context.stroke();
  }

  for (let index = particleBursts.length - 1; index >= 0; index -= 1) {
    const burst = particleBursts[index];
    const elapsed = time - burst.start;
    if (elapsed > 1200) {
      particleBursts.splice(index, 1);
      continue;
    }
    const progress = elapsed / 1200;
    const ease = 1 - Math.pow(1 - progress, 2);
    const center = worldToScreen(burst.x, burst.y);
    burst.particles.forEach((particle) => {
      const distance = particle.speed * ease;
      const angle = particle.angle + progress * particle.drift;
      const x = center.x + Math.cos(angle) * distance;
      const y = center.y + Math.sin(angle) * distance;
      context.beginPath();
      context.arc(x, y, particle.size * (1 - progress * .65), 0, Math.PI * 2);
      context.fillStyle = rgba(particle.color || burst.color, (1 - progress) * .7);
      context.fill();
    });
  }
  context.restore();
}

function draw(time) {
  camera.x += (camera.targetX - camera.x) * .085;
  camera.y += (camera.targetY - camera.y) * .085;
  camera.scale += (camera.targetScale - camera.scale) * .085;
  drawBackground(time);
  Object.keys(fieldColors).forEach((field) => drawNebula(field, time));
  drawEdges(time);
  nodes.forEach((node) => drawNode(node, time));
  drawCosmicEffects(time);
  updateLayerLabel();
  window.requestAnimationFrame(draw);
}

function visibleHitNodes() {
  return nodes.filter(nodeIsVisible).map((node) => {
    const screen = worldToScreen(node.x, node.y);
    return { node, x: screen.x, y: screen.y, radius: Math.max(7, nodeRadius(node) + 6) };
  });
}

function hitTest(screenX, screenY) {
  const candidates = visibleHitNodes().filter((candidate) => Math.hypot(candidate.x - screenX, candidate.y - screenY) <= candidate.radius);
  candidates.sort((a, b) => Math.hypot(a.x - screenX, a.y - screenY) - Math.hypot(b.x - screenX, b.y - screenY));
  return candidates[0]?.node || null;
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

stage.addEventListener("pointerdown", (event) => {
  if (event.target !== canvas) return;
  const position = pointerPosition(event);
  dragState = { pointerId: event.pointerId, x: position.x, y: position.y, cameraX: camera.targetX, cameraY: camera.targetY };
  didDrag = false;
  stage.classList.add("dragging");
  canvas.setPointerCapture(event.pointerId);
});

stage.addEventListener("pointermove", (event) => {
  const position = pointerPosition(event);
  pointerGlowX = Math.max(0, Math.min(1, position.x / canvasWidth));
  pointerGlowY = Math.max(0, Math.min(1, position.y / canvasHeight));
  if (dragState && dragState.pointerId === event.pointerId) {
    const deltaX = position.x - dragState.x;
    const deltaY = position.y - dragState.y;
    if (Math.hypot(deltaX, deltaY) > 3) didDrag = true;
    camera.targetX = dragState.cameraX - deltaX / camera.scale;
    camera.targetY = dragState.cameraY - deltaY / camera.scale;
    camera.x = camera.targetX;
    camera.y = camera.targetY;
    dismissHint();
    return;
  }
  hoveredNode = hitTest(position.x, position.y);
  stage.style.cursor = hoveredNode ? "pointer" : "grab";
});

stage.addEventListener("pointerup", (event) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const position = pointerPosition(event);
  if (!didDrag) {
    const node = hitTest(position.x, position.y);
    if (node) selectNode(node);
  }
  dragState = null;
  stage.classList.remove("dragging");
  canvas.releasePointerCapture(event.pointerId);
});

stage.addEventListener("pointercancel", () => {
  dragState = null;
  stage.classList.remove("dragging");
});

stage.addEventListener("pointerleave", () => {
  if (!dragState) hoveredNode = null;
});

stage.addEventListener("dblclick", (event) => {
  const position = pointerPosition(event);
  const node = hitTest(position.x, position.y);
  if (node) focusNode(node);
});

stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  const position = pointerPosition(event);
  const worldBefore = screenToWorld(position.x, position.y);
  const factor = Math.exp(-event.deltaY * .0011);
  const nextScale = Math.max(.32, Math.min(2.2, camera.targetScale * factor));
  camera.targetScale = nextScale;
  camera.scale = nextScale;
  camera.targetX = worldBefore.x - (position.x - canvasWidth / 2) / nextScale;
  camera.targetY = worldBefore.y - (position.y - canvasHeight / 2) / nextScale;
  camera.x = camera.targetX;
  camera.y = camera.targetY;
  dismissHint();
}, { passive: false });

function setZoom(nextScale) {
  camera.targetScale = Math.max(.32, Math.min(2.2, nextScale));
  dismissHint();
}

document.querySelector("#zoom-in").addEventListener("click", () => setZoom(camera.targetScale * 1.25));
document.querySelector("#zoom-out").addEventListener("click", () => setZoom(camera.targetScale / 1.25));
document.querySelector("#reset-view").addEventListener("click", resetView);

function resetView() {
  camera.targetX = 30;
  camera.targetY = 40;
  camera.targetScale = .5;
  selectNode(nodeMap.get("galaxy-function"), false);
  selectionEmphasisActive = false;
  announce("已返回知识宇宙总览");
}

function focusNode(node) {
  camera.targetX = node.x;
  camera.targetY = node.y;
  if (node.type === "galaxy") camera.targetScale = 1.02;
  else if (node.type === "module") camera.targetScale = Math.max(1.12, camera.targetScale);
  else if (node.type === "concept" || node.type === "tag") camera.targetScale = Math.max(1.38, camera.targetScale);
  else camera.targetScale = Math.max(1.65, camera.targetScale);
  selectNode(node);
  if (node.type !== "problem") showFieldReveal(node.label);
  triggerCosmicBurst(node, node.personal ? "#d177ef" : fieldColors[node.field], .72);
  dismissHint();
}

function selectNode(node, openMobile = true) {
  selectedNode = node;
  selectionEmphasisActive = true;
  if (!reduceMotion) shockwaves.push({ x: node.x, y: node.y, color: node.personal ? "#d177ef" : typeColors[node.type], start: performance.now(), intensity: .42 });
  updateInspector();
  if (openMobile && window.innerWidth <= 930) document.querySelector("#node-inspector").classList.add("open");
}

function descendantCount(node, targetType) {
  const visited = new Set();
  const stack = [node.id];
  let count = 0;
  while (stack.length) {
    const id = stack.pop();
    edges.filter((edge) => edge.from === id && edge.kind !== "related").forEach((edge) => {
      if (visited.has(edge.to)) return;
      visited.add(edge.to);
      const child = nodeMap.get(edge.to);
      if (!child) return;
      if (child.type === targetType) count += 1;
      stack.push(child.id);
    });
  }
  return count;
}

function updateInspector() {
  if (!selectedNode) return;
  const color = selectedNode.personal ? "#d177ef" : typeColors[selectedNode.type];
  const progress = Math.round(effectiveProgress(selectedNode));
  document.querySelector("#inspector-type-dot").style.background = color;
  document.querySelector("#inspector-type-dot").style.boxShadow = `0 0 7px ${color}`;
  document.querySelector("#inspector-type").textContent = selectedNode.personal ? "个人标签" : typeNames[selectedNode.type];
  document.querySelector("#inspector-name").textContent = selectedNode.type === "problem" ? selectedNode.title : selectedNode.label;
  document.querySelector("#inspector-id").textContent = selectedNode.id.toUpperCase().replaceAll("-", " · ");
  document.querySelector("#inspector-description").textContent = selectedNode.description || "这个节点正在等待更多内容。";
  document.querySelector("#inspector-progress").textContent = `${progress}%`;
  document.querySelector("#depth-orbit").style.background = `conic-gradient(${color} 0 ${progress}%, rgba(255,255,255,.06) ${progress}% 100%)`;
  document.querySelector("#progress-note").textContent = progress ? `当前学习深度为 ${progress}%` : "尚未留下学习记录";

  const breadcrumb = document.querySelector("#knowledge-breadcrumb");
  breadcrumb.replaceChildren();
  (selectedNode.path || [fieldNames[selectedNode.field], selectedNode.label]).forEach((item, index, list) => {
    const span = document.createElement("span");
    span.textContent = item;
    breadcrumb.append(span);
    if (index < list.length - 1) {
      const divider = document.createElement("b");
      divider.textContent = "›";
      breadcrumb.append(divider);
    }
  });

  const connected = adjacency.get(selectedNode.id)?.size || 0;
  const questions = selectedNode.type === "problem" ? 1 : descendantCount(selectedNode, "problem");
  const methods = selectedNode.methods || descendantCount(selectedNode, "tag");
  document.querySelector("#child-count").textContent = connected;
  document.querySelector("#question-count").textContent = questions;
  document.querySelector("#method-count").textContent = methods;

  const related = document.querySelector("#related-tags");
  related.replaceChildren();
  const relatedNames = selectedNode.tags?.length
    ? selectedNode.tags
    : [...(adjacency.get(selectedNode.id) || [])].map((id) => nodeMap.get(id)?.label).filter(Boolean).slice(0, 5);
  relatedNames.slice(0, 6).forEach((label) => {
    const span = document.createElement("span");
    span.textContent = label;
    related.append(span);
  });

  document.querySelector("#focus-node").innerHTML = selectedNode.type === "problem" ? "查看这道题 <span>→</span>" : "进入这个节点 <span>→</span>";
  document.querySelector("#tag-parent-name").textContent = selectedNode.label;
  updateSummary();
}

document.querySelector("#focus-node").addEventListener("click", () => focusNode(selectedNode));
document.querySelector("#record-learning").addEventListener("click", () => {
  if (!selectedNode) return;
  const current = effectiveProgress(selectedNode);
  progressOverrides[selectedNode.id] = Math.min(100, current + 10);
  writeStorage(progressStorageKey, progressOverrides);
  updateInspector();
  triggerCosmicBurst(selectedNode, effectiveProgress(selectedNode) >= 80 ? "#f1d39d" : typeColors[selectedNode.type], 1.15);
  showAchievement("LEARNING SIGNAL RECORDED", "星云亮度 +10%", `“${selectedNode.label}”正在成为你宇宙中更明亮的坐标。`);
  announce(`“${selectedNode.label}”学习深度提升到 ${progressOverrides[selectedNode.id]}%`);
});

function updateSummary() {
  const meaningfulNodes = nodes.filter((node) => node.type !== "problem" && !node.personal);
  const explored = meaningfulNodes.filter((node) => effectiveProgress(node) > 0).length;
  const average = Math.round(meaningfulNodes.reduce((sum, node) => sum + effectiveProgress(node), 0) / meaningfulNodes.length);
  const solved = nodes.filter((node) => node.type === "problem" && effectiveProgress(node) >= 60).length;
  document.querySelector("#explored-count").textContent = explored;
  document.querySelector("#depth-average").textContent = `${average}%`;
  document.querySelector("#solved-count").textContent = solved;
  document.querySelector("#summary-progress-bar").style.width = `${average}%`;
  document.querySelector("#rank-depth").textContent = `${average}%`;
  document.querySelector("#rank-name").textContent = average >= 75 ? "SUPERNOVA" : average >= 55 ? "ORBIT III" : average >= 35 ? "ORBIT II" : "ORBIT I";
}

document.querySelectorAll("[data-view-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    viewMode = button.dataset.viewMode;
    document.querySelectorAll("[data-view-mode]").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
    document.querySelector("#summary-mode").textContent = viewMode === "personal" ? "我的星系" : "全部知识";
    if (viewMode === "personal") {
      modePulseStarted = performance.now();
      showAchievement("PERSONAL GALAXY ONLINE", "你的知识宇宙已经显现", "每一片光芒，都来自你真实留下的学习轨迹。");
    }
    announce(viewMode === "personal" ? "已切换到我的星系，亮度代表你的学习深度" : "已切换到全部知识视图");
  });
});

document.querySelectorAll("[data-galaxy-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const field = button.dataset.galaxyFilter;
    if (visibleFields.has(field)) visibleFields.delete(field);
    else visibleFields.add(field);
    button.classList.toggle("active", visibleFields.has(field));
    if (!visibleFields.size) {
      visibleFields.add(field);
      button.classList.add("active");
      announce("至少保留一片可见星云");
    }
  });
});

document.querySelector("#show-all-galaxies").addEventListener("click", () => {
  Object.keys(fieldColors).forEach((field) => visibleFields.add(field));
  document.querySelectorAll("[data-galaxy-filter]").forEach((button) => button.classList.add("active"));
  resetView();
});

const searchForm = document.querySelector("#galaxy-search");
const searchInput = document.querySelector("#galaxy-search-input");
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return;
  const match = nodes
    .filter((node) => visibleFields.has(node.field))
    .sort((a, b) => Number(b.label.toLowerCase() === query) - Number(a.label.toLowerCase() === query))
    .find((node) => node.label.toLowerCase().includes(query) || node.id.toLowerCase().includes(query) || node.title?.toLowerCase().includes(query));
  if (!match) {
    announce(`没有找到“${searchInput.value.trim()}”`);
    return;
  }
  focusNode(match);
  announce(`已定位到“${match.label}”`);
});

const tagDialog = document.querySelector("#tag-dialog");
const tagForm = document.querySelector("#tag-form");
const tagNameInput = document.querySelector("#tag-name");
const tagKindInput = document.querySelector("#tag-kind");

document.querySelector("#create-personal-tag").addEventListener("click", () => {
  if (!selectedNode) return;
  tagForm.reset();
  document.querySelector("#tag-parent-name").textContent = selectedNode.label;
  tagDialog.showModal();
  window.setTimeout(() => tagNameInput.focus(), 50);
});

tagForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!tagForm.reportValidity() || !selectedNode) return;

  const personalCount = nodes.filter((node) => node.personal && node.parent === selectedNode.id).length;
  const angle = personalCount * 1.77 + .55;
  const radius = 58 + personalCount * 7;
  const chosenType = tagKindInput.value;
  const type = chosenType === "concept" ? "concept" : "tag";
  const personalNode = {
    id: `personal-${Date.now()}`,
    label: tagNameInput.value.trim(),
    type,
    field: selectedNode.field,
    x: selectedNode.x + Math.cos(angle) * radius,
    y: selectedNode.y + Math.sin(angle) * radius,
    progress: 5,
    parent: selectedNode.id,
    personal: true,
    personalKind: chosenType,
    description: `你围绕“${selectedNode.label}”创建的个人标签。`,
    path: [...(selectedNode.path || [fieldNames[selectedNode.field]]), tagNameInput.value.trim()],
    tags: [selectedNode.label, "个人星系"]
  };
  nodes.push(personalNode);
  edges.push({ from: selectedNode.id, to: personalNode.id, kind: "personal" });
  rebuildNodeMap();
  rebuildAdjacency();
  const personalTags = nodes.filter((node) => node.personal);
  writeStorage(tagStorageKey, personalTags);
  tagDialog.close();
  selectNode(personalNode);
  camera.targetScale = Math.max(1.08, camera.targetScale);
  triggerCosmicBurst(personalNode, "#d177ef", 1.3);
  showAchievement("NEW STAR BORN", "一颗属于你的新星被点亮", `“${personalNode.label}”已经加入你的个人知识星系。`);
  announce(`个人标签“${personalNode.label}”已经成为一颗新星`);
});

let liveTimer;
let revealTimer;
let achievementTimer;

function showFieldReveal(name) {
  const reveal = document.querySelector("#field-reveal");
  document.querySelector("#field-reveal-name").textContent = name;
  reveal.classList.add("show");
  clearTimeout(revealTimer);
  revealTimer = window.setTimeout(() => reveal.classList.remove("show"), 1050);
}

function showAchievement(kicker, title, message) {
  const flare = document.querySelector("#achievement-flare");
  document.querySelector("#achievement-kicker").textContent = kicker;
  document.querySelector("#achievement-title").textContent = title;
  document.querySelector("#achievement-message").textContent = message;
  flare.classList.remove("show");
  window.requestAnimationFrame(() => flare.classList.add("show"));
  clearTimeout(achievementTimer);
  achievementTimer = window.setTimeout(() => flare.classList.remove("show"), 3600);
}

function announce(message) {
  const live = document.querySelector("#galaxy-live");
  live.textContent = message;
  live.classList.add("show");
  clearTimeout(liveTimer);
  liveTimer = window.setTimeout(() => live.classList.remove("show"), 2600);
}

function dismissHint() {
  if (hintDismissed) return;
  hintDismissed = true;
  document.querySelector("#stage-hint").style.opacity = "0";
}

let lastLayerText = "";
let lastZoomText = "";
function updateLayerLabel() {
  let layer = "知识模块";
  if (camera.scale >= 1.38) layer = "题目星尘";
  else if (camera.scale >= .93) layer = "结构与方法标签";
  else if (camera.scale >= .63) layer = "知识点";
  const layerText = `当前层级：${layer}`;
  const zoomText = `${Math.round(camera.scale * 100)}%`;
  if (layerText !== lastLayerText) {
    document.querySelector("#visible-layer").textContent = layerText;
    lastLayerText = layerText;
  }
  if (zoomText !== lastZoomText) {
    document.querySelector("#zoom-level").textContent = zoomText;
    lastZoomText = zoomText;
  }
}

const mobilePanelButton = document.querySelector("#mobile-panel-button");
mobilePanelButton.addEventListener("click", () => document.querySelector("#galaxy-controls").classList.toggle("open"));
document.querySelector("#inspector-close").addEventListener("click", () => document.querySelector("#node-inspector").classList.remove("open"));

const immersiveToggle = document.querySelector("#immersive-toggle");
function setImmersive(active) {
  document.body.classList.toggle("immersive", active);
  immersiveToggle.setAttribute("aria-pressed", String(active));
  immersiveToggle.querySelector("span").textContent = active ? "×" : "⛶";
  window.setTimeout(resizeCanvas, 280);
  if (active) {
    showAchievement("DEEP SPACE MODE", "沉浸探索已经开启", "界面已退入暗处，现在只剩下你的知识宇宙。");
    dismissHint();
  }
}

immersiveToggle.addEventListener("click", () => setImmersive(!document.body.classList.contains("immersive")));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("immersive")) setImmersive(false);
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
updateInspector();
selectionEmphasisActive = false;
updateSummary();
window.setTimeout(() => showFieldReveal("你的知识宇宙"), 420);
window.requestAnimationFrame(draw);
