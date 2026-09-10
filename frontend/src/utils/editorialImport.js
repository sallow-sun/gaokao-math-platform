export const DIFFICULTY_LEVELS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple']

function normalizePath(value) {
  const parts = []
  for (const part of value.replaceAll('\\', '/').split('/')) {
    if (part === '..') {
      if (!parts.length) return null
      parts.pop()
    } else if (part && part !== '.') parts.push(part)
  }
  return parts.join('/')
}

export function imageReferences(text) {
  const references = []
  for (const match of text.matchAll(/^\s*img\s*[:：]\s*(.*)$/gim)) {
    const value = match[1].trim()
    if (!value || value === '0') continue
    const bracketed = [...value.matchAll(/\{([^}]+)\}/g)].map((item) => item[1].trim())
    references.push(...(bracketed.length ? bracketed : [value]))
  }
  for (const match of text.matchAll(/!\[[^\]\n]*\]\(([^)\n]+)\)/g)) references.push(match[1].trim())
  return [...new Set(references)]
}

// Paths, not basenames, are the association boundary between papers.
export async function prepareImport(files) {
  const entries = []
  const groups = new Map()
  const index = new Map()
  for (const file of files) {
    const path = normalizePath(file.webkitRelativePath || file.name)
    if (!index.has(path)) index.set(path, [])
    index.get(path).push(file)
  }
  for (const file of files) {
    if (!/\.md$/i.test(file.name)) continue
    const path = normalizePath(file.webkitRelativePath || file.name)
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    if (!groups.has(folder))
      groups.set(folder, {
        folder,
        title: folder.split('/').at(-1) || '',
        paperId: '',
        confirmed: false,
      })
    const images = []
    const warnings = []
    let text = ''
    if (file.size > 2 * 1024 * 1024) warnings.push('MD 超过 2MB，无法导入')
    else text = await file.text()
    for (const reference of imageReferences(text)) {
      if (/^(?:[a-z]+:|\/)/i.test(reference)) {
        warnings.push(`请添加本地配图：${reference}`)
        continue
      }
      const imagePath = normalizePath(`${folder ? `${folder}/` : ''}${reference}`)
      const matches = index.get(imagePath) || []
      if (matches.length === 1 && /\.(png|jpe?g|gif|webp)$/i.test(matches[0].name))
        images.push({ reference, file: matches[0] })
      else warnings.push(`图片${matches.length > 1 ? '存在重名' : '缺失'}：${reference}`)
    }
    entries.push({ path, folder, file, images, warnings, result: 'READY', message: '', itemId: '' })
  }
  entries.sort((a, b) => a.path.localeCompare(b.path, 'zh-CN', { numeric: true }))
  return { entries, groups: [...groups.values()] }
}
