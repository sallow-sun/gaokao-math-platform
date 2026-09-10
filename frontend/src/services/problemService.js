import { PROBLEMS_PROTOTYPE_ITEMS } from '../config/problems.js'

const API_PREFIX = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const problemCache = new Map()

function findPrototypeProblem(problemNumber) {
  const normalizedId = String(problemNumber ?? '')
    .trim()
    .toUpperCase()
  return (
    PROBLEMS_PROTOTYPE_ITEMS.find(
      (problem) =>
        String(problem.id ?? '')
          .trim()
          .toUpperCase() === normalizedId,
    ) ?? null
  )
}

export class ApiError extends Error {
  constructor(message, { code = '', status = 0 } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function readResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new ApiError(body?.error?.message || `请求失败（${response.status}）`, {
      code: body?.error?.code,
      status: response.status,
    })
  }

  return body
}

function appendQueryValue(params, name, value) {
  const values = Array.isArray(value) ? value : [value]
  values
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .forEach((item) => params.append(name, item))
}

export function normalizeApiProblem(problem) {
  const normalized = {
    ...problem,
    id: String(problem?.id ?? '')
      .trim()
      .toUpperCase(),
    year: problem?.year == null ? '' : String(problem.year),
    tags: Array.isArray(problem?.tags) ? problem.tags : [],
    assets: Array.isArray(problem?.assets) ? problem.assets : [],
    stats: {
      views: problem?.stats?.views ?? 0,
      passes: problem?.stats?.passes ?? 0,
      downloads: problem?.stats?.downloads ?? 0,
      favorites: problem?.stats?.favorites ?? 0,
    },
    uploader:
      typeof problem?.uploader === 'object' && problem.uploader !== null
        ? problem.uploader.username || problem.uploader.uid || '用户投稿'
        : problem?.uploader,
  }

  if (normalized.id) {
    problemCache.set(normalized.id, normalized)
  }

  return normalized
}

export async function listProblems(query = {}, { signal } = {}) {
  const params = new URLSearchParams()
  appendQueryValue(params, 'learning', query.learning ? 'true' : '')
  appendQueryValue(params, 'learned', query.learned)
  appendQueryValue(params, 'chapter', query.chapters)
  appendQueryValue(params, 'keyword', query.keyword)
  appendQueryValue(params, 'year', query.years)
  appendQueryValue(params, 'source', query.sources)
  appendQueryValue(params, 'type', query.types)
  appendQueryValue(params, 'level', query.levels)
  appendQueryValue(params, 'tag', query.tags)
  appendQueryValue(params, 'sort', query.sort)
  appendQueryValue(params, 'page', query.page ?? 1)
  appendQueryValue(params, 'pageSize', query.pageSize ?? 20)

  const response = await fetch(`${API_PREFIX}/api/v1/problems?${params}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  })
  const data = await readResponse(response)

  return {
    items: Array.isArray(data?.items) ? data.items.map(normalizeApiProblem) : [],
    pagination: data?.pagination ?? { page: 1, pageSize: 20, total: 0, hasNext: false },
  }
}

export async function getProblem(problemNumber, { force = false, signal } = {}) {
  const normalizedId = String(problemNumber ?? '')
    .trim()
    .toUpperCase()

  if (!normalizedId) {
    throw new ApiError('题目编号不能为空', { status: 400 })
  }

  if (!force && problemCache.has(normalizedId)) {
    const cached = problemCache.get(normalizedId)

    // 列表接口不返回答案与解析；详情页需要继续请求完整数据。
    if (Object.hasOwn(cached, 'answer') || Object.hasOwn(cached, 'solution')) {
      return cached
    }
  }

  try {
    const response = await fetch(
      `${API_PREFIX}/api/v1/problems/${encodeURIComponent(normalizedId)}`,
      {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal,
      },
    )
    return normalizeApiProblem(await readResponse(response))
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }

    const prototypeProblem = findPrototypeProblem(normalizedId)
    if (prototypeProblem) {
      return normalizeApiProblem(prototypeProblem)
    }

    throw error
  }
}

export function getCachedProblem(problemNumber) {
  const normalizedId = String(problemNumber ?? '')
    .trim()
    .toUpperCase()
  return problemCache.get(normalizedId) ?? findPrototypeProblem(normalizedId)
}
