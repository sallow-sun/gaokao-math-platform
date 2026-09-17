import test from 'node:test'
import assert from 'node:assert/strict'
import {
  readPapers,
  createPaper,
  savePaper,
  recyclePaper,
  importPapers,
  LIBRARY_KEY,
} from '../services/paperLibrary.js'
import { DRAFT_KEY } from './paperLayout.js'
test('paper library migrates once, isolates papers, restores and imports atomically', () => {
  const data = new Map()
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, title: '旧草稿', items: [] }))
  const migrated = readPapers()
  assert.equal(migrated[0].draft.title, '旧草稿')
  assert.equal(readPapers().length, 1)
  const second = createPaper()
  savePaper(second.id, { ...second.draft, title: '独立试卷' })
  assert.equal(readPapers().find((p) => p.id === migrated[0].id).draft.title, '旧草稿')
  recyclePaper(second.id)
  assert.throws(() => savePaper(second.id, second.draft))
  recyclePaper(second.id, true)
  assert.equal(readPapers().find((p) => p.id === second.id).deletedAt, null)
  const before = localStorage.getItem(LIBRARY_KEY)
  assert.throws(() =>
    importPapers(JSON.stringify({ version: 1, papers: [{ draft: second.draft }, { draft: {} }] })),
  )
  assert.equal(localStorage.getItem(LIBRARY_KEY), before)
  importPapers(JSON.stringify({ version: 1, papers: readPapers() }))
  assert.equal(new Set(readPapers().map((p) => p.id)).size, 4)
  delete globalThis.localStorage
})
