const toast = document.querySelector("#toast");
const heroSearch = document.querySelector("#hero-search");
const heroSearchInput = document.querySelector("#hero-search-input");
const topSearch = document.querySelector("#top-search");
const topSearchInput = document.querySelector("#top-search-input");
const sidebar = document.querySelector("#sidebar");
const mobileMenu = document.querySelector("#mobile-menu");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

let absorbAnimation = 0;
function submitSearch(value) {
  const query = value.trim();
  if (!query) {
    showToast("请输入题号、知识点、试卷或解法关键词");
    return;
  }
  absorbAnimation = performance.now();
  window.dispatchEvent(new CustomEvent("mathverse:search", { detail: { query } }));
  window.setTimeout(() => showToast(`正在为你检索“${query}”——题库页面将在下一阶段接入`), 480);
}

heroSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch(heroSearchInput.value);
});

topSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch(topSearchInput.value);
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    const input = window.innerWidth > 680 ? topSearchInput : heroSearchInput;
    input.focus();
  }
  if (event.key === "Escape") closeMenu();
});

document.querySelectorAll("[data-search-value]").forEach((button) => {
  button.addEventListener("click", () => {
    heroSearchInput.value = button.dataset.searchValue;
    heroSearchInput.focus();
    heroSearch.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

const randomProblems = [
  "2024 新高考Ⅰ卷 · 数列与不等式",
  "2023 全国甲卷 · 圆锥曲线定点问题",
  "2025 九省联考 · 概率统计",
  "函数与导数 · 隐零点专题",
  "立体几何 · 动点与二面角"
];

document.querySelectorAll("[data-random-problem]").forEach((button) => {
  button.addEventListener("click", () => {
    const problem = randomProblems[Math.floor(Math.random() * randomProblems.length)];
    showToast(`为你找到：${problem}`);
  });
});

document.querySelectorAll("[data-demo-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showToast(`${link.dataset.demoLink}将在下一阶段接入，当前可继续体验主页`);
  });
});

const actions = {
  login: "账号系统将在后续阶段接入",
  continue: "登录后即可同步并继续上次学习",
  paper: "整卷页面将在下一阶段接入",
  problem: "题目详情与多解法页面将在下一阶段接入",
  map: "知识地图是下一阶段重点模块，入口已预留"
};

document.querySelectorAll("[data-demo-action]").forEach((button) => {
  button.addEventListener("click", () => showToast(actions[button.dataset.demoAction]));
});

function openMenu() {
  sidebar.classList.add("open");
  sidebarBackdrop.classList.add("visible");
  mobileMenu.setAttribute("aria-expanded", "true");
  document.body.classList.add("menu-open");
}

function closeMenu() {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.remove("visible");
  mobileMenu.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

mobileMenu.addEventListener("click", () => sidebar.classList.contains("open") ? closeMenu() : openMenu());
sidebarBackdrop.addEventListener("click", closeMenu);

const homepageHero = document.querySelector(".hero");
heroSearchInput.addEventListener("focus", () => homepageHero.classList.add("search-active"));
heroSearchInput.addEventListener("blur", () => homepageHero.classList.remove("search-active"));

// Legacy canvas fallback. The homepage now uses the optimized WebGL universe.
const formulaCanvas = document.querySelector("#formula-canvas");
if (formulaCanvas) {
const formulaUniverse = document.querySelector("#formula-universe");
const hero = document.querySelector(".hero");
const formulaContext = formulaCanvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const formulae = [
  { text: "f′(x) = 0", rx: .37, ry: .19, phase: .1, speed: .00017, tilt: -.09 },
  { text: "∫ₐᵇ f(x)dx", rx: .44, ry: .27, phase: 1.45, speed: -.00011, tilt: .08 },
  { text: "lim x→∞", rx: .31, ry: .34, phase: 2.7, speed: .00013, tilt: -.04 },
  { text: "eⁱᵖ + 1 = 0", rx: .47, ry: .39, phase: 4.05, speed: -.00008, tilt: .03 },
  { text: "x² + y² = r²", rx: .36, ry: .45, phase: 5.2, speed: .00009, tilt: .1 },
  { text: "Σ aₙ", rx: .25, ry: .28, phase: 3.5, speed: -.00016, tilt: -.11 }
];
let canvasWidth = 0;
let canvasHeight = 0;
let canvasDpr = 1;
let pointerX = 0;
let pointerY = 0;
let targetPointerX = 0;
let targetPointerY = 0;
let formulaFrame;
let pageVisible = true;

function resizeFormulaCanvas() {
  const rect = formulaUniverse.getBoundingClientRect();
  canvasDpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = Math.max(1, rect.width);
  canvasHeight = Math.max(1, rect.height);
  formulaCanvas.width = Math.round(canvasWidth * canvasDpr);
  formulaCanvas.height = Math.round(canvasHeight * canvasDpr);
  formulaCanvas.style.width = `${canvasWidth}px`;
  formulaCanvas.style.height = `${canvasHeight}px`;
  formulaContext.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
  drawFormulaUniverse(performance.now());
}

function ellipsePoint(item, angle, radiusScale = 1) {
  const centerX = canvasWidth * .54 + pointerX * 8;
  const centerY = canvasHeight * .5 + pointerY * 5;
  const localX = Math.cos(angle) * canvasWidth * item.rx * radiusScale;
  const localY = Math.sin(angle) * canvasHeight * item.ry * radiusScale;
  const cosTilt = Math.cos(item.tilt);
  const sinTilt = Math.sin(item.tilt);
  return {
    x: centerX + localX * cosTilt - localY * sinTilt,
    y: centerY + localX * sinTilt + localY * cosTilt,
    depth: (Math.sin(angle) + 1) / 2
  };
}

function drawOrbit(item) {
  const centerX = canvasWidth * .54 + pointerX * 8;
  const centerY = canvasHeight * .5 + pointerY * 5;
  formulaContext.save();
  formulaContext.translate(centerX, centerY);
  formulaContext.rotate(item.tilt);
  formulaContext.scale(1, item.ry * canvasHeight / (item.rx * canvasWidth));
  formulaContext.beginPath();
  formulaContext.arc(0, 0, item.rx * canvasWidth, 0, Math.PI * 2);
  formulaContext.strokeStyle = "rgba(185, 194, 238, .09)";
  formulaContext.lineWidth = 1;
  formulaContext.stroke();
  formulaContext.restore();
}

function drawFormulaUniverse(time) {
  formulaContext.clearRect(0, 0, canvasWidth, canvasHeight);
  pointerX += (targetPointerX - pointerX) * .045;
  pointerY += (targetPointerY - pointerY) * .045;

  formulae.slice(0, 4).forEach(drawOrbit);

  const focusFactor = hero.classList.contains("search-active") ? .28 : 1;
  const absorptionProgress = absorbAnimation ? Math.min(1, (time - absorbAnimation) / 760) : 0;
  if (absorptionProgress >= 1) absorbAnimation = 0;

  const points = formulae.map((item, index) => {
    const angle = item.phase + (reduceMotion ? 0 : time * item.speed * focusFactor);
    const isAbsorbed = index === 0 && absorbAnimation;
    const radiusScale = isAbsorbed ? Math.max(.05, 1 - absorptionProgress) : 1;
    return { item, index, angle, radiusScale, ...ellipsePoint(item, angle, radiusScale) };
  }).sort((a, b) => a.depth - b.depth);

  points.forEach((point) => {
    const { item, index, x, y, depth } = point;
    const isAbsorbed = index === 0 && absorbAnimation;
    const alpha = isAbsorbed ? Math.max(0, .8 - absorptionProgress) : .17 + depth * .55;
    const size = (9 + depth * 5) * (isAbsorbed ? Math.max(.45, 1 - absorptionProgress * .7) : 1);
    formulaContext.save();
    formulaContext.translate(x, y);
    formulaContext.rotate(item.tilt * .25);
    formulaContext.font = `italic ${size}px Georgia, "Times New Roman", serif`;
    formulaContext.textAlign = "center";
    formulaContext.textBaseline = "middle";
    formulaContext.shadowColor = depth > .68 ? "rgba(239, 198, 131, .45)" : "transparent";
    formulaContext.shadowBlur = depth > .68 ? 9 : 0;
    formulaContext.fillStyle = depth > .62 ? `rgba(246, 222, 181, ${alpha})` : `rgba(196, 207, 255, ${alpha})`;
    formulaContext.fillText(item.text, 0, 0);
    formulaContext.restore();
  });

  for (let index = 0; index < 18; index += 1) {
    const angle = index * 2.399 + time * .000025;
    const radius = 55 + (index % 7) * 19;
    const x = canvasWidth * .54 + Math.cos(angle) * radius + pointerX * 5;
    const y = canvasHeight * .5 + Math.sin(angle) * radius * .48 + pointerY * 3;
    formulaContext.beginPath();
    formulaContext.arc(x, y, index % 5 === 0 ? 1.2 : .65, 0, Math.PI * 2);
    formulaContext.fillStyle = index % 5 === 0 ? "rgba(238,196,126,.55)" : "rgba(190,201,244,.24)";
    formulaContext.fill();
  }
}

function animateFormulaUniverse(time) {
  if (pageVisible) drawFormulaUniverse(time);
  formulaFrame = window.requestAnimationFrame(animateFormulaUniverse);
}

formulaUniverse.addEventListener("pointermove", (event) => {
  const rect = formulaUniverse.getBoundingClientRect();
  targetPointerX = (event.clientX - rect.left) / rect.width - .5;
  targetPointerY = (event.clientY - rect.top) / rect.height - .5;
});
formulaUniverse.addEventListener("pointerleave", () => { targetPointerX = 0; targetPointerY = 0; });
heroSearchInput.addEventListener("focus", () => hero.classList.add("search-active"));
heroSearchInput.addEventListener("blur", () => hero.classList.remove("search-active"));
document.addEventListener("visibilitychange", () => { pageVisible = !document.hidden; });
window.addEventListener("resize", resizeFormulaCanvas);
resizeFormulaCanvas();
if (reduceMotion) drawFormulaUniverse(0);
else formulaFrame = window.requestAnimationFrame(animateFormulaUniverse);
}

// Personal coordinates ----------------------------------------------
const timerDialog = document.querySelector("#timer-dialog");
const timerForm = document.querySelector("#timer-form");
const timerTitleInput = document.querySelector("#timer-title");
const timerDateInput = document.querySelector("#timer-target-date");
const timerEmpty = document.querySelector("#timer-empty");
const timerView = document.querySelector("#timer-view");
const timerPrefix = document.querySelector(".timer-prefix");
const timerName = document.querySelector("#timer-name");
const timerDays = document.querySelector("#timer-days");
const timerDate = document.querySelector("#timer-date");
const timerPosition = document.querySelector("#timer-position");
const timerStorageKey = "mathverse.timers.v1";
let timers = readStorage(timerStorageKey, []);
let currentTimerIndex = 0;

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
    showToast("当前浏览器无法保存计划，本次修改只会临时保留");
  }
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function renderTimers() {
  const hasTimers = timers.length > 0;
  timerEmpty.hidden = hasTimers;
  timerView.hidden = !hasTimers;
  if (!hasTimers) return;

  currentTimerIndex = Math.max(0, Math.min(currentTimerIndex, timers.length - 1));
  const timer = timers[currentTimerIndex];
  const target = new Date(`${timer.date}T00:00:00`);
  const today = startOfLocalDay(new Date());
  const difference = Math.ceil((target - today) / 86400000);
  timerPrefix.childNodes[0].nodeValue = difference >= 0 ? "距离 " : "已经抵达 ";
  timerName.textContent = timer.title;
  timerDays.textContent = Math.abs(difference);
  timerDays.nextElementSibling.textContent = difference >= 0 ? "天" : "天前";
  timerDate.textContent = target.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replaceAll("/", ".");
  timerDate.setAttribute("datetime", timer.date);
  timerPosition.textContent = `${String(currentTimerIndex + 1).padStart(2, "0")} / ${String(timers.length).padStart(2, "0")}`;
}

function openTimerDialog() {
  timerForm.reset();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  timerDateInput.min = dateKey(tomorrow);
  timerDateInput.value = dateKey(tomorrow);
  timerDialog.showModal();
  window.setTimeout(() => timerTitleInput.focus(), 50);
}

document.querySelector("#add-timer").addEventListener("click", openTimerDialog);
document.querySelector("#create-first-timer").addEventListener("click", openTimerDialog);

timerForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!timerForm.reportValidity()) return;
  timers.push({
    id: window.crypto?.randomUUID?.() || String(Date.now()),
    title: timerTitleInput.value.trim(),
    date: timerDateInput.value
  });
  currentTimerIndex = timers.length - 1;
  writeStorage(timerStorageKey, timers);
  renderTimers();
  timerDialog.close();
  showToast("新的时间坐标已经创建");
});

