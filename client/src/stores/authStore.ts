import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import api from '../lib/api'
import { setUserId } from '../lib/device'

interface User {
  id: string
  email: string
  username: string
  avatarUrl?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  updateProfile: (data: { username?: string; email?: string }) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  clearError: () => void
  restoreSession: () => void
}

function parseError(err: any): string {
  const msg = err?.message || String(err)
  if (msg.includes('min')) return 'Password must be at least 8 characters'
  if (msg.includes('required')) return 'This field is required'
  if (msg.includes('email')) return 'Please enter a valid email address'
  if (msg.includes('already registered'))
    return 'An account with this email already exists'
  if (msg.includes('invalid credentials')) return 'Invalid email or password'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
    return 'Cannot connect to server'
  return msg || 'Something went wrong'
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  } else {
    localStorage.removeItem('user')
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  isAuthenticated: !!loadUser() && !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.login(email, password)
      const user = { id: result.userId, email, username: email.split('@')[0] }
      saveUser(user)
      await setUserId(result.userId)
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (err: any) {
      set({ error: parseError(err), isLoading: false })
    }
  },

  register: async (email: string, username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      await api.register(email, username, password)
      const result = await api.login(email, password)
      const user = { id: result.userId, email, username }
      saveUser(user)
      await setUserId(result.userId)
      await invoke('create_default_vaults', { userId: result.userId })
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (err: any) {
      set({ error: parseError(err), isLoading: false })
    }
  },

  logout: () => {
    api.clearTokens()
    saveUser(null)
    set({ user: null, isAuthenticated: false })
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const { user } = useAuthStore.getState()
      if (user) {
        const updated = { ...user, ...data }
        saveUser(updated)
        set({ user: updated, isLoading: false })
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to update profile', isLoading: false })
    }
  },

  changePassword: async (_currentPassword, _newPassword) => {
    set({ isLoading: true, error: null })
    try {
      // TODO: Implement actual password change via API
      set({ isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to change password', isLoading: false })
    }
  },

  clearError: () => set({ error: null }),

  restoreSession: () => {
    const user = loadUser()
    const { token } = api.getTokens()
    if (user && token) {
      setUserId(user.id).catch(() => {})
      set({ user, isAuthenticated: true })
    } else {
      api.clearTokens()
      saveUser(null)
      set({ user: null, isAuthenticated: false })
    }
  },
}))
