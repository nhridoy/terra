import { create } from 'zustand'
import api from '../lib/api'

interface SharedVault {
  id: string
  name: string
  teamId: string
  vaultId: string
  createdAt: string
}

interface SharedVaultState {
  sharedVaults: SharedVault[]
  selectedSharedVault: SharedVault | null
  isLoading: boolean
  error: string | null

  fetchSharedVaults: (teamId: string) => Promise<void>
  createSharedVault: (
    teamId: string,
    vaultId: string,
    name?: string,
  ) => Promise<void>
  deleteSharedVault: (teamId: string, vaultId: string) => Promise<void>
  selectSharedVault: (vault: SharedVault | null) => void
  clearError: () => void
}

export const useSharedVaultStore = create<SharedVaultState>((set, get) => ({
  sharedVaults: [],
  selectedSharedVault: null,
  isLoading: false,
  error: null,

  fetchSharedVaults: async (teamId) => {
    set({ isLoading: true, error: null })
    try {
      const vaults = await api.get<SharedVault[]>(
        `/teams/${teamId}/shared-vaults`,
      )
      set({ sharedVaults: vaults, isLoading: false })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  createSharedVault: async (teamId, vaultId, name) => {
    set({ isLoading: true, error: null })
    try {
      const vault = await api.post<SharedVault>(
        `/teams/${teamId}/shared-vaults`,
        {
          vaultId,
          name,
        },
      )
      set({ sharedVaults: [...get().sharedVaults, vault], isLoading: false })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  deleteSharedVault: async (teamId, vaultId) => {
    set({ isLoading: true, error: null })
    try {
      await api.delete(`/teams/${teamId}/shared-vaults/${vaultId}`)
      set({
        sharedVaults: get().sharedVaults.filter((v) => v.id !== vaultId),
        isLoading: false,
      })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  selectSharedVault: (vault) => set({ selectedSharedVault: vault }),
  clearError: () => set({ error: null }),
}))