document.querySelector("#previous-timer").addEventListener("click", () => {
  currentTimerIndex = (currentTimerIndex - 1 + timers.length) % timers.length;
  renderTimers();
});
document.querySelector("#next-timer").addEventListener("click", () => {
  currentTimerIndex = (currentTimerIndex + 1) % timers.length;
  renderTimers();
});
document.querySelector("#delete-timer").addEventListener("click", () => {
  const removed = timers.splice(currentTimerIndex, 1)[0];
  currentTimerIndex = Math.max(0, currentTimerIndex - 1);
  writeStorage(timerStorageKey, timers);
  renderTimers();
  if (removed) showToast(`已删除“${removed.title}”计时表`);
});
renderTimers();

// Today's plan -------------------------------------------------------
const planForm = document.querySelector("#plan-form");
const planInput = document.querySelector("#plan-input");
const planList = document.querySelector("#plan-list");
const planEmpty = document.querySelector("#plan-empty");
const planCompleted = document.querySelector("#plan-completed");
const planTotal = document.querySelector("#plan-total");
const planProgressBar = document.querySelector("#plan-progress-bar");
const todayPlanKey = `mathverse.plans.${dateKey()}`;
let plans = readStorage(todayPlanKey, []);

const planToday = new Date();
const planMonth = String(planToday.getMonth() + 1).padStart(2, "0");
const planDay = String(planToday.getDate()).padStart(2, "0");
const planWeekday = planToday.toLocaleDateString("zh-CN", { weekday: "long" });
document.querySelector("#plan-date").textContent = `${planMonth}月${planDay}日 · ${planWeekday}`;

