import katex from 'katex'
import { createBoundedCache } from './boundedCache.js'

const formulaCache = createBoundedCache()

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
  const key = JSON.stringify([source.trim(), displayMode, output])
  const cached = formulaCache.get(key)
  if (cached !== undefined) return cached
  try {
    const rendered = katex.renderToString(source.trim(), {
      displayMode,
      output,
      strict: false,
      throwOnError: false,
      trust: false,
    })
    formulaCache.set(key, rendered)
    return rendered
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

// Recognize question numbering only outside formula/material blocks; source is never rewritten.
export function renderQuestionText(value, options = {}) {
  const source = String(value ?? '').replace(/\r\n?/g, '\n')
  const mask = source.split('')
  for (let i = 0; i < source.length;) {
    const delimiter = DELIMITERS.find(d => source.startsWith(d.open, i) && !isEscaped(source, i))
    const material = (i === 0 || source[i - 1] === '\n') && source.startsWith(':::material', i) && /^:::material[^\n]*\n[\s\S]*?^:::[ \t]*$/m.exec(source.slice(i))
    let end = i
    if (material?.index === 0) end = i + material[0].length
    else if (delimiter) {
      let cursor = i + delimiter.open.length
      while (cursor < source.length && !(source.startsWith(delimiter.close, cursor) && !isEscaped(source, cursor))) cursor++
      if (cursor < source.length) end = cursor + delimiter.close.length
    }
    if (end > i) {
      for (let j = i; j < end; j++) if (mask[j] !== '\n') mask[j] = ' '
      i = end
    } else i++
  }
  const lines = source.split('\n'), visible = mask.join('').split('\n')
  const roots = [], lead = []
  let major = null, current = null
  lines.forEach((line, i) => {
    const number = /^\s*([（(]\s*\d{1,2}\s*[）)])\s*/.exec(visible[i])
    const roman = /^\s*([（(]\s*(?:[ivxlcdm]+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+)\s*[）)])\s*/i.exec(visible[i])
    const marker = number || roman
    if (marker) {
      // The mask can contain spaces in place of an immediately following formula.
      const offset = line.indexOf(marker[1]) + marker[1].length
      const block = { label: marker[1], lines: [line.slice(offset).trimStart()], children: [] }
      if (roman && major) major.children.push(block)
      else { roots.push(block); major = number ? block : null }
      current = block
    } else if (current) current.lines.push(line)
    else lead.push(line)
  })
  if (!roots.length) return renderMathText(source, options)
  const renderBlock = b => `<div class="math-question-item"><span class="math-question-number">${escapeHtml(b.label)}</span><div class="math-question-body">${renderMathText(b.lines.join('\n').trimEnd(), options)}${b.children.map(renderBlock).join('')}</div></div>`
  return renderMathText(lead.join('\n').trimEnd(), options) + roots.map(renderBlock).join('')
}

export function renderMathText(value, { output = 'htmlAndMathml', allowMaterial = true } = {}) {
  const text = String(value ?? '')
  let html = ''
  let plainStart = 0
  let index = 0

  while (index < text.length) {
    // Only platform upload URLs may become images; raw HTML remains escaped.
    if (text.startsWith('![', index) && !isEscaped(text, index)) {
      const asset = /^!\[([^\]\n]*)\]\((\/uploads\/[A-Za-z0-9_./-]+)\)/.exec(text.slice(index))
      if (asset && !asset[2].split('/').includes('..')) {
        html += escapeHtml(text.slice(plainStart, index))
        html += `<img class="math-inline-image" src="${escapeHtml(asset[2])}" alt="${escapeHtml(asset[1])}" loading="lazy" />`
        index += asset[0].length
        plainStart = index
        continue
      }
    }
    // Only recognize complete, standalone material blocks outside formulas.
    if (allowMaterial && (index === 0 || text[index - 1] === '\n')) {
      const opening = /^:::material[ \t]*\r?\n/.exec(text.slice(index))
      if (opening) {
        const materialStart = index + opening[0].length
        const closing = /^:::[ \t]*(?=\r?$)/m.exec(text.slice(materialStart))
        if (closing) {
          html += escapeHtml(text.slice(plainStart, index))
          const material = text.slice(materialStart, materialStart + closing.index)
          html += `<span class="math-material">${renderMathText(material.replace(/\r?\n$/, ''), { output, allowMaterial: false })}</span>`
          index = materialStart + closing.index + closing[0].length
          plainStart = index
          continue
        }
      }
    }

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
      if (text.startsWith(delimiter.close, formulaEnd) && !isEscaped(text, formulaEnd)) {
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
