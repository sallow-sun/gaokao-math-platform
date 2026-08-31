import { ADMIN_LEVEL_OPTIONS, ADMIN_TYPE_OPTIONS } from '../config/admin.js'
import { apiRequest } from './apiClient.js'

function buildQuery(path, query = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value)
  })
  const search = params.toString()
  return search ? `${path}?${search}` : path
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '未知'
    : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(date)
}

function normalizeUser(user) {
  return {
    id: String(user.publicId ?? user.id ?? ''),
    uid: String(user.uid ?? ''),
    username: String(user.username ?? ''),
    email: String(user.email ?? ''),
    role: String(user.role ?? 'USER').toLowerCase(),
    status: String(user.status ?? 'ACTIVE').toLowerCase(),
    joinedAt: formatDate(user.createdAt),
  }
}

function normalizeProblem(problem) {
  return {
    id: String(problem.problemNumber ?? problem.id ?? ''),
    title: String(problem.title ?? ''),
    detail: String(problem.detail ?? ''),
    year: problem.year ?? '',
    region: String(problem.region ?? ''),
    source: String(problem.source ?? ''),
    sourceLabel: String(problem.sourceLabel ?? ''),
    type: String(problem.type ?? ''),
    typeLabel: String(problem.typeLabel ?? ''),
    level: String(problem.level ?? ''),
    tags: Array.isArray(problem.tags) ? problem.tags : [],
    content: String(problem.content ?? ''),
    answer: String(problem.answer ?? ''),
    solution: String(problem.solution ?? ''),
    contentFormat: String(problem.contentFormat ?? 'markdown-latex-v1'),
  }
}

function problemPayload(value) {
  const parsedYear = Number.parseInt(value.year, 10)
  return {
    problemNumber: String(value.id ?? '').trim().toUpperCase(),
    title: String(value.title ?? '').trim(),
    year: Number.isInteger(parsedYear) ? parsedYear : null,
    region: String(value.region ?? '').trim(),
    source: String(value.source ?? '').trim(),
    type: String(value.type ?? '').trim(),
    level: String(value.level ?? '').trim(),
    tags: Array.isArray(value.tags) ? value.tags : [],
    content: String(value.content ?? '').trim(),
    answer: String(value.answer ?? '').trim(),
    solution: String(value.solution ?? '').trim(),
    contentFormat: value.contentFormat || 'markdown-latex-v1',
  }
}

export const adminService = {
  async getSummary() {
    const stats = await apiRequest('/api/v1/admin/stats')
    return {
      users: {
        total: stats.userTotal,
        active: stats.activeUsers,
        banned: stats.bannedUsers,
      },
      problems: { total: stats.problemTotal },
    }
  },

  async getUsers(query = {}) {
    const result = await apiRequest(
      buildQuery('/api/v1/admin/users', {
        keyword: query.keyword,
        page: query.page,
        pageSize: query.pageSize,
      }),
    )
    return { ...result, items: result.items.map(normalizeUser) }
  },

  async getProblemCatalogs() {
    const [tags, sources] = await Promise.all([
      apiRequest('/api/v1/admin/tags'),
      apiRequest('/api/v1/admin/sources'),
    ])
    return {
      levels: ADMIN_LEVEL_OPTIONS.map((option) => ({ ...option })),
      sources: sources
        .filter((source) => source.active)
        .map((source) => ({ label: source.label, value: source.code })),
      tags: tags.filter((tag) => tag.active).map((tag) => tag.name),
      types: ADMIN_TYPE_OPTIONS.map((option) => ({ ...option })),
    }
  },

  async getProblems(query = {}) {
    const result = await apiRequest(
      buildQuery('/api/v1/admin/problems', {
        keyword: query.keyword,
        page: query.page,
        pageSize: query.pageSize,
      }),
    )
    return { ...result, items: result.items.map(normalizeProblem) }
  },

  async getProblem(problemId) {
    return normalizeProblem(
      await apiRequest(`/api/v1/admin/problems/${encodeURIComponent(problemId)}`),
    )
  },

  async updateUserStatus(userId, status) {
    const item = normalizeUser(
      await apiRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/ban`, {
        method: 'PATCH',
        body: { banned: status === 'banned' },
      }),
    )
    return { item, message: status === 'banned' ? '用户已封禁' : '用户已解除封禁' }
  },

  async createProblem(value) {
    const item = normalizeProblem(
      await apiRequest('/api/v1/admin/problems', {
        method: 'POST',
        body: problemPayload(value),
      }),
    )
    return { item, message: `题目 ${item.id} 已写入数据库` }
  },

  async importMarkdown(file) {
    const body = new FormData()
    body.append('file', file)
    return normalizeProblem(
      await apiRequest('/api/v1/admin/problems/import-markdown', { method: 'POST', body }),
    )
  },

  async updateProblem(problemId, value) {
    const item = normalizeProblem(
      await apiRequest(`/api/v1/admin/problems/${encodeURIComponent(problemId)}`, {
        method: 'PUT',
        body: problemPayload(value),
      }),
    )
    return { item, message: `题目 ${item.id} 已保存` }
  },
}
