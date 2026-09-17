import { CANONICAL_FEATURE_LABELS } from './featureNormalizer.js'
import { normalizeProviderFeaturePayload } from './providerFeatureNormalizer.js'
import { callAi, testAiConnection, validateAiConfig } from '../ai-assistant/aiRelay.js'

export const FEATURE_OUTPUT_SCHEMA = {
  recognized_text: '从图片或文字中识别出的完整题干；没有图片时可原样返回题干',
  knowledge_points: CANONICAL_FEATURE_LABELS.knowledge,
  methods: CANONICAL_FEATURE_LABELS.methods,
  strategy_signature: {
    trigger_conditions: ['触发该解法的条件'],
    goals: ['最终要求证明或求出的对象'],
    operations: ['按顺序排列的关键操作'],
    key_transformations: ['最重要的等价转化或构造'],
    constraints: ['参数、定义域、存在性限制'],
    branch_points: ['需要分类讨论的位置'],
  },
  structure: CANONICAL_FEATURE_LABELS.structure,
  difficulty: 0.65,
  confidence: 0.86,
}

function parseJsonContent(content) {
  const cleaned = String(content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('模型未返回可解析的 JSON')
  }
}

export function validateApiConfig(config) {
  return validateAiConfig(config)
}

export async function testFeatureApi(config) {
  const result = await testAiConnection(config)
  if (!result.content.trim()) throw new Error('模型返回为空')
  return result
}

export async function extractFeaturesWithApi(config, text, image = null) {
  const system = `你是高考数学题检索系统的多模态特征抽取器。只返回一个 JSON 对象，不要 Markdown，不要解题，不要补造题目未给出的结论。\n输出必须符合：${JSON.stringify(FEATURE_OUTPUT_SCHEMA)}\n字段名必须保持为 recognized_text、knowledge_points、methods、strategy_signature、structure、difficulty、confidence，不得翻译或改名。若收到图片，先识别其中印刷或清晰书写的数学题干，将结果写入 recognized_text；区分题干、选项、图形标注与用户作答，不要把手写答案当成题目条件。看不清的内容用 [无法辨认] 标记并降低 confidence。knowledge_points、methods、structure 必须优先从给定数组里的标准标签选择，不要为同一概念创造近义标签。方法名不够，strategy_signature 必须刻画触发条件、目标、按顺序的操作、关键转化、限制条件和分类点。若只有题干而无答案，只提取能从题干可靠判断的策略并降低 confidence。即使无法确定具体方法，也必须至少填写一个可靠的 knowledge_points 或 structure 项；不能把所有检索特征数组都留空。每个数组最多 8 项，使用简短规范中文词组。difficulty 与 confidence 为 0 到 1。`
  const instruction = text
    ? `请解析图片中的数学题。用户补充说明：\n${text}`
    : '请识别并解析图片中的数学题，只提取可靠可见的信息。'
  const userContent = image
    ? [
        { type: 'image_url', image_url: { url: image.dataUrl } },
        { type: 'text', text: instruction },
      ]
    : `请解析这道题：\n${text}`
  const response = await callAi({
    config,
    taskType: 'similarity-feature-extraction',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    maxTokens: 900,
    jsonMode: true,
    lowLatency: true,
  })
  const content = response.content
  const data = parseJsonContent(content)
  let parsed = normalizeProviderFeaturePayload(data, text, Boolean(image))
  if (!parsed.normalizedFeatureCount && image && parsed.normalized.recognizedText) {
    const repairResponse = await callAi({
      config,
      taskType: 'similarity-feature-repair',
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `以下题干已从图片中识别，请不要解题。只补全检索特征 JSON，所有检索特征数组不能同时为空：\n${parsed.normalized.recognizedText}`,
        },
      ],
      maxTokens: 600,
      jsonMode: true,
      lowLatency: true,
    })
    const repairedData = parseJsonContent(repairResponse.content)
    const repaired = normalizeProviderFeaturePayload(repairedData, parsed.normalized.recognizedText, true)
    if (repaired.normalizedFeatureCount) {
      repaired.normalized.recognizedText ||= parsed.normalized.recognizedText
      repaired.normalized.source = '多模态 API · 题干识别与特征校正'
      parsed = repaired
    }
  }
  if (!parsed.normalizedFeatureCount) {
    const keySummary = parsed.receivedKeys.length ? `（收到字段：${parsed.receivedKeys.slice(0, 8).join('、')}）` : ''
    throw new Error(`模型返回了 JSON，但没有识别出可用于检索的数学特征${keySummary}`)
  }
  return parsed.normalized
}
