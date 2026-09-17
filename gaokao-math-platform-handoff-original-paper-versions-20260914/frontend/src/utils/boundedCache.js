// Bound by both entry count and approximate string size; never persist rendered content.
export function createBoundedCache(maxEntries = 200, maxSize = 2_000_000) {
  const entries = new Map()
  let size = 0
  return {
    get(key) {
      const value = entries.get(key)
      if (value === undefined) return undefined
      entries.delete(key)
      entries.set(key, value)
      return value
    },
    set(key, value) {
      if (entries.has(key)) {
        size -= key.length + entries.get(key).length
        entries.delete(key)
      }
      if (key.length + value.length > maxSize) return
      entries.set(key, value)
      size += key.length + value.length
      while (entries.size > maxEntries || size > maxSize) {
        const oldest = entries.keys().next().value
        size -= oldest.length + entries.get(oldest).length
        entries.delete(oldest)
      }
    },
  }
}
