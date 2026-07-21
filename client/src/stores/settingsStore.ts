import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { triggerSync } from '../lib/sync'
import { useAuthStore } from './authStore'

interface Settings {
  id: string
  userId: string
  theme: string
  fontFamily: string
  fontSize: number
  cursorStyle: string
}

interface SettingsState {
  settings: Settings | null
  isLoading: boolean
  error: string | null

  fetchSettings: () => Promise<void>
  updateSettings: (
    data: Partial<Omit<Settings, 'id' | 'userId'>>,
  ) => Promise<void>
  clearError: () => void
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const settings = await invoke<Settings>('get_settings', {
        userId: getUserId(),
      })
      set({ settings, isLoading: false })
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  updateSettings: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const current = get().settings
      if (!current) return

      const updated = await invoke<Settings>('update_settings', {
        settings: {
          ...current,
          ...data,
        },
      })
      set({ settings: updated, isLoading: false })
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  clearError: () => set({ error: null }),
}))
