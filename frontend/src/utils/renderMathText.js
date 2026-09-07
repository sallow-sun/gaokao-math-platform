import katex from 'katex'

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function isEscaped(value, index) {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}

function renderFormula(source, displayMode, output) {
  try {
    return katex.renderToString(source.trim(), {
      displayMode,
      output,
      strict: false,
      throwOnError: false,
      trust: false,
    })
  } catch {
    return escapeHtml(source)
  }
}

const DELIMITERS = [
  { open: '$$', close: '$$', displayMode: true },
  { open: '\\[', close: '\\]', displayMode: true },
  { open: '\\(', close: '\\)', displayMode: false },
  { open: '$', close: '$', displayMode: false },
]

export function renderMathText(value, { output = 'htmlAndMathml' } = {}) {
  const text = String(value ?? '')
  let html = ''
  let plainStart = 0
  let index = 0

  while (index < text.length) {
    const delimiter = DELIMITERS.find(
      ({ open }) => text.startsWith(open, index) && !isEscaped(text, index),
    )

    if (!delimiter) {
      index += 1
      continue
    }

    const formulaStart = index + delimiter.open.length
    let formulaEnd = formulaStart
    while (formulaEnd < text.length) {
      if (
        text.startsWith(delimiter.close, formulaEnd) &&
        !isEscaped(text, formulaEnd)
      ) {
        break
      }
      formulaEnd += 1
    }

    if (formulaEnd >= text.length || formulaEnd === formulaStart) {
      index += delimiter.open.length
      continue
    }

    html += escapeHtml(text.slice(plainStart, index))
    html += renderFormula(text.slice(formulaStart, formulaEnd), delimiter.displayMode, output)
    index = formulaEnd + delimiter.close.length
    plainStart = index
  }

  return html + escapeHtml(text.slice(plainStart))
}
