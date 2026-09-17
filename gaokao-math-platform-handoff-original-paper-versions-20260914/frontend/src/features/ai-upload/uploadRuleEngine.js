export const UPLOAD_RULE_VERSION = '1.4'

const TYPES = new Set(['single-choice', 'multiple-choice', 'fill-blank', 'solution'])
const LEVELS = new Set(['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'])
const SECTIONS = ['content', 'answer', 'solution']

function text(value) {
  return String(value ?? '')
}

function diagnostic(id, severity, field, title, detail) {
  return { id, severity, field, title, detail }
}

function unescapedCount(value, token) {
  let count = 0
  for (let index = 0; index < value.length; index += 1) {
    if (!value.startsWith(token, index)) continue
    let slashes = 0
    for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashes += 1
    if (slashes % 2 === 0) count += 1
    index += token.length - 1
  }
  return count
}

function formulaProblems(value, field) {
  const issues = []
  const withoutDisplay = value.replace(/\$\$[\s\S]*?\$\$/g, '')
  if (unescapedCount(value, '$$') % 2 !== 0 || unescapedCount(withoutDisplay, '$') % 2 !== 0) {
    issues.push(
      diagnostic(
        `${field}-dollar-pair`,
        'error',
        field,
        '公式定界符没有成对出现',
        '请检查 $...$ 或 $$...$$ 的起止符号。',
      ),
    )
  }
  if (unescapedCount(value, '\\(') !== unescapedCount(value, '\\)')) {
    issues.push(
      diagnostic(`${field}-inline-pair`, 'error', field, '行内公式定界符不完整', '请成对使用 \\(...\\)。'),
    )
  }
  if (unescapedCount(value, '\\[') !== unescapedCount(value, '\\]')) {
    issues.push(
      diagnostic(`${field}-display-pair`, 'error', field, '独立公式定界符不完整', '请成对使用 \\[...\\]。'),
    )
  }
  return issues
}

function materialProblems(value, field) {
  const openings = (value.match(/^:::material[ \t]*$/gm) || []).length
  const closings = (value.match(/^:::[ \t]*$/gm) || []).length
  if (openings === closings) return []
  return [
    diagnostic(
      `${field}-material-pair`,
      'error',
      field,
      '材料段标记不完整',
      '每个独立一行的 :::material 都必须有一个独立一行的 ::: 结束标记。',
    ),
  ]
}

function imageProblems(value, field) {
  const issues = []
  const references = [...value.matchAll(/!\[[^\]\n]*]\(([^)\n]+)\)/g)].map((match) => match[1].trim())
  if (references.some((path) => /^(?:https?:|data:|file:|[A-Za-z]:[\\/]|\/)/i.test(path) || path.split(/[\\/]/).includes('..'))) {
    issues.push(
      diagnostic(
        `${field}-unsafe-image`,
        'error',
        field,
        '含规则不允许的图片地址',
        '规则 1.4 不允许外部网址、绝对路径、data 地址或 ../ 路径；请上传本地配图。',
      ),
    )
  }
  return issues
}

function protectedTokens(value) {
  return text(value)
    .match(/\\[A-Za-z]+|\d+(?:\.\d+)?|[=<>≤≥≠±∞]/g)
    ?.sort() || []
}

function sameTokens(before, after) {
  return JSON.stringify(protectedTokens(before)) === JSON.stringify(protectedTokens(after))
}

