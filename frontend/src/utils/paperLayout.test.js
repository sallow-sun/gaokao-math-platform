import test from 'node:test'
import assert from 'node:assert/strict'
import {
  paperQuestionHtml,
  restorePaperDraft,
  safePageCut,
  splitPaperChoices,
  cleanScore,
  paperSections,
} from './paperLayout.js'

test('legacy drafts acquire scores and stable type sections, with accurate mixed totals', () => {
  const draft = restorePaperDraft(
    JSON.stringify({
      version: 1,
      items: [
        { problem: { id: 's1', type: 'solution', content: '解答' }, score: 13 },
        { problem: { id: 'c1', type: 'single-choice', content: '单选' } },
        { problem: { id: 's2', type: 'solution', content: '解答' }, score: 12.5 },
      ],
    }),
  )
  assert.deepEqual(
    draft.items.map((item) => item.problem.id),
    ['c1', 's1', 's2'],
  )
  assert.equal(draft.items[0].score, 5)
  assert.equal(draft.targetScore, 150)
  const groups = paperSections(draft.items)
  assert.equal(groups.length, 2)
  assert.equal(groups[1].total, 25.5)
  assert.ok(groups[1].heading.startsWith('二、解答题'))
  assert.ok(!groups[1].heading.includes('每小题'))
  assert.ok(paperQuestionHtml(draft.items[1], 1, groups[1].heading).includes('（13 分）'))
  assert.equal(cleanScore(-2, 12), 12)
  assert.equal(cleanScore(101, 12), 12)
  assert.equal(cleanScore(0, 12), 0)
  assert.equal(cleanScore('7.5'), 7.5)
  assert.equal(cleanScore('<script>', 5), 5)
})

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
