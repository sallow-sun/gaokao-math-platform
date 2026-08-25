<script setup>
import { ref } from "vue";

const emit = defineEmits(["switch"]);
const checked = ref(false);

function handleChange() {
  if (!checked.value) {
    return;
  }

  emit("switch", () => {
    checked.value = false;
  });
}
</script>

<template>
  <header class="home-mode-header">
    <label class="home-mode-control">
      <span class="home-mode-label">极简</span>
      <input
        v-model="checked"
        class="home-mode-input"
        type="checkbox"
        role="switch"
        aria-label="切换至普通版主页"
        @change="handleChange"
      >
      <span class="home-mode-switch" aria-hidden="true"></span>
    </label>
  </header>
</template>
