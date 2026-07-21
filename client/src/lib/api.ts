import {
  clearTokens,
  getAccessToken,
  getApiUrl,
  getRefreshToken,
  isTokenExpired,
  refreshAccessToken,
  saveTokens,
} from './auth'

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    let token = await getAccessToken()

    if (await isTokenExpired()) {
      token = await refreshAccessToken()
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    const baseUrl = await getApiUrl()
    const response = await fetch(`${baseUrl}/api/v1${endpoint}`, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        const retryHeaders: HeadersInit = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        }
        const retryResponse = await fetch(`${baseUrl}/api/v1${endpoint}`, {
          ...options,
          headers: retryHeaders,
        })
        const retryData = await retryResponse.json()
        if (!retryResponse.ok) {
          const err = new Error(
            retryData.error || 'Request failed',
          ) as Error & { status?: number }
          err.status = retryResponse.status
          throw err
        }
        return retryData
      }
      await clearTokens()
      throw new Error('Session expired')
    }

    const data = await response.json()

    if (!response.ok) {
      const err = new Error(data.error || 'Request failed') as Error & {
        status?: number
      }
      err.status = response.status
      throw err
    }

    return data
  }

  async register(email: string, username: string, password: string) {
    const data = await this.request<{
      userId: string
      token: string
      refreshToken: string
      expiresAt: number
      hasMasterPassword: boolean
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    })

    await saveTokens(data.token, data.refreshToken, data.expiresAt)
    return data
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      token: string
      refreshToken: string
      expiresAt: number
      userId: string
      username: string
      hasMasterPassword: boolean
      encryptedPrivateKey?: string
      encryptedPersonalKey?: string
      publicKey?: string
      nonce?: string
      salt?: string
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    await saveTokens(data.token, data.refreshToken, data.expiresAt)
    return data
  }

  async refreshToken() {
    const refreshToken = await getRefreshToken()
    if (!refreshToken) throw new Error('No refresh token')

    const data = await this.request<{
      token: string
      refreshToken: string
      expiresAt: number
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })

    await saveTokens(data.token, data.refreshToken, data.expiresAt)
    return data
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' })
    } catch {
      // Ignore errors on logout
    }
    await clearTokens()
  }

  async setMasterPassword(ciphertext: string, nonce: string) {
    return this.request<{ message: string }>('/auth/master-password', {
      method: 'POST',
      body: JSON.stringify({ ciphertext, nonce }),
    })
  }

  async getMasterPassword() {
    return this.request<{ ciphertext: string; nonce: string }>(
      '/auth/master-password',
    )
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  async updateProfile(data: { username: string; email: string }) {
    return this.request<{
      userId: string
      username: string
      email: string
    }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint)
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiClient()
export default api
