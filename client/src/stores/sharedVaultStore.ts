import { create } from 'zustand'

interface SharedVault {
  id: string
  name: string
  description?: string
  teamId: string
  ownerId: string
  memberCount: number
  isUnlocked: boolean
  createdAt: string
}

interface SharedVaultState {
  sharedVaults: SharedVault[]
  selectedSharedVault: SharedVault | null
  isUnlocked: boolean
  decryptedData: any
  isLoading: boolean
  error: string | null

  fetchSharedVaults: (teamId: string) => Promise<void>
  createSharedVault: (vault: Partial<SharedVault>) => Promise<void>
  updateSharedVault: (id: string, vault: Partial<SharedVault>) => Promise<void>
  deleteSharedVault: (id: string) => Promise<void>
  unlockSharedVault: (password: string) => Promise<void>
  selectSharedVault: (vault: SharedVault | null) => void
  clearError: () => void
}

export const useSharedVaultStore = create<SharedVaultState>((set) => ({
  sharedVaults: [],
  selectedSharedVault: null,
  isUnlocked: false,
  decryptedData: null,
  isLoading: false,
  error: 'Shared vaults feature is not available in sync-only mode',

  fetchSharedVaults: async () => {
    set({ isLoading: false })
  },
  createSharedVault: async () => {
    set({ error: 'Shared vaults feature is not available in sync-only mode' })
  },
  updateSharedVault: async () => {
    set({ error: 'Shared vaults feature is not available in sync-only mode' })
  },
  deleteSharedVault: async () => {
    set({ error: 'Shared vaults feature is not available in sync-only mode' })
  },
  unlockSharedVault: async () => {
    set({ error: 'Shared vaults feature is not available in sync-only mode' })
  },
  selectSharedVault: (vault) => set({ selectedSharedVault: vault }),
  clearError: () => set({ error: null }),
}))
