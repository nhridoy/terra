import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { getDeviceId } from '../lib/device'
import { triggerSync } from '../lib/sync'
import {
  decryptKeyCredentials,
  encryptKeyCredentials,
} from '../lib/vaultCrypto'
import { useAuthStore } from './authStore'

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
  getCredentialsForKey: (keyId: string) => Promise<string>
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
      const keys = await invoke<Key[]>('list_keys', {
        userId: getUserId(),
        vaultId: vaultId || null,
      })
      set({ keys, isLoading: false })
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  selectKey: (key) => set({ selectedKey: key }),

  importKey: async (keyData) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const encrypted = await encryptKeyCredentials({
        userId: getUserId(),
        name: keyData.name || '',
        description: keyData.description,
        keyType: keyData.keyType || 'ed25519',
        publicKey: keyData.publicKey || '',
        encryptedPrivateKey: keyData.encryptedPrivateKey,
        fingerprint: keyData.fingerprint,
      })
      const result = await invoke<Key>('create_key', {
        key: encrypted,
        deviceId,
      })
      set({
        keys: [...get().keys, result],
        isLoading: false,
      })
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  generateKey: async (name, keyType) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      let keyResult: {
        publicKey: string
        privateKey: string
        fingerprint: string
      }

      if (keyType === 'rsa') {
        keyResult = await invoke<{
          publicKey: string
          privateKey: string
          fingerprint: string
        }>('generate_rsa_keypair')
      } else {
        keyResult = await invoke<{
          publicKey: string
          privateKey: string
          fingerprint: string
        }>('generate_ed25519_keypair')
      }

      const encrypted = await encryptKeyCredentials({
        userId: getUserId(),
        name,
        keyType,
        publicKey: keyResult.publicKey,
        encryptedPrivateKey: keyResult.privateKey,
        fingerprint: keyResult.fingerprint,
      })
      const result = await invoke<Key>('create_key', {
        key: encrypted,
        deviceId,
      })
      set({
        keys: [...get().keys, result],
        isLoading: false,
      })
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
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
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  getCredentialsForKey: async (keyId) => {
    try {
      const key = get().keys.find((k) => k.id === keyId)
      if (!key) return ''
      const decrypted = await decryptKeyCredentials({
        encryptedPrivateKey: key.encryptedPrivateKey,
      })
      return decrypted.encryptedPrivateKey || ''
    } catch {
      return ''
    }
  },

  clearError: () => set({ error: null }),
}))
