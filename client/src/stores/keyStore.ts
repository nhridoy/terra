import { create } from 'zustand'
import api from '../lib/api'

interface Key {
  id: string
  name: string
  description?: string
  keyType: string
  publicKey: string
  encryptedPrivateKey: string
  fingerprint?: string
  createdAt: string
}

interface KeyState {
  keys: Key[]
  selectedKey: Key | null
  isLoading: boolean
  error: string | null

  fetchKeys: () => Promise<void>
  selectKey: (key: Key | null) => void
  importKey: (key: Partial<Key>) => Promise<void>
  generateKey: (name: string, keyType: string) => Promise<void>
  deleteKey: (id: string) => Promise<void>
  clearError: () => void
}

export const useKeyStore = create<KeyState>((set, get) => ({
  keys: [],
  selectedKey: null,
  isLoading: false,
  error: null,

  fetchKeys: async (vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.listKeys(vaultId)
      set({ keys: result.keys, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectKey: (key) => set({ selectedKey: key }),

  importKey: async (keyData) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.importKey(keyData)
      set({
        keys: [...get().keys, result.key],
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  generateKey: async (name, keyType) => {
    set({ isLoading: true, error: null })
    try {
      // TODO: Implement actual key generation using Web Crypto API
      // For now, simulate key generation
      const mockKey: Partial<Key> = {
        name,
        keyType,
        publicKey: `ssh-${keyType} AAAA模拟公钥`,
        encryptedPrivateKey: '加密私钥占位符',
        fingerprint: 'aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99',
      }

      const result = await api.importKey(mockKey)
      set({
        keys: [...get().keys, result.key],
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteKey: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteKey(id)
      set({
        keys: get().keys.filter((k) => k.id !== id),
        selectedKey: get().selectedKey?.id === id ? null : get().selectedKey,
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
