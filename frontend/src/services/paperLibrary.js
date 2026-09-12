import { DRAFT_KEY, restorePaperDraft } from '../utils/paperLayout.js'

export const LIBRARY_KEY = 'mathsea:paper-library:v1'
export function readPapers(storage = localStorage) {
  const raw = storage.getItem(LIBRARY_KEY)
  if (raw) {
    const papers = JSON.parse(raw)
    if (!Array.isArray(papers)) throw new Error('试卷数据无法读取')
    return papers
  }
  const draft = restorePaperDraft(storage.getItem(DRAFT_KEY))
  const papers = draft ? [{ id: crypto.randomUUID(), updatedAt: Date.now(), draft }] : []
  storage.setItem(LIBRARY_KEY, JSON.stringify(papers))
  return papers
}
export function createPaper(
  draft = { version: 1, title: '数学练习卷', items: [], size: 'a4', targetScore: 150 },
) {
  const papers = readPapers()
  const paper = {
    id: crypto.randomUUID(),
    updatedAt: Date.now(),
    draft: restorePaperDraft(JSON.stringify(draft)),
  }
  papers.unshift(paper)
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(papers))
  return paper
}
export function savePaper(id, draft) {
  const papers = readPapers()
  const paper = papers.find((item) => item.id === id && !item.deletedAt)
  if (!paper) throw new Error('试卷不存在或已移入回收站')
  paper.draft = restorePaperDraft(JSON.stringify(draft))
  paper.updatedAt = Date.now()
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(papers))
}
export function recyclePaper(id, restore = false) {
  const papers = readPapers()
  const paper = papers.find((item) => item.id === id)
  if (!paper) return
  paper.deletedAt = restore ? null : Date.now()
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(papers))
}
export function importPapers(raw) {
  const backup = JSON.parse(raw)
  if (backup.version !== 1 || !Array.isArray(backup.papers) || backup.papers.length > 1000)
    throw new Error('Invalid backup')
  const imported = backup.papers.map((paper) => {
    const draft = restorePaperDraft(JSON.stringify(paper.draft))
    if (!draft) throw new Error('Invalid paper')
    return { id: crypto.randomUUID(), draft, updatedAt: Date.now() }
  })
  localStorage.setItem(LIBRARY_KEY, JSON.stringify([...imported, ...readPapers()]))
}
