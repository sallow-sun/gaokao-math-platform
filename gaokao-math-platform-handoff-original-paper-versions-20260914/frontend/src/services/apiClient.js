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
  const response = await fetch(`${API_PREFIX}/api/v1/auth/csrf?_=${Date.now()}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
  })
  csrf = await parseResponse(response)
  return csrf
}

export async function apiRequest(path, { body, method = 'GET', signal } = {}) {
  const normalizedMethod = method.toUpperCase()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const mutates = !['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)
  const requestBody =
    body === undefined ? undefined : isFormData ? body : JSON.stringify(body)

  async function send(allowCsrfRetry) {
    const headers = { Accept: 'application/json' }
    if (mutates) {
      const csrfValue = await getCsrf()
      headers[csrfValue.headerName || 'X-XSRF-TOKEN'] = csrfValue.token
    }

    if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'

    const response = await fetch(`${API_PREFIX}${path}`, {
      method: normalizedMethod,
      credentials: 'include',
      headers,
      body: requestBody,
      signal,
    })

    // A local backend restart invalidates its in-memory session while an already-open
    // page can still hold the previous CSRF token. Refresh once; a genuine permission
    // denial remains a 403 on the second request and is returned normally.
    if (response.status === 403 && mutates && allowCsrfRetry) {
      csrf = null
      return send(false)
    }
    return parseResponse(response)
  }

  return send(true)
}

export function clearCsrf() {
  csrf = null
}
