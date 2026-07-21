import { create } from 'zustand'
import api from '../lib/api'
import { clearTokens, getAccessToken, getRefreshToken } from '../lib/auth'
import { lockMasterPassword } from '../lib/crypto'

interface User {
  id: string
  email: string
  username: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  hasMasterPassword: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setMasterPasswordSet: () => void
  restoreSession: () => Promise<void>
  updateProfile: (data: { username?: string; email?: string }) => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>
  clearError: () => void
}

function parseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('min')) return 'Password must be at least 8 characters'
  if (msg.includes('required')) return 'This field is required'
  if (msg.includes('email')) return 'Please enter a valid email address'
  if (msg.includes('already registered'))
    return 'An account with this email already exists'
  if (msg.includes('invalid credentials')) return 'Invalid email or password'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return 'Cannot connect to server'
  if (msg.includes('Session expired'))
    return 'Session expired, please login again'
  return msg || 'Something went wrong'
}

async function fetchCurrentUser(): Promise<{
  user: User
  hasMasterPassword: boolean
} | null> {
  try {
    const data = await api.get<{
      userId: string
      email: string
      username: string
      hasMasterPassword: boolean
    }>('/auth/me')
    return {
      user: { id: data.userId, email: data.email, username: data.username },
      hasMasterPassword: data.hasMasterPassword,
    }
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  hasMasterPassword: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      await api.login(email, password)
      const me = await fetchCurrentUser()
      if (!me) throw new Error('Failed to fetch user info')
      set({
        user: me.user,
        isAuthenticated: true,
        hasMasterPassword: me.hasMasterPassword,
        isLoading: false,
      })
    } catch (err: unknown) {
      set({ error: parseError(err), isLoading: false })
    }
  },

  register: async (email: string, username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      await api.register(email, username, password)
      const me = await fetchCurrentUser()
      if (!me) throw new Error('Failed to fetch user info')
      set({
        user: me.user,
        isAuthenticated: true,
        hasMasterPassword: me.hasMasterPassword,
        isLoading: false,
      })
    } catch (err: unknown) {
      set({ error: parseError(err), isLoading: false })
    }
  },

  logout: async () => {
    try {
      await api.logout()
    } catch {
      // Ignore errors on logout
    }
    lockMasterPassword()
    await clearTokens()
    set({ user: null, isAuthenticated: false, hasMasterPassword: false })
  },

  setMasterPasswordSet: () => {
    set({ hasMasterPassword: true })
  },

  clearError: () => set({ error: null }),

  updateProfile: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateProfile({
        username: data.username || '',
        email: data.email || '',
      })
      set({
        user: {
          id: result.userId,
          email: result.email,
          username: result.username,
        },
        isLoading: false,
      })
    } catch (err: unknown) {
      set({
        error:
          err instanceof Error
            ? err.message
            : String(err) || 'Failed to update profile',
        isLoading: false,
      })
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ isLoading: true, error: null })
    try {
      await api.changePassword(currentPassword, newPassword)
      set({ isLoading: false })
    } catch (err: unknown) {
      set({
        error:
          err instanceof Error
            ? err.message
            : String(err) || 'Failed to change password',
        isLoading: false,
      })
    }
  },

  restoreSession: async () => {
    const token = await getAccessToken()
    const refreshToken = await getRefreshToken()

    if (!token && !refreshToken) {
      set({ user: null, isAuthenticated: false, hasMasterPassword: false })
      return
    }

    // Try validating the access token
    if (token) {
      const me = await fetchCurrentUser()
      if (me) {
        set({
          user: me.user,
          isAuthenticated: true,
          hasMasterPassword: me.hasMasterPassword,
        })
        return
      }
    }

    // Try refreshing
    if (refreshToken) {
      try {
        await api.refreshToken()
        const me = await fetchCurrentUser()
        if (me) {
          set({
            user: me.user,
            isAuthenticated: true,
            hasMasterPassword: me.hasMasterPassword,
          })
          return
        }
      } catch {
        // Refresh failed
      }
    }

    // Everything failed
    await clearTokens()
    set({ user: null, isAuthenticated: false, hasMasterPassword: false })
  },
}))
