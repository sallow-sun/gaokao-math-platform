import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeProviderFeaturePayload } from '../features/similar-problems/providerFeatureNormalizer.js'

test('相似题特征兼容中文字段、字符串列表与步骤别名', () => {
  const { normalized, normalizedFeatureCount } = normalizeProviderFeaturePayload({
    识别题干: '已知函数 f(x) 有两个零点，讨论参数并证明不等式。',
    知识点: '导数、函数零点',
    解题方法: '隐零点，分类讨论',
    题型: '含参函数',
    策略特征: { 步骤: '求导分析单调性；利用零点关系消元' },
  }, '', true)

  assert.equal(normalized.recognizedText.includes('两个零点'), true)
  assert.deepEqual(normalized.knowledge.slice(0, 2), ['导数', '函数零点'])
  assert.equal(normalized.methods.includes('隐零点'), true)
  assert.equal(normalized.strategy.operations.includes('求导分析单调性'), true)
  assert.equal(normalizedFeatureCount > 0, true)
})

test('多模态模型只返回识别题干时仍可通过标准标签映射继续检索', () => {
  const { normalized, providerFeatureCount, normalizedFeatureCount } = normalizeProviderFeaturePayload({
    recognized_text: '已知函数 f(x)=x-a ln x 有两个零点 x₁、x₂，讨论参数范围。',
    knowledge_points: [],
    methods: [],
    structure: [],
    strategy_signature: {},
  }, '', true)

  assert.equal(providerFeatureCount, 0)
  assert.equal(normalized.knowledge.includes('函数零点'), true)
  assert.equal(normalized.methods.includes('隐零点'), true)
  assert.equal(normalizedFeatureCount > 0, true)
  assert.equal(normalized.source, '多模态 API 识别 · 本地标准标签映射')
})

test('嵌套 features 与驼峰字段会被统一解析', () => {
  const { normalized } = normalizeProviderFeaturePayload({
    features: {
      recognizedText: '直线与椭圆交于 A、B 两点，求弦长。',
      knowledgePoints: [{ label: '解析几何' }, { name: '椭圆' }],
      solutionMethods: ['设而不求', '弦长公式'],
      problemStructure: '直线交曲线、双交点',
      strategySignature: { steps: ['联立方程', '使用弦长公式'] },
    },
  }, '', true)

  assert.equal(normalized.knowledge.includes('解析几何'), true)
  assert.equal(normalized.methods.includes('弦长公式'), true)
  assert.equal(normalized.structure.includes('直线交曲线'), true)
})
