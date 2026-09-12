import { escapeHtml, renderQuestionText } from './renderMathText.js'
import { normalizeQuestionSpacing } from './questionSpacing.js'
import { stripPracticeListSourceNumber } from '../composables/usePracticeListArrangement.js'

export const PAPER_SIZES = {
  a4: { label: 'A4', width: 210, height: 297 },
  '16k': { label: '16 开', width: 185, height: 260 },
}
export const MM = 96 / 25.4
export const DRAFT_KEY = 'mathsea:paper-draft:v1'
export const PAPER_TYPES = [
  { type: 'single-choice', label: '单项选择题', score: 5 },
  { type: 'multiple-choice', label: '多项选择题', score: 6 },
  { type: 'fill-blank', label: '填空题', score: 5 },
  { type: 'solution', label: '解答题', score: 12 },
  { type: 'other', label: '其他题型', score: 5 },
]
export function paperType(type) {
  return PAPER_TYPES.find((group) => group.type === type) || PAPER_TYPES.at(-1)
}
export function cleanScore(value, fallback = 5) {
  const number = Number(value)
  return value !== null && value !== '' && Number.isFinite(number) && number >= 0 && number <= 100
    ? Math.round(number * 2) / 2
    : fallback
}
export function groupPaperItems(items) {
  return [...items].sort(
    (a, b) =>
      PAPER_TYPES.indexOf(paperType(a.problem.type)) -
      PAPER_TYPES.indexOf(paperType(b.problem.type)),
  )
}
export function paperSections(items) {
  return PAPER_TYPES.map((group) => ({
    ...group,
    entries: items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => paperType(item.problem.type).type === group.type),
  }))
    .filter((group) => group.entries.length)
    .map((group, index) => {
      const scores = group.entries.map(({ item }) => cleanScore(item.score, group.score))
      const total = scores.reduce((sum, score) => sum + score, 0)
      return {
        ...group,
        total,
        heading: `${['一', '二', '三', '四', '五'][index]}、${group.label}（共 ${scores.length} 小题，${scores.every((score) => score === scores[0]) ? `每小题 ${scores[0]} 分，` : ''}共 ${total} 分）`,
      }
    })
}

export function cleanPaperProblem(problem) {
  return {
    id: String(problem.id),
    content: String(problem.content || ''),
    type: String(problem.type || ''),
    typeLabel: String(problem.typeLabel || ''),
    assets: (problem.assets || [])
      .filter(
        (a) => /^\/uploads\/[A-Za-z0-9_./-]+$/.test(a.url) && !a.url.split('/').includes('..'),
      )
      .map((a) => ({ url: a.url, altText: String(a.altText || '题目配图') })),
  }
}

export function paperQuestionHtml(item, index, heading = '') {
  const content = normalizeQuestionSpacing(stripPracticeListSourceNumber(item.problem.content))
  const assets = item.problem.assets.filter((a) => !content.includes(`](${a.url})`))
  const choices = splitPaperChoices(content)
  return (
    (heading ? `<h3 class="paper-section-heading">${escapeHtml(heading)}</h3>` : '') +
    `<div class="paper-question-text math-text"><span class="paper-question-number">${index + 1}．</span>（${cleanScore(item.score, paperType(item.problem.type).score)} 分）${renderQuestionText(choices?.stem ?? content)}</div>` +
    (choices
      ? `<div class="paper-choices math-text">${choices.options.map((option, i) => `<div class="paper-choice"><span class="paper-choice-content">${'ABCD'[i]}．${renderQuestionText(option)}</span></div>`).join('')}</div>`
      : '') +
    assets
      .map(
        (a) =>
          `<img class="paper-asset" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.altText)}" />`,
      )
      .join('') +
    `<div class="paper-answer-space" style="height:${Number(item.space) || 0}mm"></div>`
  )
}

export function splitPaperChoices(content) {
  // Ignore option-like letters inside LaTeX, and require a complete A–D sequence.
  const mask = content.replace(
    /\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g,
    (s) => ' '.repeat(s.length),
  )
  const markers = [...mask.matchAll(/(?:^|[\s　]+)([ABCD])[.．、]/g)]
  if (markers.length !== 4 || markers.map((m) => m[1]).join('') !== 'ABCD') return null
  const starts = markers.map((m) => m.index + m[0].indexOf(m[1]))
  return {
    stem: content.slice(0, starts[0]).trimEnd(),
    options: markers.map((m, i) => {
      const labelStart = m.index + m[0].indexOf(m[1])
      return content.slice(labelStart + 2, starts[i + 1] ?? content.length).trim()
    }),
  }
}

export function restorePaperDraft(raw) {
  const value = JSON.parse(raw || 'null')
  if (!value || value.version !== 1 || !Array.isArray(value.items)) return null
  const seen = new Set()
  const items = value.items
    .filter(
      (i) =>
        i?.problem &&
        typeof i.problem.id === 'string' &&
        typeof i.problem.content === 'string' &&
        !seen.has(i.problem.id) &&
        seen.add(i.problem.id),
    )
    .slice(0, 100)
    .map((i) => ({
      problem: cleanPaperProblem(i.problem),
      space: [0, 20, 40, 60].includes(i.space) ? i.space : 0,
      breakBefore: Boolean(i.breakBefore),
      score: cleanScore(i.score, paperType(i.problem.type).score),
    }))
  return {
    version: 1,
    title: String(value.title || '数学练习卷').slice(0, 100),
    size: PAPER_SIZES[value.size] ? value.size : 'a4',
    items: groupPaperItems(items),
    targetScore:
      Number.isFinite(value.targetScore) && value.targetScore >= 0 && value.targetScore <= 1000
        ? value.targetScore
        : 150,
  }
}

// Merge occupied vertical bands so neither a text line, formula nor image is cut.
export function safePageCut(bands, start, limit, height) {
  const target = Math.min(height, start + limit)
  if (target >= height) return height
  const merged = []
  for (const band of [...bands].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1)
    if (last && band[0] < last[1] + 0.5) last[1] = Math.max(last[1], band[1])
    else merged.push([...band])
  }
  const crossing = merged.find(([top, bottom]) => top < target && bottom > target)
  return crossing ? Math.max(start, crossing[0] - 1) : target
}

export function questionBands(element) {
  const top = element.getBoundingClientRect().top
  const bands = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    if (!node.textContent.trim() || node.parentElement.closest('.katex')) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    for (const rect of range.getClientRects())
      if (rect.height) bands.push([rect.top - top, rect.bottom - top])
  }
  element.querySelectorAll('.katex, img').forEach((el) => {
    if (el.parentElement.closest('.katex')) return
    const rect = el.getBoundingClientRect()
    if (rect.height) bands.push([rect.top - top, rect.bottom - top])
  })
  return bands
}
