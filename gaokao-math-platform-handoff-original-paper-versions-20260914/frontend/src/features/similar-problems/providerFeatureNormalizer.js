import { normalizeFeatures } from './featureNormalizer.js'

function cleanArray(value, limit = 8) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[、，,；;\n]/)
      : value && typeof value === 'object'
        ? [value]
        : []
  return [...new Set(values.map((item) => {
    if (item && typeof item === 'object') return item.label ?? item.name ?? item.value ?? item.title ?? ''
    return String(item ?? '')
  }).map((item) => String(item).trim()).filter(Boolean))].slice(0, limit)
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function normalizeProviderFeaturePayload(payload, fallbackText = '', hasImage = false) {
  const root = Array.isArray(payload) ? asObject(payload[0]) : asObject(payload)
  const nested = asObject(firstValue(root.features, root.result, root.output, root.data))
  const combined = { ...nested, ...root }
  const tagGroups = asObject(firstValue(combined.tags, nested.tags))
  const strategy = asObject(firstValue(
    combined.strategy_signature,
    combined.strategySignature,
    combined.strategy,
    combined['策略特征'],
  ))
  const recognizedText = String(firstValue(
    combined.recognized_text,
    combined.recognizedText,
    combined.question_text,
    combined.problem_text,
    combined.stem,
    combined.text,
    combined['识别题干'],
    combined['题干'],
    '',
  )).trim()
  const sourceText = recognizedText || String(fallbackText || '').trim() || '图片中的数学题'
  const result = {
    text: sourceText,
    recognizedText,
    knowledge: cleanArray(firstValue(
      combined.knowledge_points,
      combined.knowledgePoints,
      combined.knowledge,
      combined.topics,
      tagGroups.knowledge,
      combined['知识点'],
      combined['考点'],
    )),
    methods: cleanArray(firstValue(
      combined.methods,
      combined.solution_methods,
      combined.solutionMethods,
      combined.method,
      tagGroups.methods,
      combined['方法'],
      combined['解题方法'],
    )),
    structure: cleanArray(firstValue(
      combined.structure,
      combined.problem_structure,
      combined.problemStructure,
      combined.problem_type,
      combined.problemType,
      tagGroups.structure,
      combined['题型结构'],
      combined['题型'],
    )),
    difficulty: Math.max(0, Math.min(1, Number(firstValue(combined.difficulty, combined['难度'])) || 0.6)),
    confidence: Math.max(0, Math.min(1, Number(firstValue(combined.confidence, combined['置信度'])) || 0.55)),
    source: hasImage ? '多模态 API · 图片标准化识别' : '外部 API · 标准化识别',
    strategy: {
      trigger_conditions: cleanArray(firstValue(strategy.trigger_conditions, strategy.triggerConditions, strategy.triggers, strategy['触发条件'])),
      goals: cleanArray(firstValue(strategy.goals, strategy.targets, strategy['目标'])),
      operations: cleanArray(firstValue(strategy.operations, strategy.steps, strategy['关键操作'], strategy['步骤'])),
      key_transformations: cleanArray(firstValue(strategy.key_transformations, strategy.keyTransformations, strategy.transformations, strategy['关键转化'])),
      constraints: cleanArray(firstValue(strategy.constraints, strategy.conditions, strategy['限制条件'])),
      branch_points: cleanArray(firstValue(strategy.branch_points, strategy.branchPoints, strategy.branches, strategy['分类点'])),
    },
  }
  const normalized = normalizeFeatures(result, sourceText)
  const providerFeatureCount = result.knowledge.length + result.methods.length + result.structure.length
    + Object.values(result.strategy).flat().length
  const normalizedFeatureCount = normalized.knowledge.length + normalized.methods.length + normalized.structure.length
    + Object.values(normalized.strategy).flat().length
  if (hasImage && !providerFeatureCount && normalizedFeatureCount) {
    normalized.source = '多模态 API 识别 · 本地标准标签映射'
    normalized.confidence = Math.min(normalized.confidence, 0.68)
  }
  return { normalized, providerFeatureCount, normalizedFeatureCount, receivedKeys: Object.keys(combined) }
}
