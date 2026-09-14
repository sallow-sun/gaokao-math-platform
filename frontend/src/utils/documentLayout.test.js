import test from 'node:test'
import assert from 'node:assert/strict'
import {
  newBand,
  splitHorizontal,
  splitVertical,
  moveBoundary,
  removeBoundary,
  numberBands,
  groupBands,
} from './documentLayout.js'
const page = () => ({
  id: 'p',
  edges: [0, 1000],
  columns: [{ bands: [newBand(0, 1000)], suggestions: [] }],
})
test('horizontal drag keeps exact coverage and never crosses neighbouring lines', () => {
  const p = page()
  assert.equal(splitHorizontal(p, 0, 300), true)
  splitHorizontal(p, 0, 700)
  moveBoundary(p, { axis: 'y', column: 0, index: 1 }, 990)
  assert.equal(p.columns[0].bands[0].bottom, 698)
  assert.equal(p.columns[0].bands[1].top, 698)
  assert.equal(p.columns[0].bands.at(-1).bottom, 1000)
})
test('changing column topology invalidates assignments and preserves coverage', () => {
  const p = page()
  p.columns[0].bands[0].question = '9'
  splitVertical(p, 500)
  assert.deepEqual(p.edges, [0, 500, 1000])
  assert.equal(p.columns[1].bands[0].question, '')
  assert.notEqual(p.columns[0].bands[0].id, p.columns[1].bands[0].id)
  removeBoundary(p, { axis: 'x', index: 1 })
  assert.deepEqual(p.edges, [0, 1000])
})
test('skip headers and join continuation regions across pages using explicit question identity', () => {
  const p = page(),
    second = page()
  second.id = 'q'
  splitHorizontal(p, 0, 100)
  p.columns[0].bands[0].skip = true
  const job = { pages: [p, second] }
  numberBands(job, 16)
  assert.equal(p.columns[0].bands[1].question, '16')
  second.columns[0].bands[0].question = '16'
  assert.equal(groupBands(job).length, 1)
  assert.equal(groupBands(job)[0][1].length, 2)
})
