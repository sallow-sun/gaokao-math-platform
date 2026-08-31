import { apiRequest } from './apiClient.js'

function normalizeItem(item) {
  return {
    problemId: String(item?.problemId ?? '').trim().toUpperCase(),
    note: String(item?.note ?? ''),
    addedAt: item?.addedAt,
    updatedAt: item?.updatedAt,
    problem: item?.problem ?? null,
  }
}

export function normalizeApiPracticeList(value) {
  return {
    id: String(value?.id ?? ''),
    title: String(value?.title ?? '未命名题单'),
    description: String(value?.description ?? ''),
    isDefault: Boolean(value?.isDefault),
    isPublic: value?.isPublic !== false,
    isOfficial: Boolean(value?.isOfficial),
    canEdit: Boolean(value?.canEdit),
    owner: value?.owner ?? null,
    createdAt: value?.createdAt,
    updatedAt: value?.updatedAt,
    problemCount: Number(value?.problemCount) || 0,
    completedCount: Number(value?.completedCount) || 0,
    items: Array.isArray(value?.items) ? value.items.map(normalizeItem) : [],
  }
}

export const practiceListService = {
  async listMine() {
    const lists = await apiRequest('/api/v1/users/me/practice-lists')
    return Array.isArray(lists) ? lists.map(normalizeApiPracticeList) : []
  },
  async listPublic(kind = 'all') {
    const lists = await apiRequest(`/api/v1/practice-lists?kind=${encodeURIComponent(kind)}`)
    return Array.isArray(lists) ? lists.map(normalizeApiPracticeList) : []
  },
  async detail(id, owned = false) {
    const prefix = owned ? '/api/v1/users/me/practice-lists' : '/api/v1/practice-lists'
    return normalizeApiPracticeList(await apiRequest(`${prefix}/${encodeURIComponent(id)}`))
  },
  async create(value) {
    return normalizeApiPracticeList(
      await apiRequest('/api/v1/users/me/practice-lists', {
        method: 'POST',
        body: {
          ...value,
          isPublic: value.isOfficial ? true : value.isPublic !== false,
          isOfficial: Boolean(value.isOfficial),
        },
      }),
    )
  },
  update(id, value) {
    return apiRequest(`/api/v1/users/me/practice-lists/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: value,
    })
  },
  delete(id) {
    return apiRequest(`/api/v1/users/me/practice-lists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
  setDefault(id) {
    return apiRequest(`/api/v1/users/me/practice-lists/${encodeURIComponent(id)}/default`, {
      method: 'PUT',
    })
  },
  addItems(id, problemIds) {
    return apiRequest(`/api/v1/users/me/practice-lists/${encodeURIComponent(id)}/items`, {
      method: 'POST',
      body: { problemIds },
    })
  },
  removeItem(id, problemId) {
    return apiRequest(
      `/api/v1/users/me/practice-lists/${encodeURIComponent(id)}/items/${encodeURIComponent(problemId)}`,
      { method: 'DELETE' },
    )
  },
  removeItems(id, problemIds) {
    return apiRequest(`/api/v1/users/me/practice-lists/${encodeURIComponent(id)}/items/remove`, {
      method: 'POST',
      body: { problemIds },
    })
  },
  reorder(id, problemIds) {
    return apiRequest(`/api/v1/users/me/practice-lists/${encodeURIComponent(id)}/order`, {
      method: 'PUT',
      body: { problemIds },
    })
  },
  updateNote(id, problemId, note) {
    return apiRequest(
      `/api/v1/users/me/practice-lists/${encodeURIComponent(id)}/items/${encodeURIComponent(problemId)}`,
      { method: 'PATCH', body: { note } },
    )
  },
}
