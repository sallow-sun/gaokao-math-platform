import { shallowRef } from 'vue'
import defaults from '../../../backend/src/main/resources/tag-taxonomy.json'
import { apiRequest } from './apiClient.js'

const key = 'mathsea:tag-catalog:v1'
const valid = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (n) =>
      typeof n.name === 'string' &&
      Array.isArray(n.chapters) &&
      (!n.aliases || (Array.isArray(n.aliases) && n.aliases.every((a) => typeof a === 'string'))) &&
      (!n.children || (Array.isArray(n.children) && n.children.length === 0)),
  )
export const tagCatalog = shallowRef(defaults)
try {
  const saved = JSON.parse(localStorage.getItem(key))
  if (valid(saved?.items) && Date.now() - saved.savedAt < 86400000) tagCatalog.value = saved.items
} catch {
  /* The bundled catalog also works with storage disabled. */
}
let pending,
  checkedAt = 0
export function refreshTagCatalog() {
  if (pending) return pending
  if (Date.now() - checkedAt < 60000) return Promise.resolve()
  pending = apiRequest('/api/v1/problems/tag-taxonomy')
    .then((items) => {
      if (!valid(items)) throw new Error('Invalid tag catalog')
      tagCatalog.value = items
      checkedAt = Date.now()
      try {
        localStorage.setItem(key, JSON.stringify({ items, savedAt: checkedAt }))
      } catch {
        /* optional */
      }
    })
    .finally(() => {
      pending = null
    })
  return pending
}
