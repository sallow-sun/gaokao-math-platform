import { apiRequest } from './apiClient.js'
let catalogPromise
export function getCurriculumCatalog(refresh = false) {
  if (!catalogPromise || refresh) {
    catalogPromise = apiRequest('/api/v1/curriculum').catch((error) => {
      catalogPromise = null
      throw error
    })
  }
  return catalogPromise
}
export const updateCurriculumPreset = (id, body) =>
  apiRequest(`/api/v1/admin/curriculum/presets/${encodeURIComponent(id)}`, { method: 'PUT', body })
