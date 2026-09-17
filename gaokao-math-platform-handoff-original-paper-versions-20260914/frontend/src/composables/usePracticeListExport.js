import { writeTextToClipboard } from './useClipboard.js'

function normalizePracticeListTitle(practiceList) {
  return String(practiceList?.title ?? '高考数学题单').trim() || '高考数学题单'
}

function normalizeEntries(entries) {
  return Array.isArray(entries) ? entries : []
}

function createPlainTextProblemBlock(entry, index, includeNotes) {
  const problemId = String(entry?.item?.problemId ?? '').trim()
  const note = String(entry?.item?.note ?? '').trim()
  const problem = entry?.problem
  const title = String(problem?.title ?? '题目数据暂不可用').trim()
  const metadata = [problemId, problem?.typeLabel, problem?.sourceText].filter(Boolean).join(' · ')
  const lines = [`${index + 1}. ${title}`, metadata]

  if (problem?.content) {
    lines.push('', String(problem.content).trim())
  } else {
    lines.push('', `当前无法读取题号 ${problemId || '未知'} 的题目内容。`)
  }

  if (includeNotes && note) {
    lines.push('', `我的备注：${note}`)
  }

  return lines.filter((line, lineIndex) => line || lineIndex > 1).join('\n')
}

export function getPracticeListPlainText(practiceList, entries, { includeNotes = true } = {}) {
  const normalizedEntries = normalizeEntries(entries)
  const title = normalizePracticeListTitle(practiceList)
  const description = String(practiceList?.description ?? '').trim()
  const header = [title, description, `共 ${normalizedEntries.length} 题`].filter(Boolean)
  const problemBlocks = normalizedEntries.map((entry, index) =>
    createPlainTextProblemBlock(entry, index, includeNotes),
  )

  return [
    ...header,
    '',
    ...problemBlocks.flatMap((block, index) => (index ? ['---', block] : [block])),
  ]
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
    .join('\n')
}

export function getPracticeListShareText(entries) {
  return normalizeEntries(entries)
    .map((entry) => String(entry?.item?.problemId ?? '').trim())
    .filter(Boolean)
    .join(',')
}

export function copyPracticeList(practiceList, entries, options) {
  return writeTextToClipboard(getPracticeListPlainText(practiceList, entries, options))
}

export async function sharePracticeList(entries) {
  const text = getPracticeListShareText(entries)
  await writeTextToClipboard(text)
  return { method: 'clipboard' }
}
