import { apiRequest, clearCsrf } from './apiClient.js'

export const authService = {
  me() {
    return apiRequest('/api/v1/auth/me')
  },
  login(account, password) {
    return apiRequest('/api/v1/auth/login', { method: 'POST', body: { account, password } })
  },
  async logout() {
    try {
      return await apiRequest('/api/v1/auth/logout', { method: 'POST' })
    } finally {
      clearCsrf()
    }
  },
  register(value) {
    return apiRequest('/api/v1/auth/register', { method: 'POST', body: value })
  },
}
