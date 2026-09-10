<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import 'katex/dist/katex.min.css'
import '../../assets/styles/math-text.css'
import { renderMathText, renderQuestionText } from '../../utils/renderMathText.js'
import { normalizeQuestionSpacing } from '../../utils/questionSpacing.js'

const props = defineProps({
  text: { type: String, default: '' },
  inline: { type: Boolean, default: false },
})

const rendered = computed(() =>
  props.inline
    ? renderMathText(props.text)
    : renderQuestionText(normalizeQuestionSpacing(props.text)),
)
const root = ref(null)
let observer, frame
function measure() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const el = root.value
    if (!el || props.inline || !el.clientWidth) return
    const formulas = [...el.querySelectorAll('.katex')].filter(
      (formula) => !formula.closest('.katex-display'),
    )
    for (const formula of formulas) formula.classList.remove('math-formula-scroll')
    const overflowing = formulas.filter((formula) => {
      const container = formula.closest('.math-question-body') || el
      return formula.getBoundingClientRect().width > container.clientWidth + 1
    })
    for (const formula of overflowing) formula.classList.add('math-formula-scroll')
  })
}
onMounted(() => {
  observer = new ResizeObserver(measure)
  observer.observe(root.value)
  document.fonts?.ready.then(measure)
  measure()
})
watch(rendered, async () => {
  await nextTick()
  measure()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <span v-if="inline" ref="root" class="math-text is-inline" v-html="rendered" />
  <div v-else ref="root" class="math-text" v-html="rendered" />
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

/* Imported choices can form one long inline formula. Scroll only the formula. */
.math-text :deep(.math-formula-scroll) {
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  vertical-align: middle;
  padding: 0.15em 0;
}

@media print {
  .math-text :deep(.math-formula-scroll) {
    display: inline;
    max-width: none;
    overflow: visible;
    padding: 0;
  }
  .math-text :deep(.katex-display) {
    overflow: visible;
  }
}
</style>
