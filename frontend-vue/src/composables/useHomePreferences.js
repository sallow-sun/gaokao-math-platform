import { computed, onMounted, ref } from "vue";

const STORAGE_KEYS = {
  theme: "mathverse-home-theme",
  background: "mathverse-home-background",
  lastRandomProblem: "mathverse-home-last-random-problem",
};

function readSetting(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function saveSetting(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function useHomePreferences() {
  const theme = ref("light");
  const backgroundImage = ref("");
  const statusMessage = ref("");

  const isDark = computed(() => theme.value === "dark");
  const hasBackground = computed(() => backgroundImage.value.startsWith("data:image/"));
  const backgroundStyle = computed(() => ({
    "--home-background-image": hasBackground.value
      ? `url("${backgroundImage.value}")`
      : "none",
  }));

  function announce(message) {
    statusMessage.value = message;
  }

  function toggleTheme() {
    theme.value = isDark.value ? "light" : "dark";
    saveSetting(STORAGE_KEYS.theme, theme.value);
    announce(isDark.value ? "夜间模式已开启" : "夜间模式已关闭");
  }

  function applyBackground(file) {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const imageData = typeof reader.result === "string" ? reader.result : "";

      if (!imageData) {
        announce("未能读取所选背景图片");
        return;
      }

      backgroundImage.value = imageData;
      const isSaved = saveSetting(STORAGE_KEYS.background, imageData);
      announce(isSaved ? "背景图片已更换" : "背景图片已应用，但浏览器无法长期保存这张图片");
    });

    reader.addEventListener("error", () => {
      announce("未能读取所选背景图片");
    });

    reader.readAsDataURL(file);
  }

  function pickRandomProblem(problemIds) {
    const validIds = problemIds.map((id) => id.trim()).filter(Boolean);

    if (!validIds.length) {
      return "";
    }

    const lastProblemId = readSetting(STORAGE_KEYS.lastRandomProblem);
    const availableIds = validIds.length > 1
      ? validIds.filter((id) => id !== lastProblemId)
      : validIds;
    const problemId = availableIds[Math.floor(Math.random() * availableIds.length)];

    saveSetting(STORAGE_KEYS.lastRandomProblem, problemId);
    return problemId;
  }

  onMounted(() => {
    theme.value = readSetting(STORAGE_KEYS.theme) === "dark" ? "dark" : "light";

    const savedBackground = readSetting(STORAGE_KEYS.background);
    if (savedBackground.startsWith("data:image/")) {
      backgroundImage.value = savedBackground;
    }
  });

  return {
    theme,
    isDark,
    hasBackground,
    backgroundStyle,
    statusMessage,
    announce,
    toggleTheme,
    applyBackground,
    pickRandomProblem,
  };
}
