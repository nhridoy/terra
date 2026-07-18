const API_BASE = 'http://localhost:8080/api'

class ApiClient {
  private token: string | null = null
  private _refreshToken: string | null = null

  setTokens(token: string, refreshToken: string) {
    this.token = token
    this._refreshToken = refreshToken
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
  }

  getTokens() {
    return {
      token: this.token || localStorage.getItem('token'),
      refreshToken: this._refreshToken || localStorage.getItem('refreshToken'),
    }
  }

  clearTokens() {
    this.token = null
    this._refreshToken = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const { token } = this.getTokens()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()

    if (!response.ok) {
      const err = new Error(data.error || 'Request failed') as Error & { status?: number }
      err.status = response.status
      throw err
    }

    return data
  }

  // Auth
  async register(email: string, username: string, password: string) {
    return this.request<{
      userId: string
      token: string
      refreshToken: string
      expiresAt: string
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    })
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      token: string
      refreshToken: string
      userId: string
      encryptedPrivateKey?: string
      encryptedPersonalKey?: string
      publicKey?: string
      nonce?: string
      salt?: string
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    this.setTokens(data.token, data.refreshToken)
    return data
  }

  async refreshToken(): Promise<{ token: string; refreshToken: string; expiresAt: string }> {
    const { refreshToken } = this.getTokens()
    if (!refreshToken) throw new Error('No refresh token')

    const data = await this.request<{
      token: string
      refreshToken: string
      expiresAt: string
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })

    this.setTokens(data.token, data.refreshToken)
    return data
  }
}

export const api = new ApiClient()
export default api
