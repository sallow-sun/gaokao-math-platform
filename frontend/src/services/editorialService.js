import { apiRequest } from './apiClient.js'

const root = '/api/v1/admin/editorial'
export const editorialService = {
  remove: (path) => apiRequest(`${root}${path}`, { method: 'DELETE' }),
  get: (path) => apiRequest(`${root}${path}`),
  post: (path, body = {}) => apiRequest(`${root}${path}`, { method: 'POST', body }),
  put: (path, body) => apiRequest(`${root}${path}`, { method: 'PUT', body }),
  async importFile(batchId, paperId, entry) {
    const body = new FormData()
    body.append('batchId', batchId)
    body.append('paperId', paperId)
    body.append('path', entry.path)
    body.append('file', entry.file)
    for (const image of entry.images) body.append('images', image.file, image.reference)
    return apiRequest(`${root}/import`, { method: 'POST', body })
  },
  async upload(item, file, section) {
    const body = new FormData()
    body.append('version', item.version)
    body.append('section', section)
    body.append('file', file)
    return apiRequest(`${root}/items/${item.id}/assets`, { method: 'POST', body })
  },
}
