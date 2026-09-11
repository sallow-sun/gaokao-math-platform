import test from 'node:test'
import assert from 'node:assert/strict'
import {
  paperQuestionHtml,
  restorePaperDraft,
  safePageCut,
  splitPaperChoices,
} from './paperLayout.js'

test('paper preserves math and options, strips only the original leading number', () => {
  const source = '12. 已知 $A.B=1$，求值。\nA. $1$    B. $2$    C. $3$    D. $4$'
  const html = paperQuestionHtml({ problem: { content: source, assets: [] }, space: 20 }, 2)
  assert.ok(html.includes('3．'))
  assert.equal((html.match(/class="paper-choice"/g) || []).length, 4)
  assert.ok(html.includes('katex'))
  assert.ok(!html.includes('12. 已知'))
  assert.equal(splitPaperChoices('已知 $A.B.C.D.$，求值'), null)
  assert.deepEqual(splitPaperChoices(source).options, ['$1$', '$2$', '$3$', '$4$'])
})
test('draft restore excludes answers, duplicate questions and unsafe images', () => {
  const p = {
    id: 'GS000010',
    content: '<script>alert(1)</script>',
    answer: 'private',
    assets: [
      { url: 'https://example.com/x' },
      { url: '/uploads/../x' },
      { url: '/uploads/a.png', altText: 'figure' },
    ],
  }
  const restored = restorePaperDraft(
    JSON.stringify({
      version: 1,
      size: 'invalid',
      items: [{ problem: p, space: 999 }, { problem: p }],
    }),
  )
  assert.equal(restored.items.length, 1)
  assert.equal(restored.size, 'a4')
  assert.equal(restored.items[0].space, 0)
  assert.equal(restored.items[0].problem.answer, undefined)
  assert.deepEqual(
    restored.items[0].problem.assets.map((a) => a.url),
    ['/uploads/a.png'],
  )
  assert.ok(!paperQuestionHtml(restored.items[0], 0).includes('<script>'))
})
test('pagination retreats before a line, tall formula or image and advances through whitespace', () => {
  assert.equal(
    safePageCut(
      [
        [0, 20],
        [25, 90],
      ],
      0,
      50,
      120,
    ),
    24,
  )
  assert.equal(
    safePageCut(
      [
        [0, 20],
        [25, 90],
      ],
      24,
      80,
      120,
    ),
    104,
  )
  assert.equal(safePageCut([[0, 900]], 0, 800, 930), 0)
  assert.equal(safePageCut([[0, 20]], 0, 200, 30), 30)
})
