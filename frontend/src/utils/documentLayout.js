const id = () => crypto.randomUUID().replaceAll('-', '')
export const newBand = (top, bottom) => ({
  id: id(),
  top,
  bottom,
  question: '',
  section: 'content',
  type: '未知',
  skip: false,
})
export function columnAt(page, x) {
  return page.edges.findIndex((left, i) => left <= x && page.edges[i + 1] > x)
}
export function splitHorizontal(page, column, y) {
  const bands = page.columns[column]?.bands
  const index = bands?.findIndex((b) => y - b.top >= 5 && b.bottom - y >= 5) ?? -1
  if (index < 0) return false
  const band = bands[index],
    end = band.bottom
  band.bottom = y
  bands.splice(index + 1, 0, newBand(y, end))
  return true
}
export function splitVertical(page, x) {
  const index = columnAt(page, x)
  if (
    index < 0 ||
    x - page.edges[index] < 20 ||
    page.edges[index + 1] - x < 20 ||
    page.edges.length >= 9
  )
    return false
  // Both sides must be re-assigned: splitting a column can cut through existing text.
  // Page state can be a Vue Proxy, which structuredClone cannot clone.
  const left = JSON.parse(JSON.stringify(page.columns[index])),
    right = JSON.parse(JSON.stringify(left))
  for (const column of [left, right])
    for (const band of column.bands) Object.assign(band, { id: id(), question: '', skip: false })
  page.edges.splice(index + 1, 0, x)
  page.columns.splice(index, 1, left, right)
  return true
}
export function moveBoundary(page, boundary, value) {
  if (boundary.axis === 'x') {
    const i = boundary.index
    page.edges[i] = Math.max(page.edges[i - 1] + 20, Math.min(page.edges[i + 1] - 20, value))
  } else {
    const bands = page.columns[boundary.column].bands,
      i = boundary.index
    const y = Math.max(bands[i - 1].top + 2, Math.min(bands[i].bottom - 2, value))
    bands[i - 1].bottom = bands[i].top = y
  }
}
export function removeBoundary(page, boundary) {
  if (boundary.axis === 'x') {
    const i = boundary.index
    if (i <= 0 || i >= page.edges.length - 1) return false
    page.edges.splice(i, 1)
    page.columns.splice(i - 1, 2, { bands: [newBand(0, 1000)], suggestions: [] })
  } else {
    const bands = page.columns[boundary.column].bands,
      i = boundary.index
    if (i <= 0 || i >= bands.length) return false
    bands.splice(i - 1, 2, newBand(bands[i - 1].top, bands[i].bottom))
  }
  return true
}
export function allBands(job) {
  return job.pages.flatMap((page, pageIndex) =>
    page.columns.flatMap((col, column) =>
      col.bands.map((band) => ({ band, page, pageIndex, column })),
    ),
  )
}
export function numberBands(job, start = 1, pageId = null) {
  for (const { band, page } of allBands(job)) {
    if (band.skip || (pageId && page.id !== pageId)) continue
    band.question = String(start++)
  }
}
export function groupBands(job) {
  const map = new Map()
  for (const part of allBands(job)) {
    if (part.band.skip || !part.band.question) continue
    if (!map.has(part.band.question)) map.set(part.band.question, [])
    map.get(part.band.question).push(part)
  }
  return [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
}
