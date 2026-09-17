import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQuestionSpacing } from './questionSpacing.js'
import { renderMathText } from './renderMathText.js'
test('screen spacing removes source blank lines without changing formulas, materials or source', () => {
  const source='题干\r\n\r\n（1）$\\frac{1}{2}$\r\n\r\n:::material\r\n材料\r\n:::\r\n\r\n$$\\begin{aligned}a&=1\\\\\r\nb&=2\\end{aligned}$$'
  const normalized=normalizeQuestionSpacing(source)
  assert.ok(source.includes('\r\n\r\n'))
  assert.ok(!normalized.includes('\n\n'))
  assert.ok(normalized.includes('a&=1\\\\\nb&=2'))
  const html=renderMathText(normalized)
  assert.ok(html.includes('math-material'))
  assert.ok(!html.includes('katex-error'))
})
