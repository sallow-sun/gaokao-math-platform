import assert from 'node:assert/strict'
import test from 'node:test'
import { renderMathText } from './renderMathText.js'

test('material blocks preserve surrounding questions and render formulas', () => {
  const html = renderMathText('阅读材料：\n:::material\n材料 ABC 123，$x^2$\n:::\n求结果。')
  assert.ok(html.startsWith('阅读材料：\n<span class="math-material">材料 ABC 123，'))
  assert.ok(html.includes('class="katex"'))
  assert.ok(html.endsWith('</span>\n求结果。'))
})

test('material contents remain escaped and cannot inject HTML', () => {
  const html = renderMathText(':::material\n<img src=x onerror=alert(1)>\n:::')
  assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('<img'))
})

test('unclosed or inline markers remain literal', () => {
  for (const text of [':::material\n材料', '正文 :::material\n材料\n:::']) {
    assert.equal(renderMathText(text), text)
  }
})

test('multiple CRLF material blocks work with PDF MathML output', () => {
  const html = renderMathText(':::material\r\n甲 $x$\r\n:::\r\n问题\r\n:::material\r\n乙\r\n:::', {
    output: 'mathml',
  })
  assert.equal((html.match(/class="math-material"/g) ?? []).length, 2)
  assert.ok(html.includes('<math'))
  assert.ok(!html.includes('katex-html'))
})

test('ordinary formulas and escaped text still render without material styling', () => {
  const html = renderMathText('中文 ABC 123 < 456，$\\frac{1}{2}$')
  assert.ok(html.startsWith('中文 ABC 123 &lt; 456，'))
  assert.ok(html.includes('class="katex"'))
  assert.ok(!html.includes('math-material'))
})

test('only safe platform image URLs render; arbitrary HTML and remote URLs do not', () => {
  assert.ok(renderMathText('![图](/uploads/problems/draft-1/image.png)').includes('<img'))
  for (const text of [
    '![](javascript:alert(1))',
    '![](https://other.test/a.png)',
    '![](/uploads/../secret.png)',
  ]) {
    assert.ok(!renderMathText(text).includes('<img'))
  }
})
