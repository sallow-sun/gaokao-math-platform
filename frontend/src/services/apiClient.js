const API_PREFIX = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
let csrf = null

export class ApiRequestError extends Error {
  constructor(message, { code = '', status = 0 } = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new ApiRequestError(body?.error?.message || `请求失败（${response.status}）`, {
      code: body?.error?.code,
      status: response.status,
    })
  }

  return body
}

async function getCsrf() {
  if (csrf) return csrf
  const response = await fetch(`${API_PREFIX}/api/v1/auth/csrf`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  csrf = await parseResponse(response)
  return csrf
}

export async function apiRequest(path, { body, method = 'GET', signal } = {}) {
  const headers = { Accept: 'application/json' }
  const normalizedMethod = method.toUpperCase()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  if (!['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) {
    const csrfValue = await getCsrf()
    headers[csrfValue.headerName || 'X-XSRF-TOKEN'] = csrfValue.token
  }

  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${API_PREFIX}${path}`, {
    method: normalizedMethod,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
  })
  return parseResponse(response)
}

export function clearCsrf() {
  csrf = null
}
