import test from 'node:test'
import assert from 'node:assert/strict'
import { createBoundedCache } from './boundedCache.js'
import { renderMathText } from './renderMathText.js'

test('render cache evicts oldest unused entries and respects its size limit', () => {
  const cache = createBoundedCache(2, 12)
  cache.set('a', '111')
  cache.set('b', '222')
  assert.equal(cache.get('a'), '111')
  cache.set('c', '333')
  assert.equal(cache.get('b'), undefined)
  cache.set('huge', '123456789012345')
  assert.equal(cache.get('huge'), undefined)
  cache.set('a', '123456789')
  assert.equal(cache.get('c'), undefined)
  assert.equal(cache.get('a'), '123456789')
})
test('formula caching preserves MathML export and inline versus display rendering', () => {
  const inline = renderMathText('$x^2$')
  assert.equal(renderMathText('$x^2$'), inline)
  assert.ok(renderMathText('$$x^2$$').includes('katex-display'))
  assert.ok(!inline.includes('katex-display'))
  const mathml = renderMathText('$x^2$', { output: 'mathml' })
  assert.ok(mathml.includes('<math'))
  assert.ok(!mathml.includes('katex-html'))
})
