const hub = document.querySelector("#cosmic-hub");
const shipStage = document.querySelector("#ship-stage");
const flowCanvas = document.querySelector("#flowcraft");
const signalLayer = document.querySelector("#signal-layer");
const nebulaCanvas = document.querySelector("#nebula-field");
const starCanvas = document.querySelector("#starfield");
const searchForm = document.querySelector("#coordinate-search");
const searchInput = document.querySelector("#coordinate-input");
const routeResults = document.querySelector("#route-results");
const resolvedQuery = document.querySelector("#resolved-query");
const primaryDestination = document.querySelector("#primary-destination");
const systemPanel = document.querySelector("#system-panel");
const systemKicker = document.querySelector("#system-kicker");
const systemTitle = document.querySelector("#system-title");
const systemDescription = document.querySelector("#system-description");
const systemItems = document.querySelector("#system-items");
const systemPrimary = document.querySelector("#system-primary");
const jumpOverlay = document.querySelector("#jump-overlay");
const jumpLabel = document.querySelector("#jump-label");
const dockTime = document.querySelector("#dock-time");
const toast = document.querySelector("#toast");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cursorInfluence = { x: 0, y: 0 };

const systems = {
  problems: {
    kicker: "PLANET ARCHIVE",
    title: "题库 · 行星档案",
    description: "检索历年高考与模拟题。每一道题都是一颗可以抵达的行星，知识标签、难度和来源共同构成它的坐标。",
    action: "进入完整题库",
    items: [
      ["2025 新高考全国Ⅰ卷", "新收录 · 22 道题", "NEW"],
      ["圆锥曲线定点问题", "解析几何 · 168 道题", "168"],
      ["导数中的隐零点", "函数与导数 · 94 道题", "94"]
    ]
  },
  routes: {
    kicker: "ROUTE PLANNER",
    title: "题单 · 航线规划",
    description: "把分散的题目组织成一条可以连续航行的路线，从基础坐标出发，逐步抵达综合问题。",
    action: "查看全部航线",
    items: [
      ["导数压轴题进阶航线", "12 / 24 已完成", "50%"],
      ["解析几何通法整理", "8 个关键坐标", "08"],
      ["概率统计基础巡航", "预计 3 小时", "3H"]
    ]
  },
  papers: {
    kicker: "FULL EXPEDITIONS",
    title: "整卷 · 远征任务",
    description: "一套完整试卷是一场限时远征。系统记录用时、停留区域和需要再次探索的知识坐标。",
    action: "选择一场远征",
    items: [
      ["2025 新高考全国Ⅰ卷", "150 分钟 · 全国卷", "Ⅰ"],
      ["八省联考数学模拟", "120 分钟 · 模拟卷", "08"],
      ["函数与导数专题卷", "90 分钟 · 专题卷", "F′"]
    ]
  },
  signals: {
    kicker: "COMMUNITY SIGNALS",
    title: "讨论 · 通讯信号",
    description: "接收其他探索者发出的提问、补充与新解法。越活跃的讨论，信号强度越高。",
    action: "打开信号频道",
    items: [
      ["圆锥曲线题能否不设斜率？", "24 条回应 · 信号增强", "24"],
      ["同构变形应当如何识别？", "方法讨论 · 导数", "NEW"],
      ["一道概率题的三种观察方式", "11 条回应 · 概率", "11"]
    ]
  },
  columns: {
    kicker: "EXPLORATION LOGBOOK",
    title: "专栏 · 探索档案",
    description: "把零散发现整理为可以反复阅读的航行档案：方法、证明、题型史与更长的数学叙事。",
    action: "进入专栏档案",
    items: [
      ["从切线到极值点偏移", "方法档案 · 12 分钟", "12M"],
      ["圆锥曲线定点问题的结构", "解析几何 · 系列文章", "03"],
      ["高考试题中的数学语言", "编辑精选 · 本周", "★"]
    ]
  },
  log: {
    kicker: "CAPTAIN'S LOG",
    title: "航行日志 · 我的计划",
    description: "记录时间坐标、今日任务和已经点亮的区域。所有数据暂时保存在当前设备。",
    action: "管理我的航行日志",
    items: [
      ["完成导数题单第 13—16 题", "今日任务 · 已完成", "✓"],
      ["整理圆锥曲线第二定义", "今日任务 · 航行中", "02"],
      ["距离下一次模拟考试", "2026 年 8 月 18 日", "7D"]
    ]
  }
};

