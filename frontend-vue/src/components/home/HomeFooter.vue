<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps({
  aboutRoute: {
    type: [String, Object],
    required: true,
  },
  helpRoute: {
    type: [String, Object],
    required: true,
  },
  isDark: {
    type: Boolean,
    required: true,
  },
  statusMessage: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["background-selected", "toggle-theme"]);
const settingsRoot = ref(null);
const settingsButton = ref(null);
const backgroundInput = ref(null);
const isMenuOpen = ref(false);

function closeMenu(shouldReturnFocus = false) {
  isMenuOpen.value = false;
  if (shouldReturnFocus) {
    settingsButton.value?.focus();
  }
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function openBackgroundPicker() {
  closeMenu();
  backgroundInput.value?.click();
}

function handleBackgroundChange(event) {
  const input = event.target;
  const file = input.files?.[0];

  if (file) {
    emit("background-selected", file);
  }

  input.value = "";
}

function handlePointerDown(event) {
  if (!settingsRoot.value?.contains(event.target)) {
    closeMenu();
  }
}

function handleKeydown(event) {
  if (event.key === "Escape" && isMenuOpen.value) {
    closeMenu(true);
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDown);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <footer class="home-footer">
    <RouterLink class="home-footer-link" :to="aboutRoute">About</RouterLink>

    <div ref="settingsRoot" class="home-settings">
      <button
        ref="settingsButton"
        class="home-footer-link home-settings-toggle"
        type="button"
        :aria-expanded="isMenuOpen"
        aria-controls="home-settings-menu"
        @click="toggleMenu"
      >
        Settings
      </button>

      <div
        v-show="isMenuOpen"
        id="home-settings-menu"
        class="home-settings-menu"
        role="menu"
      >
        <button class="home-settings-item" type="button" role="menuitem" @click="openBackgroundPicker">
          更换背景
        </button>
        <RouterLink class="home-settings-item" :to="helpRoute" role="menuitem" @click="closeMenu()">
          使用帮助
        </RouterLink>
        <button
          class="home-settings-item home-settings-theme"
          type="button"
          role="menuitem"
          :aria-pressed="isDark"
          @click="emit('toggle-theme')"
        >
          夜间模式：{{ isDark ? "开" : "关" }}
        </button>
      </div>
    </div>

    <input
      ref="backgroundInput"
      class="visually-hidden"
      type="file"
      accept="image/*"
      tabindex="-1"
      @change="handleBackgroundChange"
    >
    <p class="visually-hidden" aria-live="polite">{{ statusMessage }}</p>
  </footer>
</template>