export function normalizeUploadText(value) {
  return text(value)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

export function safeUploadCleanup(draft) {
  return Object.fromEntries(
    ['title', ...SECTIONS].map((field) => [field, normalizeUploadText(draft?.[field])]),
  )
}

export function inspectUploadDraft(draft = {}, catalogs = {}, { official = false } = {}) {
  const issues = []
  const title = text(draft.title).trim()
  const content = text(draft.content).trim()
  const typeValues = new Set((catalogs.types || []).map((item) => item.value))
  const levelValues = new Set((catalogs.levels || []).map((item) => item.value))
  const tagValues = new Set(catalogs.tags || [])
  const allowedTypes = typeValues.size ? typeValues : TYPES
  const allowedLevels = levelValues.size ? levelValues : LEVELS

  if (!title) issues.push(diagnostic('title-required', 'error', 'title', '缺少题目名称', '名称用于审核队列识别，提交前必须填写。'))
  if (title.length > 255) issues.push(diagnostic('title-length', 'error', 'title', '题目名称超过 255 字', '请缩短名称，不要把完整题干放入名称。'))
  if (!content) issues.push(diagnostic('content-required', 'error', 'content', '缺少题干', '请先粘贴完整题干和选项。'))
  if (content.length > 30000) issues.push(diagnostic('content-length', 'error', 'content', '题干超过 3 万字', '请拆分或删去不属于题干的内容。'))
  if (text(draft.answer).length > 30000) issues.push(diagnostic('answer-length', 'error', 'answer', '答案超过 3 万字', '请精简答案。'))
  if (text(draft.solution).length > 50000) issues.push(diagnostic('solution-length', 'error', 'solution', '解析超过 5 万字', '请精简解析。'))

  if (!allowedTypes.has(draft.type)) issues.push(diagnostic('type-invalid', 'error', 'type', '题型不在标准清单', '只能选择单选题、多选题、填空题或解答题。'))
  if (official && !allowedLevels.has(draft.level)) issues.push(diagnostic('level-required', 'error', 'level', '官方录入必须选择 D1～D7', '难度只能使用规则 1.4 的七级难度。'))
  if (draft.level && !allowedLevels.has(draft.level)) issues.push(diagnostic('level-invalid', 'error', 'level', '难度不在 D1～D7', '请从站内难度选项重新选择。'))

  const tags = Array.isArray(draft.tags) ? draft.tags : []
  const unknownTags = tags.filter((tag) => !tagValues.has(tag))
  if (unknownTags.length) issues.push(diagnostic('tags-invalid', 'error', 'tags', '含非标准 TAG', `已拦截：${unknownTags.join('、')}。只能选用站内标准 TAG。`))
  if (new Set(tags).size !== tags.length) issues.push(diagnostic('tags-duplicate', 'warning', 'tags', 'TAG 有重复项', '相同 TAG 只需保留一次。'))

  const year = draft.year
  if (year !== null && year !== undefined && year !== '') {
    const number = Number(year)
    const valid = Number.isInteger(number) && (official ? number >= 0 && number <= 9999 : number >= 1900 && number <= 2100)
    if (!valid) issues.push(diagnostic('year-invalid', 'error', 'year', '年份不符合当前入口规则', official ? '官方录入使用 0000～9999；未知年份填 0000。' : '用户投稿年份应在 1900～2100，未知可留空。'))
  }

  for (const field of SECTIONS) {
    const value = text(draft[field])
    issues.push(...formulaProblems(value, field), ...materialProblems(value, field), ...imageProblems(value, field))
    if (/<\/?[A-Za-z][^>]*>/.test(value)) issues.push(diagnostic(`${field}-html`, 'error', field, '含不支持的 HTML 标签', '平台不把 HTML 作为题目排版协议，请改用普通文字、公式或材料段。'))
  }

  if (!text(draft.answer).trim()) issues.push(diagnostic('answer-empty', 'warning', 'answer', '尚未填写可靠答案', '规则允许留空，但不要为凑齐字段编造答案。'))
  if (!text(draft.solution).trim()) issues.push(diagnostic('solution-empty', 'warning', 'solution', '尚未填写可靠解析', '规则允许留空，但不要让 AI 凭空补写。'))
  if (['single-choice', 'multiple-choice'].includes(draft.type) && content && !/(^|\n)\s*[A-DＡ-Ｄ][.．、:：)]/m.test(content)) {
    issues.push(diagnostic('choice-options', 'warning', 'content', '没有识别到分行选项', '选择题建议将 A、B、C、D 各选项单独成行，便于移动端排版。'))
  }

  const errors = issues.filter((item) => item.severity === 'error')
  const warnings = issues.filter((item) => item.severity === 'warning')
  const cleanup = safeUploadCleanup(draft)
  const cleanupChanged = Object.entries(cleanup).some(([field, value]) => value !== text(draft[field]))
  return { version: UPLOAD_RULE_VERSION, issues, errors, warnings, cleanup, cleanupChanged, valid: errors.length === 0 }
}

export function inspectAiTransformation(before = {}, after = {}, catalogs = {}, options = {}) {
  const report = inspectUploadDraft(after, catalogs, options)
  const issues = [...report.issues]
  for (const field of SECTIONS) {
    const original = text(before[field]).trim()
    const candidate = text(after[field]).trim()
    if (!original && candidate) {
      issues.push(diagnostic(`ai-invented-${field}`, 'error', field, 'AI 增加了原稿不存在的内容', `原${{ content: '题干', answer: '答案', solution: '解析' }[field]}为空，系统禁止 AI 代写后直接写入。`))
    } else if (original && candidate && !sameTokens(original, candidate)) {
      issues.push(diagnostic(`ai-token-change-${field}`, 'error', field, 'AI 改动了受保护的数学信息', '数字、关系符号或 LaTeX 命令与原稿不一致，系统已阻止直接应用。'))
    }
  }
  const errors = issues.filter((item) => item.severity === 'error')
  return { ...report, issues, errors, warnings: issues.filter((item) => item.severity === 'warning'), valid: errors.length === 0 }
}

export function uploadRuleContract(catalogs = {}, official = false) {
  const types = (catalogs.types || []).map((item) => `${item.value}=${item.label}`).join('；')
  const levels = (catalogs.levels || []).map((item) => `${item.value}=${item.label}`).join('；')
  const tags = (catalogs.tags || []).join('、') || '无可写入标签'
  return [
    `必须遵守 MathSea《题目上传规则》${UPLOAD_RULE_VERSION}。`,
    `题型枚举：${types}。`,
    `难度枚举：${levels}。`,
    `TAG 只能逐字选自：${tags}。`,
    '公式只能使用成对的 $...$、$$...$$、\\(...\\) 或 \\[...\\]。',
    '材料段必须使用独立行 :::material 开始、独立行 ::: 结束。',
    '不得使用 HTML、外部图片网址、绝对路径、data 地址或 ../ 路径。',
    '不得改变题目中的数字、条件、选项、关系符号、LaTeX 命令或数学结论。',
    '原稿没有答案或解析时必须保持为空，不得补做或猜测。',
    official ? '官方录入需要给出 D1～D7 难度和标准 TAG 的证据；最终仍由人工确认。' : '用户投稿允许答案、解析、难度和 TAG 留待审核，不得为了字段完整而编造。',
  ].join('\n')
}