let toastTimer = 0;
let jumpTimer = 0;
let searchTimer = 0;
let warpCopyTimers = [];

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function closeLayers() {
  routeResults.hidden = true;
  systemPanel.hidden = true;
  hub.classList.remove("has-layer");
  document.querySelectorAll(".dock-app[aria-pressed='true']").forEach((button) => button.setAttribute("aria-pressed", "false"));
}

function openSearchResults(query) {
  systemPanel.hidden = true;
  resolvedQuery.textContent = query;
  primaryDestination.textContent = `${query} · 高匹配题目`;
  routeResults.hidden = false;
  hub.classList.add("has-layer");
  routeResults.querySelector(".destination")?.focus({ preventScroll: true });
}

function scheduleWarpCopy(stages) {
  warpCopyTimers.forEach((timer) => window.clearTimeout(timer));
  warpCopyTimers = stages.map(([delay, label]) => window.setTimeout(() => {
    if (hub.classList.contains("is-jumping")) jumpLabel.textContent = label;
  }, delay));
}

function runSearchWarp(query) {
  if (hub.classList.contains("is-jumping")) return;
  closeLayers();
  jumpLabel.textContent = `正在穿越至「${query}」`;
  jumpOverlay.setAttribute("aria-hidden", "false");
  hub.classList.add("is-jumping", "is-searching");
  scheduleWarpCopy([
    [850, "正在进入弯曲航线"],
    [2100, "目标星域坐标正在收敛"],
    [3150, "即将抵达检索区域"]
  ]);
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    hub.classList.remove("is-jumping", "is-searching");
    jumpOverlay.setAttribute("aria-hidden", "true");
    openSearchResults(query);
  }, reducedMotion ? 100 : 3600);
}

function openSystem(key, sourceButton) {
  const system = systems[key];
  if (!system) return;
  routeResults.hidden = true;
  systemKicker.textContent = system.kicker;
  systemTitle.textContent = system.title;
  systemDescription.textContent = system.description;
  systemPrimary.innerHTML = `${system.action} <span aria-hidden="true">→</span>`;
  systemPrimary.dataset.system = key;
  systemItems.innerHTML = system.items.map(([title, detail, marker]) => `
    <div class="system-item">
      <span><strong>${title}</strong><small>${detail}</small></span>
      <b>${marker}</b>
    </div>
  `).join("");
  document.querySelectorAll(".dock-app[aria-pressed='true']").forEach((button) => button.setAttribute("aria-pressed", "false"));
  if (sourceButton?.classList.contains("dock-app")) sourceButton.setAttribute("aria-pressed", "true");
  systemPanel.hidden = false;
  hub.classList.add("has-layer");
  systemPanel.querySelector(".panel-close")?.focus({ preventScroll: true });
}

function initiateJump(label, url = "") {
  if (hub.classList.contains("is-jumping")) return;
  closeLayers();
  jumpLabel.textContent = label;
  jumpOverlay.setAttribute("aria-hidden", "false");
  hub.classList.add("is-jumping");
  scheduleWarpCopy([
    [950, "航向曲线已建立"],
    [2350, "正在穿越深空速度场"],
    [3650, "目标区域即将展开"]
  ]);
  window.clearTimeout(jumpTimer);
  jumpTimer = window.setTimeout(() => {
    if (url) {
      window.location.assign(url);
      return;
    }
    hub.classList.remove("is-jumping", "is-searching");
    jumpOverlay.setAttribute("aria-hidden", "true");
    showToast(`${label}已加入航行序列`);
  }, reducedMotion ? 150 : 4200);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) {
    searchInput.focus();
    showToast("请先输入一个问题或知识坐标");
    return;
  }
  runSearchWarp(query);
});

document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query;
    runSearchWarp(button.dataset.query);
  });
});

document.querySelectorAll("[data-demo-search]").forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.demoSearch;
    runSearchWarp(button.dataset.demoSearch);
  });
});

document.querySelectorAll("[data-open-system]").forEach((button) => {
  button.addEventListener("click", () => openSystem(button.dataset.openSystem, button));
  if (button.classList.contains("dock-app")) button.setAttribute("aria-pressed", "false");
});

document.querySelectorAll("[data-close-layer]").forEach((button) => button.addEventListener("click", closeLayers));

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => initiateJump(button.dataset.jumpLabel || "正在前往目标", button.dataset.jump));
});

document.querySelectorAll(".destination").forEach((button) => {
  button.addEventListener("click", () => initiateJump(`正在锁定${button.dataset.destination}`));
});

