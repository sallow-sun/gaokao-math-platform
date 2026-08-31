<script setup>
import { computed } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = defineProps({
  text: { type: String, default: '' },
  inline: { type: Boolean, default: false },
})

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderFormula(source, displayMode) {
  try {
    return katex.renderToString(source.trim(), {
      displayMode,
      output: 'htmlAndMathml',
      strict: false,
      throwOnError: false,
      trust: false,
    })
  } catch {
    return escapeHtml(displayMode ? `$$${source}$$` : `$${source}$`)
  }
}

function renderMathText(value) {
  const text = String(value ?? '')
  let html = ''
  let plainStart = 0
  let index = 0

  while (index < text.length) {
    if (text[index] !== '$' || (index > 0 && text[index - 1] === '\\')) {
      index += 1
      continue
    }

    const displayMode = text[index + 1] === '$'
    const delimiter = displayMode ? '$$' : '$'
    const formulaStart = index + delimiter.length
    let formulaEnd = formulaStart

    while (formulaEnd < text.length) {
      if (
        text.startsWith(delimiter, formulaEnd) &&
        (formulaEnd === 0 || text[formulaEnd - 1] !== '\\')
      ) {
        break
      }
      formulaEnd += 1
    }

    if (formulaEnd >= text.length || formulaEnd === formulaStart) {
      index += delimiter.length
      continue
    }

    html += escapeHtml(text.slice(plainStart, index))
    html += renderFormula(text.slice(formulaStart, formulaEnd), displayMode)
    index = formulaEnd + delimiter.length
    plainStart = index
  }

  return html + escapeHtml(text.slice(plainStart))
}

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
