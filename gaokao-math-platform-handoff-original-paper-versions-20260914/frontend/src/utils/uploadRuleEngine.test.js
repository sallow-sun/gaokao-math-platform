import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inspectAiTransformation,
  inspectUploadDraft,
  safeUploadCleanup,
  UPLOAD_RULE_VERSION,
} from '../features/ai-upload/uploadRuleEngine.js'

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

test('规则 1.4 检查不依赖模型并拦截结构与目录错误', () => {
  const report = inspectUploadDraft(
    {
      title: '测试题',
      year: 2026,
      type: 'single-choice',
      level: 'green',
      tags: ['模型自造标签'],
      content: '已知 $f(x)=1。\n![图](https://example.com/a.png)\n:::material\n材料',
      answer: '',
      solution: '',
    },
    catalogs,
    { official: true },
  )

  assert.equal(report.version, UPLOAD_RULE_VERSION)
  assert.equal(report.valid, false)
  assert.match(report.errors.map((item) => item.id).join(' '), /content-dollar-pair/)
  assert.match(report.errors.map((item) => item.id).join(' '), /content-unsafe-image/)
  assert.match(report.errors.map((item) => item.id).join(' '), /content-material-pair/)
  assert.match(report.errors.map((item) => item.id).join(' '), /tags-invalid/)
})

test('安全整理只处理换行、行尾空格和过多空行', () => {
  const cleaned = safeUploadCleanup({
    title: '  标题  ',
    content: '设 $x=1$。  \r\n\r\n\r\n\r\n求值。  ',
    answer: '1',
    solution: '',
  })
  assert.equal(cleaned.title, '标题')
  assert.equal(cleaned.content, '设 $x=1$。\n\n\n求值。')
})

test('AI 改动数字或凭空补写答案时不能应用', () => {
  const before = {
    title: '函数题',
    type: 'solution',
    level: 'green',
    tags: ['函数与导数'],
    content: '已知 $f(x)=x^2$，求单调区间。',
    answer: '',
    solution: '',
  }
  const report = inspectAiTransformation(
    before,
    { ...before, content: '已知 $f(x)=x^3$，求单调区间。', answer: '$x>0$' },
    catalogs,
    { official: true },
  )
  assert.equal(report.valid, false)
  assert.match(report.errors.map((item) => item.id).join(' '), /ai-token-change-content/)
  assert.match(report.errors.map((item) => item.id).join(' '), /ai-invented-answer/)
})