systemPrimary.addEventListener("click", () => {
  const label = systems[systemPrimary.dataset.system]?.title || "目标系统";
  initiateJump(`正在打开${label}`);
});

window.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;
  if (event.key === "/" && activeTag !== "INPUT" && activeTag !== "TEXTAREA") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape") {
    closeLayers();
    searchInput.blur();
  }
});

function updateClock() {
  dockTime.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
updateClock();
window.setInterval(updateClock, 30000);

if (!reducedMotion && window.matchMedia("(pointer:fine)").matches) {
  window.addEventListener("pointermove", (event) => {
    const normalizedX = event.clientX / window.innerWidth - .5;
    const normalizedY = event.clientY / window.innerHeight - .5;
    cursorInfluence.x = normalizedX;
    cursorInfluence.y = normalizedY;
    hub.style.setProperty("--drift-x", `${normalizedX * -12}px`);
    hub.style.setProperty("--drift-y", `${normalizedY * -8}px`);
    hub.style.setProperty("--nebula-x", `${normalizedX * 4}px`);
    hub.style.setProperty("--nebula-y", `${normalizedY * 3}px`);
    shipStage.style.setProperty("--ship-tilt-y", `${normalizedX * 5}deg`);
    shipStage.style.setProperty("--ship-tilt-x", `${normalizedY * -4}deg`);
  }, { passive: true });
}

const starContext = starCanvas.getContext("2d", { alpha: true });
const flowContext = flowCanvas.getContext("2d", { alpha: true });
const lowPower = window.matchMedia("(pointer:coarse)").matches || (navigator.hardwareConcurrency || 8) <= 4;
const trailSamples = lowPower ? 7 : 11;
const stars = [];
const beacons = [];
const flowParticles = [];
const starColors = [[205, 219, 255], [130, 176, 232], [224, 195, 139]];
let canvasWidth = 1;
let canvasHeight = 1;
let canvasDpr = 1;
let flowWidth = 1;
let flowHeight = 1;
let flowDpr = 1;
let lastFrame = 0;
let lastNebulaFrame = 0;
let travelSpeed = .3;
let warpEnergy = 0;

const beaconData = [
  { type: "NEW PROBLEMS", title: "今日新增 24 道题", query: "今日新增高考数学题", color: "" },
  { type: "FULL PAPER", title: "2025 新高考Ⅰ卷已收录", query: "2025 新高考全国Ⅰ卷", color: "cyan" },
  { type: "NEW METHOD", title: "圆锥曲线 · 新增一种解法", query: "圆锥曲线最新解法", color: "violet" },
  { type: "COMMUNITY SIGNAL", title: "18 条新的讨论信号", query: "今日热门数学讨论", color: "blue" }
];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function resetStar(star, placeAtFarEdge = false) {
  star.x = (Math.random() - .5) * 2200;
  star.y = (Math.random() - .5) * 1400;
  star.z = placeAtFarEdge ? 1250 + Math.random() * 160 : 60 + Math.random() * 1340;
  star.velocity = .72 + Math.random() * .85;
  star.size = .42 + Math.random() * 1.28;
  star.alpha = .48 + Math.random() * .5;
  star.phase = Math.random() * Math.PI * 2;
  star.layer = Math.floor(Math.random() * 3);
  if (!star.trailX) {
    star.trailX = new Float32Array(trailSamples);
    star.trailY = new Float32Array(trailSamples);
  }
  star.trailIndex = -1;
  star.trailCount = 0;
}

function rebuildStars() {
  const desiredCount = reducedMotion ? 320 : lowPower ? 440 : 940;
  stars.length = 0;
  for (let index = 0; index < desiredCount; index += 1) {
    const star = { index };
    resetStar(star);
    stars.push(star);
  }
}

function initializeFlowParticles() {
  const count = lowPower ? 54 : 96;
  flowParticles.length = 0;
  for (let index = 0; index < count; index += 1) {
    flowParticles.push({
      u: Math.random() * 1.34,
      v: (Math.random() - .5) * 1.9,
      speed: .0018 + Math.random() * .0028,
      phase: Math.random() * Math.PI * 2,
      size: .45 + Math.random() * 1.05,
      color: index % 3
    });
  }
}

function projectFlowPoint(u, v, time) {
  const scaleUnit = Math.min(flowWidth, flowHeight);
  const bodyU = clamp(u, 0, 1);
  const wake = Math.max(0, u - 1);
  const bodyEnvelope = Math.pow(Math.max(0, Math.sin(Math.PI * bodyU)), .72);
  let halfWidth = scaleUnit * (.024 + .205 * bodyEnvelope * (.86 + Math.cos((bodyU - .48) * Math.PI) * .14));
  let longitudinal = scaleUnit * (-.37 + u * .72);
  let twist = (bodyU - .5) * 1.24 + Math.sin(time * .42) * .09;
  let localX;
  let localZ;

  if (wake > 0) {
    halfWidth = scaleUnit * (.025 + wake * .11);
    twist += wake * 2.1;
    const turbulence = Math.sin(time * 2.1 + v * 4.8 + wake * 13) * scaleUnit * wake * .035;
    localX = v * halfWidth * Math.cos(twist) + turbulence;
    localZ = v * halfWidth * Math.sin(twist) + Math.cos(time * 1.7 + v * 3.2) * scaleUnit * wake * .018;
  } else {
    const foldedSurface = Math.sin(v * Math.PI) * halfWidth * .2;
    localX = v * halfWidth * Math.cos(twist) + foldedSurface * Math.sin(time * .36 + bodyU * 3.2);
    localZ = v * halfWidth * Math.sin(twist) + foldedSurface * .72;
  }

  localX += Math.sin(bodyU * Math.PI * 1.4 + time * .28) * scaleUnit * .009;
  longitudinal += Math.sin(v * Math.PI) * scaleUnit * .008;

  const yaw = -.2;
  const pitch = .075;
  const yawX = localX * Math.cos(yaw) - localZ * Math.sin(yaw);
  const yawZ = localX * Math.sin(yaw) + localZ * Math.cos(yaw);
  const pitchY = longitudinal * Math.cos(pitch) - yawZ * Math.sin(pitch);
  const depth = longitudinal * Math.sin(pitch) + yawZ * Math.cos(pitch);
  const perspective = 1 / (1 + depth / (scaleUnit * 1.55));

  return {
    x: flowWidth * .5 + yawX * perspective,
    y: flowHeight * .5 + pitchY * perspective,
    depth,
    perspective
  };
}

function drawFlowcraft(now, delta, move = true) {
  flowContext.clearRect(0, 0, flowWidth, flowHeight);
  const time = now / 1000;
  const scaleUnit = Math.min(flowWidth, flowHeight);
  const palette = [[96, 153, 255], [184, 103, 255], [255, 181, 96]];
  flowContext.globalCompositeOperation = "lighter";
  flowContext.lineCap = "round";
  flowContext.lineJoin = "round";

  const aura = flowContext.createRadialGradient(flowWidth * .5, flowHeight * .53, 0, flowWidth * .5, flowHeight * .53, scaleUnit * .34);
  aura.addColorStop(0, `rgba(112,142,255,${.055 + warpEnergy * .035})`);
  aura.addColorStop(.46, `rgba(125,76,214,${.025 + warpEnergy * .018})`);
  aura.addColorStop(1, "rgba(25,31,80,0)");
  flowContext.fillStyle = aura;
  flowContext.fillRect(0, 0, flowWidth, flowHeight);

  const streamlineCount = lowPower ? 13 : 21;
  for (let line = 0; line < streamlineCount; line += 1) {
    const v = -1 + line / (streamlineCount - 1) * 2;
    const gradient = flowContext.createLinearGradient(0, flowHeight * .16, 0, flowHeight * .86);
    const edgeFade = Math.pow(1 - Math.abs(v) * .62, 1.3);
    gradient.addColorStop(0, `rgba(118,191,255,${.08 * edgeFade})`);
    gradient.addColorStop(.44, `rgba(124,119,255,${(.24 + warpEnergy * .08) * edgeFade})`);
    gradient.addColorStop(.7, `rgba(204,102,255,${.18 * edgeFade})`);
    gradient.addColorStop(1, `rgba(255,171,94,${.025 * edgeFade})`);
    flowContext.strokeStyle = gradient;
    flowContext.lineWidth = line === Math.floor(streamlineCount / 2) ? 1.45 : .45 + edgeFade * .48;
    flowContext.beginPath();
    for (let sample = 0; sample <= 48; sample += 1) {
      const u = sample / 48 * 1.18;
      const point = projectFlowPoint(u, v, time);
      if (sample === 0) flowContext.moveTo(point.x, point.y);
      else flowContext.lineTo(point.x, point.y);
    }
    flowContext.stroke();
  }

  for (let contour = 1; contour <= 12; contour += 1) {
    const u = contour / 13;
    const alpha = .035 + Math.sin(u * Math.PI) * .075;
    flowContext.strokeStyle = `rgba(164,198,255,${alpha})`;
    flowContext.lineWidth = .55;
    flowContext.beginPath();
    for (let sample = 0; sample <= 32; sample += 1) {
      const v = -1 + sample / 32 * 2;
      const point = projectFlowPoint(u, v, time);
      if (sample === 0) flowContext.moveTo(point.x, point.y);
      else flowContext.lineTo(point.x, point.y);
    }
    flowContext.stroke();
  }

  const ringGradient = flowContext.createLinearGradient(flowWidth * .31, 0, flowWidth * .69, 0);
  ringGradient.addColorStop(0, "rgba(97,163,255,.18)");
  ringGradient.addColorStop(.5, `rgba(242,231,255,${.5 + warpEnergy * .18})`);
  ringGradient.addColorStop(1, "rgba(228,123,255,.18)");
  flowContext.strokeStyle = ringGradient;
  flowContext.lineWidth = 1.35;
  flowContext.beginPath();
  for (let sample = 0; sample <= 72; sample += 1) {
    const angle = sample / 72 * Math.PI * 2;
    const point = projectFlowPoint(.5 + Math.sin(angle) * .032, Math.cos(angle) * .92, time);
    if (sample === 0) flowContext.moveTo(point.x, point.y);
    else flowContext.lineTo(point.x, point.y);
  }
  flowContext.stroke();

  flowParticles.forEach((particle) => {
    if (move) particle.u += particle.speed * delta * (1 + warpEnergy * 2.2);
    if (particle.u > 1.34) {
      particle.u = -Math.random() * .08;
      particle.v = (Math.random() - .5) * 1.9;
    }
    const trailU = particle.u - particle.speed * (4 + warpEnergy * 16);
    const head = projectFlowPoint(particle.u, particle.v, time + particle.phase * .02);
    const tail = projectFlowPoint(trailU, particle.v, time + particle.phase * .02);
    const endpointFade = clamp(particle.u / .12, 0, 1) * clamp((1.36 - particle.u) / .28, 0, 1);
    const [red, green, blue] = palette[particle.color];
    const particleTrail = flowContext.createLinearGradient(tail.x, tail.y, head.x, head.y);
    particleTrail.addColorStop(0, `rgba(${red},${green},${blue},0)`);
    particleTrail.addColorStop(1, `rgba(${red},${green},${blue},${endpointFade * (.42 + warpEnergy * .25)})`);
    flowContext.strokeStyle = particleTrail;
    flowContext.lineWidth = particle.size * (.55 + head.perspective * .36);
    flowContext.beginPath();
    flowContext.moveTo(tail.x, tail.y);
    flowContext.lineTo(head.x, head.y);
    flowContext.stroke();
  });

  flowContext.globalCompositeOperation = "source-over";
}

function createBeacons() {
  const desiredCount = lowPower ? 2 : 4;
  beaconData.slice(0, desiredCount).forEach((data, index) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "signal-beacon";
    element.setAttribute("aria-label", `${data.type}：${data.title}`);
    element.innerHTML = `
      <span class="beacon-star ${data.color}" aria-hidden="true"></span>
      <span class="beacon-line" aria-hidden="true"></span>
      <span class="beacon-copy"><small>${data.type}</small><strong>${data.title}</strong></span>
    `;
    const beacon = { element, data, paused: false, index };
    element.addEventListener("pointerenter", () => { beacon.paused = true; });
    element.addEventListener("pointerleave", () => { beacon.paused = false; });
    element.addEventListener("focus", () => { beacon.paused = true; });
    element.addEventListener("blur", () => { beacon.paused = false; });
    element.addEventListener("click", () => {
      searchInput.value = data.query;
      runSearchWarp(data.query);
    });
    signalLayer.append(element);
    beacons.push(beacon);
    resetBeacon(beacon, true);
  });
}

