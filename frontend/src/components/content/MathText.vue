<script setup>
import { computed } from 'vue'
import 'katex/dist/katex.min.css'
import { renderMathText } from '../../utils/renderMathText.js'

const props = defineProps({
  text: { type: String, default: '' },
  inline: { type: Boolean, default: false },
})

const rendered = computed(() => renderMathText(props.text))
</script>

<template>
  <span v-if="inline" class="math-text is-inline" v-html="rendered" />
  <div v-else class="math-text" v-html="rendered" />
</template>

<style scoped>
.math-text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.math-text :deep(.katex-display) {
  margin: 0.65em 0;
  overflow-x: auto;
  overflow-y: hidden;
}

@media print {
  .math-text :deep(.katex-display) {
    overflow: visible;
  }
}
</style>
