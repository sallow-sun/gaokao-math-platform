import { uploadRuleContract } from './uploadRuleEngine.js'

const TEXT_FIELDS = ['title', 'content', 'answer', 'solution']

function clip(value, maximum) {
  const text = String(value || '')
  if (text.length <= maximum) return text
  return `${text.slice(0, maximum)}\n[内容过长，后文未发送给模型]`
}

function cleanText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function confidenceValue(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const normalized = number > 1 ? number / 100 : number
  return Math.max(0, Math.min(1, normalized))
}

function extractJson(content) {
  const source = String(content || '').trim()
  const unfenced = source
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(unfenced)
  } catch {
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1))
    throw new Error('模型没有返回可读取的结构化结果，请重新分析')
  }
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => cleanText(item)).filter(Boolean))]
}

export function normalizeUploadAnalysis(content, catalogs, draft = {}) {
  const raw = extractJson(content)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('模型返回的分析格式不正确，请重新分析')
  }

  const typeValues = new Set((catalogs.types || []).map((item) => item.value))
  const levelValues = new Set((catalogs.levels || []).map((item) => item.value))
  const tagValues = new Set(catalogs.tags || [])
  const requestedTags = uniqueStrings(raw.tags)
  const tags = requestedTags.filter((tag) => tagValues.has(tag))
  const rejectedTags = requestedTags.filter((tag) => !tagValues.has(tag))
  const type = typeValues.has(raw.type) ? raw.type : ''
  const level = levelValues.has(raw.level) ? raw.level : ''
  const warnings = uniqueStrings(raw.warnings)

  if (raw.type && !type) warnings.push(`模型返回了未知题型：${raw.type}`)
  if (raw.level && !level) warnings.push(`模型返回了未知难度：${raw.level}`)
  if (rejectedTags.length) warnings.push(`已拦截非标准标签：${rejectedTags.join('、')}`)

  const text = Object.fromEntries(
    TEXT_FIELDS.map((field) => [
      field,
      cleanText(raw[`cleaned_${field}`], cleanText(draft[field])),
    ]),
  )
  const confidence = Object.fromEntries(
    ['format', 'type', 'level', 'tags'].map((field) => [
      field,
      confidenceValue(raw.confidence?.[field]),
    ]),
  )

  return {
    ...text,
    type,
    level,
    tags,
    confidence,
    reasons: {
      type: cleanText(raw.reasons?.type),
      level: cleanText(raw.reasons?.level),
      tags: cleanText(raw.reasons?.tags),
    },
    warnings: [...new Set(warnings)],
    unmappedTags: uniqueStrings(raw.unmapped_tags).filter((tag) => !tagValues.has(tag)),
  }
}

export function buildUploadAnalysisMessages(draft, catalogs, official = false) {
  const userDraft = {
    title: clip(draft.title, 500),
    content: clip(draft.content, 14000),
    answer: clip(draft.answer, 4500),
    solution: clip(draft.solution, 7000),
    current_type: draft.type || '',
    current_level: draft.level || '',
    current_tags: Array.isArray(draft.tags) ? draft.tags : [],
  }

  return [
    {
      role: 'system',
      content: [
        '你是 MathSea 高考数学题库的录入与分类助手，不是解题助手。',
        '任务是清理已有文本、识别题型、估计难度并映射标准标签。',
        '不得补做题目，不得凭空生成答案或解析；原文没有的答案和解析必须保持为空。',
        '不得改变题目的数学含义、条件、数字、选项或结论。不确定时保留原文并写入 warnings。',
        uploadRuleContract(catalogs, official),
        '无法对应的概念写入 unmapped_tags，绝不能自造标签。',
        '难度需要综合运算量、思维跨度、方法隐蔽性和高考学生预期正确率，不要只按题目篇幅判断。',
        official
          ? '这是官方录入流程。题型、难度、标签都必须给出简短依据；证据不足时降低置信度。'
          : '这是用户自愿使用的辅助流程。给出保守建议，不要替用户做最终决定。',
        '只返回一个 JSON 对象，不要使用 Markdown。字段必须完整：',
        '{"cleaned_title":"","cleaned_content":"","cleaned_answer":"","cleaned_solution":"","type":"","level":"","tags":[],"confidence":{"format":0,"type":0,"level":0,"tags":0},"reasons":{"type":"","level":"","tags":""},"unmapped_tags":[],"warnings":[]}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `请分析以下待上传题目。只整理已存在的内容，不要解题：\n${JSON.stringify(userDraft)}`,
    },
  ]
}

export function confidenceLabel(value) {
  if (value === null || value === undefined) return '未提供'
  if (value >= 0.85) return `高 · ${Math.round(value * 100)}%`
  if (value >= 0.65) return `中 · ${Math.round(value * 100)}%`
  return `低 · ${Math.round(value * 100)}%`
}