function resetBeacon(beacon, initial = false) {
  const side = beacon.index % 2 === 0 ? -1 : 1;
  beacon.x = side * (280 + Math.random() * 250);
  beacon.y = -230 + Math.random() * 450;
  beacon.z = initial ? 330 + beacon.index * 205 + Math.random() * 90 : 1260 + Math.random() * 180;
  beacon.velocity = .34 + Math.random() * .16;
}

function updateBeacons(delta, move = true) {
  const centerX = canvasWidth * .5;
  const centerY = canvasHeight * .59;
  const focal = Math.min(canvasWidth, canvasHeight) * .74;
  const jumping = hub.classList.contains("is-jumping");

  beacons.forEach((beacon) => {
    if (move && !beacon.paused) beacon.z -= (jumping ? 15 : beacon.velocity) * delta;
    if (beacon.z < 125) resetBeacon(beacon);

    const x = centerX + beacon.x / beacon.z * focal;
    const y = centerY + beacon.y / beacon.z * focal;
    const distanceFade = clamp((1280 - beacon.z) / 410, 0, 1) * clamp((beacon.z - 110) / 150, 0, 1);
    const insideViewport = x > -210 && x < canvasWidth + 25 && y > 60 && y < canvasHeight - 82;
    const opacity = insideViewport && !jumping ? distanceFade * .84 : 0;
    const scale = clamp(.58 + (1260 - beacon.z) / 1700, .58, 1.05);

    beacon.element.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    beacon.element.style.opacity = opacity.toFixed(3);
    beacon.element.tabIndex = opacity > .28 ? 0 : -1;
  });
}

