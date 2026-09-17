import { normalizeFeatures } from './featureNormalizer.js'

export const SIMILARITY_MODES = [
  { value: 'comprehensive', label: '综合相似', description: '兼顾知识、策略、结构与难度' },
  { value: 'same_knowledge', label: '同知识点', description: '考点一致，允许更换方法' },
  { value: 'same_method', label: '同方法', description: '重点比较关键操作与转化' },
  { value: 'same_structure', label: '同结构变式', description: '情境变化，题型骨架一致' },
  { value: 'progressive', label: '难度进阶', description: '核心能力一致，难度略高' },
]

const MODE_WEIGHTS = {
  comprehensive: { knowledge: 0.22, method: 0.1, strategy: 0.29, structure: 0.16, semantic: 0.08, difficulty: 0.1, quality: 0.05 },
  same_knowledge: { knowledge: 0.48, method: 0.05, strategy: 0.16, structure: 0.09, semantic: 0.07, difficulty: 0.1, quality: 0.05 },
  same_method: { knowledge: 0.1, method: 0.2, strategy: 0.48, structure: 0.1, semantic: 0.03, difficulty: 0.04, quality: 0.05 },
  same_structure: { knowledge: 0.09, method: 0.08, strategy: 0.2, structure: 0.47, semantic: 0.06, difficulty: 0.05, quality: 0.05 },
  progressive: { knowledge: 0.23, method: 0.07, strategy: 0.29, structure: 0.1, semantic: 0.03, difficulty: 0.23, quality: 0.05 },
}

export function deriveStrategy(item) {
  return normalizeFeatures(item, item.text || item.detail || '').strategy
}

export function extractLocalFeatures(text) {
  const normalizedText = String(text ?? '').trim()
  const base = normalizeFeatures({ text: normalizedText, knowledge: [], methods: [], structure: [] }, normalizedText)
  base.difficulty = Math.min(0.84, 0.5 + base.methods.length * 0.04 + base.structure.length * 0.025)
  base.confidence = Math.min(0.82, 0.38 + (base.knowledge.length + base.methods.length + base.structure.length) * 0.045)
  base.source = '离线规则 · 标准化识别'
  return base
}

function bigrams(value) {
  const text = String(value).replace(/[\s，。；、：,.()[\]（）]/g, '')
  if (text.length < 2) return new Set([text])
  return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)))
}

function termSimilarity(a, b) {
  if (a === b || a.includes(b) || b.includes(a)) return 1
  const left = bigrams(a)
  const right = bigrams(b)
  const union = new Set([...left, ...right])
  return union.size ? [...left].filter((part) => right.has(part)).length / union.size : 0
}

function softOverlap(left = [], right = []) {
  if (!left.length || !right.length) return 0
  const forward = left.reduce((sum, value) => sum + Math.max(...right.map((candidate) => termSimilarity(value, candidate))), 0) / left.length
  const backward = right.reduce((sum, value) => sum + Math.max(...left.map((candidate) => termSimilarity(value, candidate))), 0) / right.length
  return (forward + backward) / 2
}

function strategySimilarity(left = {}, right = {}) {
  const weights = { trigger_conditions: 0.12, goals: 0.22, operations: 0.28, key_transformations: 0.25, constraints: 0.08, branch_points: 0.05 }
  let score = 0
  let usedWeight = 0
  Object.entries(weights).forEach(([field, weight]) => {
    if ((left[field] || []).length && (right[field] || []).length) {
      score += softOverlap(left[field], right[field]) * weight
      usedWeight += weight
    }
  })
  return usedWeight ? score / usedWeight : 0
}

function semanticScore(text, candidate) {
  const vocabulary = [...candidate.knowledge, ...candidate.methods, ...candidate.structure]
  const hits = vocabulary.filter((term) => text.includes(term)).length
  return Math.min(1, 0.2 + hits / Math.max(3, vocabulary.length))
}

