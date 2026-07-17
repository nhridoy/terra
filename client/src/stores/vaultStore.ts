import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../lib/device'
import { useAuthStore } from './authStore'

interface VaultItem {
  id: string
  name: string
  description?: string
  isDefault?: boolean
  isSystem?: boolean
  salt?: string
  encryptedData?: string
  iv?: string
  createdAt: string
  updatedAt: string
}

interface VaultDecryptedData {
  hosts?: unknown[]
  keys?: unknown[]
  snippets?: unknown[]
  groups?: unknown[]
  history?: unknown[]
}

interface VaultState {
  vaults: VaultItem[]
  currentVaultId: string | null
  isUnlocked: boolean
  decryptedData: VaultDecryptedData | null
  isLoading: boolean
  error: string | null

  fetchVaults: () => Promise<void>
  createVault: (name: string, description?: string) => Promise<void>
  updateVault: (id: string, vault: Partial<VaultItem>) => Promise<void>
  deleteVault: (id: string) => Promise<void>
  switchVault: (vaultId: string) => Promise<void>
  unlockVault: (password: string) => Promise<void>
  lockVault: () => void
  clearError: () => void
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vaults: [],
  currentVaultId: null,
  isUnlocked: false,
  decryptedData: null,
  isLoading: false,
  error: null,

  fetchVaults: async () => {
    set({ isLoading: true, error: null })
    try {
      const vaults = await invoke<any[]>('list_vaults', { userId: getUserId() })
      set({ vaults, isLoading: false })
      if (vaults.length > 0 && !get().currentVaultId) {
        const personalVault = vaults.find((v: any) => v.name === 'Personal')
        const defaultVault = personalVault || vaults.find((v: any) => v.isDefault) || vaults[0]
        get().switchVault(defaultVault.id)
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createVault: async (name, description) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const vault = await invoke<any>('create_vault', {
        vault: { userId: getUserId(), name, description },
        deviceId,
      })
      set({ vaults: [...get().vaults, vault], isLoading: false })
      get().switchVault(vault.id)
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  updateVault: async (id, vault) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const updated = await invoke<any>('update_vault', {
        id,
        vault: { userId: getUserId(), name: vault.name || '', description: vault.description },
        deviceId,
      })
      set({
        vaults: get().vaults.map((v) => (v.id === id ? updated : v)),
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  deleteVault: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_vault', { id, deviceId })
      const { vaults, currentVaultId } = get()
      const newVaults = vaults.filter((v) => v.id !== id)
      let newCurrentVaultId = currentVaultId

      if (currentVaultId === id) {
        newCurrentVaultId = newVaults[0]?.id || null
      }

      set({
        vaults: newVaults,
        currentVaultId: newCurrentVaultId,
        isLoading: false,
      })

      if (newCurrentVaultId) {
        get().switchVault(newCurrentVaultId)
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  switchVault: async (vaultId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<any>('get_vault_data', { id: vaultId })
      set({
        currentVaultId: vaultId,
        decryptedData: result.encryptedData ? JSON.parse(result.encryptedData) : null,
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  unlockVault: async (_password) => {
    set({ isLoading: true, error: null })
    try {
      set({ isUnlocked: true, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  lockVault: () => set({ isUnlocked: false, decryptedData: null, currentVaultId: null }),

  clearError: () => set({ error: null }),
}))
