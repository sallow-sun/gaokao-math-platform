import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildUploadAnalysisMessages,
  confidenceLabel,
  normalizeUploadAnalysis,
} from '../features/ai-upload/aiUploadAnalyzer.js'

const catalogs = {
  types: [
    { value: 'single-choice', label: '单选题' },
    { value: 'solution', label: '解答题' },
  ],
  levels: [
    { value: 'red', label: 'D1 · 基础' },
    { value: 'green', label: 'D4 · 中等' },
  ],
  tags: ['函数与导数', '数列'],
}

test('AI 上传结果只保留题库允许的分类值', () => {
  const result = normalizeUploadAnalysis(
    '```json\n{"cleaned_title":"测试题","cleaned_content":"求 $f(x)$。","cleaned_answer":"","cleaned_solution":"","type":"solution","level":"green","tags":["函数与导数","模型自造标签"],"confidence":{"format":88,"type":0.9,"level":0.7,"tags":0.8},"reasons":{},"unmapped_tags":["极值点偏移"],"warnings":[]}\n```',
    catalogs,
    { title: '原题', content: '求$f(x)$。' },
  )

  assert.equal(result.type, 'solution')
  assert.equal(result.level, 'green')
  assert.deepEqual(result.tags, ['函数与导数'])
  assert.equal(result.confidence.format, 0.88)
  assert.deepEqual(result.unmappedTags, ['极值点偏移'])
  assert.match(result.warnings.join(' '), /模型自造标签/)
})

test('未知题型和难度会被拦截，而不是写入表单', () => {
  const result = normalizeUploadAnalysis(
    JSON.stringify({
      cleaned_content: '原题干',
      type: 'essay',
      level: 'D99',
      tags: [],
      confidence: {},
      reasons: {},
      warnings: [],
    }),
    catalogs,
    { title: '', content: '原题干', answer: '', solution: '' },
  )

  assert.equal(result.type, '')
  assert.equal(result.level, '')
  assert.equal(result.content, '原题干')
  assert.equal(result.warnings.length, 2)
})

test('提示词明确禁止补做答案，并包含站内标准清单', () => {
  const messages = buildUploadAnalysisMessages(
    { title: '题目', content: '求值', answer: '', solution: '' },
    catalogs,
    true,
  )

  assert.match(messages[0].content, /不得补做题目/)
  assert.match(messages[0].content, /题目上传规则》1\.4/)
  assert.match(messages[0].content, /不得改变题目中的数字/)
  assert.match(messages[0].content, /函数与导数、数列/)
  assert.match(messages[0].content, /官方录入流程/)
  assert.equal(confidenceLabel(0.86), '高 · 86%')
})