function difficultyScore(query, candidate, mode) {
  if (mode === 'progressive') {
    const target = Math.min(0.95, query.difficulty + 0.13)
    const proximity = Math.max(0, 1 - Math.abs(candidate.difficulty - target) / 0.28)
    return proximity * (candidate.difficulty >= query.difficulty ? 1 : 0.45)
  }
  return Math.max(0, 1 - Math.abs(candidate.difficulty - query.difficulty) / 0.42)
}

function eligible(candidate, mode) {
  if (mode === 'same_knowledge') return candidate.metrics.knowledge > 0.12
  if (mode === 'same_method') return candidate.metrics.strategy > 0.22 || (candidate.metrics.method > 0.18 && candidate.metrics.structure > 0.12)
  if (mode === 'same_structure') return candidate.metrics.structure > 0.12
  if (mode === 'progressive') return candidate.metrics.knowledge > 0.12 && candidate.metrics.strategy > 0.08 && candidate.difficulty >= 0.45
  return candidate.score >= 0.25 && (candidate.metrics.knowledge > 0.1 || candidate.metrics.strategy > 0.12 || candidate.metrics.method > 0.15)
}

function buildReason(query, candidate) {
  const queryOperations = [...(query.strategy?.operations || []), ...(query.strategy?.key_transformations || [])]
  const candidateOperations = [...(candidate.strategy?.operations || []), ...(candidate.strategy?.key_transformations || [])]
  const sharedKnowledge = candidate.knowledge.filter((term) => query.knowledge.includes(term)).slice(0, 2)
  const sharedOperations = queryOperations.filter((term) => candidateOperations.some((other) => termSimilarity(term, other) >= 0.42)).slice(0, 2)
  const sharedStructure = candidate.structure.filter((term) => query.structure.includes(term)).slice(0, 2)
  const parts = []
  if (sharedKnowledge.length) parts.push(`知识点：${sharedKnowledge.join('、')}`)
  if (sharedOperations.length) parts.push(`策略操作：${sharedOperations.join('、')}`)
  if (sharedStructure.length) parts.push(`题型结构：${sharedStructure.join('、')}`)
  return parts.length ? parts.join('；') : '存在能力迁移价值，可作为补充训练。'
}

export function rankSimilarProblems(query, corpus, mode = 'comprehensive') {
  const weights = MODE_WEIGHTS[mode] || MODE_WEIGHTS.comprehensive
  const normalizedQuery = normalizeFeatures(query, query.text)
  return corpus
    .map((rawCandidate) => {
      const candidate = normalizeFeatures(rawCandidate, `${rawCandidate.title} ${rawCandidate.detail}`)
      const metrics = {
        knowledge: softOverlap(normalizedQuery.knowledge, candidate.knowledge),
        method: softOverlap(normalizedQuery.methods, candidate.methods),
        strategy: strategySimilarity(normalizedQuery.strategy, candidate.strategy),
        structure: softOverlap(normalizedQuery.structure, candidate.structure),
        semantic: semanticScore(normalizedQuery.text, candidate),
        difficulty: difficultyScore(normalizedQuery, candidate, mode),
        quality: candidate.quality,
      }
      const rawScore = Object.entries(weights).reduce((sum, [field, weight]) => sum + metrics[field] * weight, 0)
      let penalty = 0
      if (metrics.method > 0.18 && metrics.strategy < 0.16) penalty += 0.12
      if (metrics.knowledge > 0.2 && metrics.strategy < 0.08 && metrics.structure < 0.12) penalty += 0.08
      const score = Math.max(0, rawScore - penalty)
      return { ...candidate, metrics, penalty, score, reason: '' }
    })
    .filter((candidate) => eligible(candidate, mode))
    .sort((left, right) => right.score - left.score)
    .map((candidate) => ({ ...candidate, reason: buildReason(normalizedQuery, candidate) }))
}

export function recommendationConfidence(results) {
  const topScore = results[0]?.score ?? 0
  if (topScore >= 0.56) return { label: '高置信推荐', tone: 'high' }
  if (topScore >= 0.4) return { label: '建议人工抽查', tone: 'medium' }
  return { label: '低置信，不自动推送', tone: 'low' }
}
