import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderQuestionText } from './renderMathText.js'

test('numbered questions keep continuation lines and roman subparts nested', () => {
  const source = '题干\n（1）求值。\n（2）证明。\n继续论证 $x=1$。\n（i）第一步。\n下一行。\n（ii）第二步。'
  const html = renderQuestionText(source)
  assert.equal((html.match(/class="math-question-item"/g) || []).length, 4)
  assert.ok(html.includes('（2）</span><div class="math-question-body">证明。\n继续论证'))
  assert.ok(html.includes('（i）</span><div class="math-question-body">第一步。\n下一行。'))
  assert.ok(html.endsWith('</div></div></div></div>'))
})
test('formula and material contents are not interpreted as question numbering', () => {
  const source = '$$\\begin{aligned}\n(1)&=1\\\\\n(2)&=2\n\\end{aligned}$$\n:::material\n（1）这是材料编号\n:::'
  assert.ok(!renderQuestionText(source).includes('math-question-item'))
  assert.ok(renderQuestionText(source).includes('math-material'))
  assert.ok(!renderQuestionText('（2）<img src=x onerror=alert(1)>').includes('<img'))
  assert.ok(renderQuestionText('(1) $x^2$', { output: 'mathml' }).includes('<math'))
})
