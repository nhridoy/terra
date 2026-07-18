import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../lib/device'
import { useAuthStore } from './authStore'
import { triggerSync } from '../lib/sync'

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

  fetchKeys: (vaultId?: string) => Promise<void>
  selectKey: (key: Key | null) => void
  importKey: (key: Partial<Key>) => Promise<void>
  generateKey: (name: string, keyType: string) => Promise<void>
  deleteKey: (id: string) => Promise<void>
  clearError: () => void
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

export const useKeyStore = create<KeyState>((set, get) => ({
  keys: [],
  selectedKey: null,
  isLoading: false,
  error: null,

  fetchKeys: async (vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const keys = await invoke<Key[]>('list_keys', { userId: getUserId(), vaultId: vaultId || null })
      set({ keys, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectKey: (key) => set({ selectedKey: key }),

  importKey: async (keyData) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const result = await invoke<Key>('create_key', {
        key: {
          userId: getUserId(),
          name: keyData.name || '',
          description: keyData.description,
          keyType: keyData.keyType || 'ed25519',
          publicKey: keyData.publicKey || '',
          encryptedPrivateKey: keyData.encryptedPrivateKey,
          fingerprint: keyData.fingerprint,
        },
        deviceId,
      })
      set({
        keys: [...get().keys, result],
        isLoading: false,
      })
      triggerSync()
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  generateKey: async (name, keyType) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const mockKey = {
        userId: getUserId(),
        name,
        keyType,
        publicKey: `ssh-${keyType} AAAA模拟公钥`,
        encryptedPrivateKey: '加密私钥占位符',
        fingerprint: 'aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99',
      }
      const result = await invoke<Key>('create_key', { key: mockKey, deviceId })
      set({
        keys: [...get().keys, result],
        isLoading: false,
      })
      triggerSync()
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteKey: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_key', { id, deviceId })
      set({
        keys: get().keys.filter((k) => k.id !== id),
        selectedKey: get().selectedKey?.id === id ? null : get().selectedKey,
        isLoading: false,
      })
      triggerSync()
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