function savePlans() {
  writeStorage(todayPlanKey, plans);
  renderPlans();
}

function renderPlans() {
  planList.replaceChildren();
  planEmpty.hidden = plans.length > 0;
  planList.hidden = plans.length === 0;

  plans.forEach((plan) => {
    const item = document.createElement("li");
    item.className = `plan-item${plan.done ? " completed" : ""}`;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "plan-toggle";
    toggle.setAttribute("aria-label", plan.done ? "标记为未完成" : "标记为已完成");
    toggle.textContent = "✓";
    toggle.addEventListener("click", () => {
      plan.done = !plan.done;
      savePlans();
    });

    const text = document.createElement("span");
    text.textContent = plan.text;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "plan-delete";
    remove.setAttribute("aria-label", `删除计划：${plan.text}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      plans = plans.filter((candidate) => candidate.id !== plan.id);
      savePlans();
    });

    item.append(toggle, text, remove);
    planList.append(item);
  });

  const completed = plans.filter((plan) => plan.done).length;
  planCompleted.textContent = completed;
  planTotal.textContent = plans.length;
  planProgressBar.style.width = `${plans.length ? completed / plans.length * 100 : 0}%`;
}

planForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = planInput.value.trim();
  if (!text) {
    showToast("先写下一件今天想完成的事");
    return;
  }
  plans.push({ id: window.crypto?.randomUUID?.() || String(Date.now()), text, done: false });
  planInput.value = "";
  savePlans();
});

renderPlans();
