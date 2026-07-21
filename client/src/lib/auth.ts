import { Store } from '@tauri-apps/plugin-store'

const STORE_NAME = 'termvault-auth'

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load(STORE_NAME)
  }
  return store
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
): Promise<void> {
  const s = await getStore()
  await s.set('accessToken', accessToken)
  await s.set('refreshToken', refreshToken)
  await s.set('tokenExpiresAt', expiresAt)
  await s.save()
}

export async function getAccessToken(): Promise<string | null> {
  const s = await getStore()
  const val = await s.get<string>('accessToken')
  return val ?? null
}

export async function getRefreshToken(): Promise<string | null> {
  const s = await getStore()
  const val = await s.get<string>('refreshToken')
  return val ?? null
}

export async function getTokenExpiry(): Promise<number | null> {
  const s = await getStore()
  const val = await s.get<number>('tokenExpiresAt')
  return val ?? null
}

export async function clearTokens(): Promise<void> {
  const s = await getStore()
  await s.set('accessToken', null)
  await s.set('refreshToken', null)
  await s.set('tokenExpiresAt', null)
  await s.save()
}

export async function isTokenExpired(): Promise<boolean> {
  const expiry = await getTokenExpiry()
  if (!expiry) return true
  return Date.now() / 1000 >= expiry
}

export async function getApiUrl(): Promise<string> {
  const s = await getStore()
  const val = await s.get<string>('apiUrl')
  return val ?? 'http://localhost:8080'
}

export async function setApiUrl(url: string): Promise<void> {
  const s = await getStore()
  await s.set('apiUrl', url)
  await s.save()
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken()
  const apiUrl = await getApiUrl()
  if (!refreshToken) return null

  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      await clearTokens()
      return null
    }

    const data = await response.json()
    await saveTokens(data.token, data.refreshToken, data.expiresAt)
    return data.token
  } catch {
    await clearTokens()
    return null
  }
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  let token = await getAccessToken()

  if (await isTokenExpired()) {
    token = await refreshAccessToken()
  }

  if (!token) {
    throw new Error('Not authenticated')
  }

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
}
