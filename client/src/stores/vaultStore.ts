import { create } from 'zustand'
import api from '../lib/api'

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
      const result = await api.listVaults()
      const vaults = result.vaults || []
      set({ vaults, isLoading: false })
      
      // Auto-select default vault if none selected
      if (vaults.length > 0 && !get().currentVaultId) {
        const defaultVault = vaults.find(v => v.isDefault) || vaults[0]
        get().switchVault(defaultVault.id)
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createVault: async (name, description) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.createVault({ name, description })
      const vault = result.vault
      set({ vaults: [...get().vaults, vault], isLoading: false })

      // Switch to new vault
      get().switchVault(vault.id)
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  updateVault: async (id, vault) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateVault(id, vault)
      set({
        vaults: get().vaults.map((v) => (v.id === id ? result.vault : v)),
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  deleteVault: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteVault(id)
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
      // Fetch vault-specific data
      const result = await api.getVaultData(vaultId)
      set({
        currentVaultId: vaultId,
        decryptedData: result.data,
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  unlockVault: async (password) => {
    set({ isLoading: true, error: null })
    try {
      const { currentVaultId } = get()
      if (!currentVaultId) throw new Error('No vault selected')
      
      await api.unlockVault(currentVaultId, password)
      set({ isUnlocked: true, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  lockVault: () => set({ isUnlocked: false, decryptedData: null, currentVaultId: null }),

  clearError: () => set({ error: null }),
}))