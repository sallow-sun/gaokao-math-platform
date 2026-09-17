import assert from 'node:assert/strict'
import test from 'node:test'
import { SIMILARITY_DEMO_CORPUS, SIMILARITY_SAMPLES } from './demoCorpus.js'
import { normalizeFeatures } from './featureNormalizer.js'
import { extractLocalFeatures, rankSimilarProblems } from './similarityEngine.js'

test('导数示例在综合模式优先返回相同题型与策略的题目', () => {
  const sample = SIMILARITY_SAMPLES.derivative
  const query = extractLocalFeatures(sample.text, sample)
  const results = rankSimilarProblems(query, SIMILARITY_DEMO_CORPUS, 'comprehensive')
  assert.equal(results[0].id, 'DEMO-D01')
  assert.ok(results[0].metrics.strategy > 0.5)
})

test('圆锥曲线综合推荐不会混入概率题', () => {
  const sample = SIMILARITY_SAMPLES.conic
  const query = extractLocalFeatures(sample.text, sample)
  const results = rankSimilarProblems(query, SIMILARITY_DEMO_CORPUS, 'comprehensive')
  assert.ok(results.length > 0)
  assert.ok(results.slice(0, 4).every((problem) => problem.knowledge.includes('解析几何')))
})

test('自定义无关文本不使用当前示例的预设标签', () => {
  const query = extractLocalFeatures('求等差数列的前 n 项和', SIMILARITY_SAMPLES.derivative)
  assert.equal(query.knowledge.includes('导数'), false)
  assert.equal(query.methods.includes('隐零点'), false)
})

test('API 同义表达标准化后与离线结果保持接近', () => {
  const sample = SIMILARITY_SAMPLES.derivative
  const local = extractLocalFeatures(sample.text)
  const api = normalizeFeatures({
    text: sample.text,
    knowledge: ['微分法', '实根问题'],
    methods: ['利用零点方程代入消去参数', '按照参数临界值分情况'],
    structure: ['带参数的函数', '存在两个实根', '证明乘积不等式'],
    difficulty: 0.72,
    confidence: 0.88,
    strategy: {
      operations: ['将零点关系代入并消去参数', '按临界值分类'],
      key_transformations: ['利用根的方程替换参数'],
      goals: ['证明两个根的乘积上界'],
    },
  }, sample.text)

  const localTop = rankSimilarProblems(local, SIMILARITY_DEMO_CORPUS, 'comprehensive')[0]
  const apiTop = rankSimilarProblems(api, SIMILARITY_DEMO_CORPUS, 'comprehensive')[0]
  assert.equal(localTop.id, 'DEMO-D01')
  assert.equal(apiTop.id, localTop.id)
  assert.ok(Math.abs(apiTop.score - localTop.score) < 0.08)
})
