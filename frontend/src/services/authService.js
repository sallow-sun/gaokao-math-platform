import { apiRequest, clearCsrf } from './apiClient.js'

export const authService = {
  me() {
    return apiRequest('/api/v1/auth/me')
  },
  login(account, password) {
    return apiRequest('/api/v1/auth/login', { method: 'POST', body: { account, password } })
  },
  async logout() {
    const result = await apiRequest('/api/v1/auth/logout', { method: 'POST' })
    clearCsrf()
    return result
  },
  register(value) {
    return apiRequest('/api/v1/auth/register', { method: 'POST', body: value })
  },
}