function resizeStarfield() {
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  canvasDpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.25);
  starCanvas.width = Math.round(canvasWidth * canvasDpr);
  starCanvas.height = Math.round(canvasHeight * canvasDpr);
  starContext.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
}

function resizeFlowcraft() {
  const bounds = flowCanvas.getBoundingClientRect();
  flowWidth = Math.max(1, bounds.width);
  flowHeight = Math.max(1, bounds.height);
  flowDpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
  flowCanvas.width = Math.round(flowWidth * flowDpr);
  flowCanvas.height = Math.round(flowHeight * flowDpr);
  flowContext.setTransform(flowDpr, 0, 0, flowDpr, 0, 0);
}

function drawStars(delta, move = true, now = performance.now()) {
  starContext.clearRect(0, 0, canvasWidth, canvasHeight);
  const jumping = hub.classList.contains("is-jumping");
  const targetEnergy = jumping ? 1 : 0;
  const energyResponse = jumping ? .036 : .026;
  warpEnergy += (targetEnergy - warpEnergy) * energyResponse * delta;
  if (!jumping && warpEnergy < .001) warpEnergy = 0;

  const targetSpeed = .3 + Math.pow(warpEnergy, 2.25) * 64;
  travelSpeed += (targetSpeed - travelSpeed) * (.045 + warpEnergy * .055) * delta;

  const time = now / 1000;
  const steering = Math.pow(warpEnergy, 1.4);
  const yaw = cursorInfluence.x * .012 * (1 - warpEnergy * .72) + (Math.sin(time * .57) + Math.sin(time * 1.13 + 2.4) * .34) * .034 * steering;
  const pitch = cursorInfluence.y * -.009 * (1 - warpEnergy * .72) + (Math.sin(time * .43 + 1.8) + Math.sin(time * .91) * .28) * .021 * steering;
  const roll = Math.sin(time * .31 + .7) * .016 * steering;
  const cosineYaw = Math.cos(yaw);
  const sineYaw = Math.sin(yaw);
  const cosinePitch = Math.cos(pitch);
  const sinePitch = Math.sin(pitch);
  const cosineRoll = Math.cos(roll);
  const sineRoll = Math.sin(roll);
  const centerX = canvasWidth * .5;
  const centerY = canvasHeight * .59;
  const focal = Math.min(canvasWidth, canvasHeight) * (.79 + warpEnergy * .075);
  const radialExtent = Math.hypot(canvasWidth, canvasHeight) * .54;

  starContext.globalCompositeOperation = "lighter";
  starContext.lineCap = "round";
  starContext.lineJoin = "round";

  stars.forEach((star) => {
    if (move) {
      star.z -= travelSpeed * star.velocity * delta;
      star.phase += .013 * delta;
    }
    if (star.z < 18) {
      resetStar(star, true);
      return;
    }

    // Transform the world through a gently curving camera path before projection.
    const yawX = star.x * cosineYaw - star.z * sineYaw;
    const yawZ = star.x * sineYaw + star.z * cosineYaw;
    const pitchY = star.y * cosinePitch - yawZ * sinePitch;
    const viewZ = star.y * sinePitch + yawZ * cosinePitch;
    const viewX = yawX * cosineRoll - pitchY * sineRoll;
    const viewY = yawX * sineRoll + pitchY * cosineRoll;

    if (viewZ < 18) {
      resetStar(star, true);
      return;
    }

    // Perspective projection: projected = viewportCenter + viewPosition * focalLength / viewDepth.
    const screenX = centerX + viewX * focal / viewZ;
    const screenY = centerY + viewY * focal / viewZ;
    if (screenX < -120 || screenX > canvasWidth + 120 || screenY < -120 || screenY > canvasHeight + 120) {
      resetStar(star, true);
      return;
    }

    star.trailIndex = (star.trailIndex + 1) % trailSamples;
    star.trailX[star.trailIndex] = screenX;
    star.trailY[star.trailIndex] = screenY;
    star.trailCount = Math.min(trailSamples, star.trailCount + 1);

    const depth = clamp(1 - viewZ / 1480, .1, 1);
    const twinkle = jumping ? 1 : .72 + Math.sin(star.phase) * .28;
    const alpha = clamp(star.alpha * (.34 + depth * .92) * twinkle, .15, .96);
    const [red, green, blue] = starColors[star.layer];
    const radius = clamp(star.size * (.63 + depth * 1.5), .48, 2.75);
    const distanceFromFlightAxis = Math.hypot(screenX - centerX, screenY - centerY);
    const radialFactor = clamp(distanceFromFlightAxis / radialExtent, 0, 1);
    const visibleTrailSamples = clamp(
      2 + Math.floor(Math.pow(warpEnergy, .82) * Math.pow(radialFactor, .72) * (trailSamples - 2)),
      2,
      star.trailCount
    );
    const shouldDrawTrail = warpEnergy > .075 && visibleTrailSamples >= 2;

    if (shouldDrawTrail) {
      const oldestIndex = (star.trailIndex - visibleTrailSamples + 1 + trailSamples) % trailSamples;
      const tailX = star.trailX[oldestIndex];
      const tailY = star.trailY[oldestIndex];
      const trailDistance = Math.hypot(screenX - tailX, screenY - tailY);

      if (trailDistance > .7) {
        const trail = starContext.createLinearGradient(tailX, tailY, screenX, screenY);
        const trailOpacity = alpha * (.34 + radialFactor * .52) * clamp(warpEnergy * 1.25, 0, 1);
        trail.addColorStop(0, `rgba(${red},${green},${blue},0)`);
        trail.addColorStop(.58, `rgba(${red},${green},${blue},${trailOpacity * .14})`);
        trail.addColorStop(.9, `rgba(${red},${green},${blue},${trailOpacity * .62})`);
        trail.addColorStop(1, `rgba(245,249,255,${trailOpacity})`);
        starContext.strokeStyle = trail;
        starContext.lineWidth = clamp(radius * (.42 + radialFactor * .72 + warpEnergy * .35), .5, 2.9);
        starContext.beginPath();
        for (let sample = 0; sample < visibleTrailSamples; sample += 1) {
          const historyIndex = (oldestIndex + sample) % trailSamples;
          const historyX = star.trailX[historyIndex];
          const historyY = star.trailY[historyIndex];
          if (sample === 0) starContext.moveTo(historyX, historyY);
          else starContext.lineTo(historyX, historyY);
        }
        starContext.stroke();

        starContext.fillStyle = `rgba(247,250,255,${trailOpacity})`;
        starContext.beginPath();
        starContext.arc(screenX, screenY, clamp(radius * .48, .38, 1.25), 0, Math.PI * 2);
        starContext.fill();
        return;
      }
    }

    if (radius > 1.65 && star.alpha > .76) {
      const halo = starContext.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius * 4.2);
      halo.addColorStop(0, `rgba(${red},${green},${blue},${alpha * .36})`);
      halo.addColorStop(1, `rgba(${red},${green},${blue},0)`);
      starContext.fillStyle = halo;
      starContext.beginPath();
      starContext.arc(screenX, screenY, radius * 4.2, 0, Math.PI * 2);
      starContext.fill();
    }
    starContext.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
    starContext.beginPath();
    starContext.arc(screenX, screenY, radius, 0, Math.PI * 2);
    starContext.fill();
    if (radius > 1.9 && warpEnergy < .2) {
      starContext.strokeStyle = `rgba(${red},${green},${blue},${alpha * .4})`;
      starContext.lineWidth = .55;
      starContext.beginPath();
      starContext.moveTo(screenX - radius * 3.4, screenY);
      starContext.lineTo(screenX + radius * 3.4, screenY);
      starContext.moveTo(screenX, screenY - radius * 2.5);
      starContext.lineTo(screenX, screenY + radius * 2.5);
      starContext.stroke();
    }
  });

  starContext.globalCompositeOperation = "source-over";
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initializeNebula() {
  const gl = nebulaCanvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: lowPower ? "low-power" : "default"
  });
  if (!gl) return null;

  const vertexSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform float u_time;

    float hash(vec2 point) {
      return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 point) {
      vec2 cell = floor(point);
      vec2 local = fract(point);
      vec2 curve = local * local * (3.0 - 2.0 * local);
      return mix(
        mix(hash(cell), hash(cell + vec2(1.0, 0.0)), curve.x),
        mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), curve.x),
        curve.y
      );
    }

    float fbm(vec2 point) {
      float result = 0.0;
      float amplitude = 0.5;
      mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
      for (int octave = 0; octave < 3; octave++) {
        result += amplitude * noise(point);
        point = rotation * point * 2.03 + vec2(2.4, -1.7);
        amplitude *= 0.5;
      }
      return result;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
      uv += u_pointer * 0.055;
      float time = u_time * 0.026;
      float broad = fbm(uv * 0.58 + vec2(time, -time * 0.7));
      float fold = fbm(uv * 0.92 + broad * 1.62 + vec2(-time * 0.42, time * 0.55));
      float detail = noise(uv * 2.15 - fold * 1.18 + vec2(time * 0.3));
      float curvedAxis = uv.y + uv.x * 0.21 + sin(uv.x * 1.6 + time * 1.8) * 0.075;
      float band = exp(-abs(curvedAxis) * 2.65);
      float cloud = smoothstep(0.32, 0.76, broad * 0.52 + fold * 0.61) * band;
      float filament = smoothstep(0.5, 0.83, fold * 0.64 + detail * 0.4) * pow(band, 1.35);
      vec3 blue = vec3(0.045, 0.17, 0.35);
      vec3 violet = vec3(0.29, 0.12, 0.42);
      vec3 copper = vec3(0.38, 0.16, 0.045);
      vec3 color = mix(blue, violet, clamp(fold * 1.08, 0.0, 1.0));
      float warmCore = pow(max(0.0, 1.0 - length(uv - vec2(-0.62, -0.02))), 4.0);
      color += copper * warmCore * band * (0.28 + fold * 0.22);
      float vignette = smoothstep(1.78, 0.24, length(uv * vec2(0.83, 1.0)));
      float alpha = clamp((cloud * 0.48 + filament * 0.2) * vignette, 0.0, 0.58);
      gl_FragColor = vec4(color * (0.55 + cloud * 0.72) * vignette, alpha);
    }
  `;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  return {
    gl,
    resolution: gl.getUniformLocation(program, "u_resolution"),
    pointer: gl.getUniformLocation(program, "u_pointer"),
    time: gl.getUniformLocation(program, "u_time")
  };
}

const nebula = initializeNebula();

function resizeNebula() {
  if (!nebula) return;
  const scale = lowPower ? .22 : .32;
  const width = clamp(Math.round(window.innerWidth * scale), 300, 620);
  const height = clamp(Math.round(window.innerHeight * scale), 210, 380);
  nebulaCanvas.width = width;
  nebulaCanvas.height = height;
  nebula.gl.viewport(0, 0, width, height);
  nebula.gl.uniform2f(nebula.resolution, width, height);
}

function drawNebula(now) {
  if (!nebula) return;
  nebula.gl.uniform1f(nebula.time, reducedMotion ? 0 : now / 1000);
  nebula.gl.uniform2f(nebula.pointer, cursorInfluence.x, -cursorInfluence.y);
  nebula.gl.drawArrays(nebula.gl.TRIANGLES, 0, 6);
}

function resizeScene() {
  resizeStarfield();
  resizeFlowcraft();
  resizeNebula();
  if (reducedMotion) {
    drawNebula(0);
    drawStars(0, false, 0);
    drawFlowcraft(0, 0, false);
    updateBeacons(0, false);
  }
}

function drawSpace(now) {
  window.requestAnimationFrame(drawSpace);
  if (document.hidden) return;
  const frameInterval = lowPower ? 34 : 16;
  if (now - lastFrame < frameInterval) return;
  const delta = clamp((now - lastFrame) / 16.667, .35, 2.4);
  lastFrame = now;
  drawStars(delta, true, now);
  drawFlowcraft(now, delta);
  updateBeacons(delta);

  const nebulaInterval = lowPower ? 84 : 50;
  if (now - lastNebulaFrame >= nebulaInterval) {
    drawNebula(now);
    lastNebulaFrame = now;
  }
}

createBeacons();
rebuildStars();
initializeFlowParticles();
resizeScene();
window.addEventListener("resize", resizeScene);
if (!reducedMotion) window.requestAnimationFrame(drawSpace);

document.addEventListener("visibilitychange", () => {
  lastFrame = performance.now();
  lastNebulaFrame = lastFrame;
});
