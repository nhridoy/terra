import { create } from 'zustand'
import {
  base64ToBuffer,
  bufferToBase64,
  bufferToString,
  decryptSecret,
  deriveKey,
  encryptSecret,
  generateNonce,
  generateSalt,
  initSodium,
  stringToBuffer,
} from '../../../shared/utils/encryption'
import api from '../lib/api'

interface SharedVaultMember {
  userId: string
  username: string
  email: string
  role: 'owner' | 'admin' | 'member'
  encryptedKey: string // Encrypted with user's public key
  addedAt: string
}

interface SharedVault {
  id: string
  name: string
  description?: string
  teamId: string
  ownerId: string
  encryptedData: string
  iv: string
  salt: string
  members: SharedVaultMember[]
  createdAt: string
  updatedAt: string
}

interface SharedVaultState {
  sharedVaults: SharedVault[]
  selectedSharedVault: SharedVault | null
  isUnlocked: boolean
  decryptedData: any
  isLoading: boolean
  error: string | null

  fetchSharedVaults: (teamId: string) => Promise<void>
  createSharedVault: (
    vault: Partial<SharedVault>,
    password: string,
  ) => Promise<void>
  updateSharedVault: (id: string, vault: Partial<SharedVault>) => Promise<void>
  deleteSharedVault: (id: string) => Promise<void>
  selectSharedVault: (vault: SharedVault | null) => void
  unlockSharedVault: (password: string) => Promise<void>
  lockSharedVault: () => void
  addMember: (vaultId: string, userId: string, role: string) => Promise<void>
  removeMember: (vaultId: string, userId: string) => Promise<void>
  clearError: () => void
}

export const useSharedVaultStore = create<SharedVaultState>((set, get) => ({
  sharedVaults: [],
  selectedSharedVault: null,
  isUnlocked: false,
  decryptedData: null,
  isLoading: false,
  error: null,

  fetchSharedVaults: async (teamId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.listSharedVaults(teamId)
      set({ sharedVaults: result.vaults, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createSharedVault: async (vault, password) => {
    set({ isLoading: true, error: null })
    try {
      await initSodium()

      // Generate salt and derive key
      const salt = generateSalt()
      const key = await deriveKey(password, salt)

      // Encrypt empty vault data
      const emptyData = JSON.stringify({ hosts: [], keys: [], snippets: [] })
      const plaintext = stringToBuffer(emptyData)
      const nonce = generateNonce()
      const encrypted = await encryptSecret(plaintext, nonce, key)

      const result = await api.createSharedVault({
        ...vault,
        encryptedData: encrypted.ciphertext,
        iv: encrypted.nonce,
        salt: bufferToBase64(salt),
      })

      set({
        sharedVaults: [...get().sharedVaults, result.vault],
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateSharedVault: async (id, vault) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateSharedVault(id, vault)
      set({
        sharedVaults: get().sharedVaults.map((v) =>
          v.id === id ? result.vault : v,
        ),
        selectedSharedVault:
          get().selectedSharedVault?.id === id
            ? result.vault
            : get().selectedSharedVault,
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteSharedVault: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteSharedVault(id)
      set({
        sharedVaults: get().sharedVaults.filter((v) => v.id !== id),
        selectedSharedVault:
          get().selectedSharedVault?.id === id
            ? null
            : get().selectedSharedVault,
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectSharedVault: (vault) => set({ selectedSharedVault: vault }),

  unlockSharedVault: async (password) => {
    if (!get().selectedSharedVault) {
      set({ error: 'No vault selected' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      await initSodium()

      const vault = get().selectedSharedVault!
      const salt = base64ToBuffer(vault.salt)
      const key = await deriveKey(password, salt)

      const decrypted = await decryptSecret(
        {
          ciphertext: vault.encryptedData,
          nonce: vault.iv,
        },
        key,
      )

      const data = JSON.parse(bufferToString(decrypted))
      set({ decryptedData: data, isUnlocked: true, isLoading: false })
    } catch (error: any) {
      set({
        error: error.message || 'Failed to unlock vault',
        isLoading: false,
      })
    }
  },

  lockSharedVault: () => set({ isUnlocked: false, decryptedData: null }),

  addMember: async (vaultId, userId, role) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.addSharedVaultMember(vaultId, { userId, role })
      const vault = get().sharedVaults.find((v) => v.id === vaultId)
      if (vault) {
        const updatedVault = {
          ...vault,
          members: [...vault.members, result.member],
        }
        set({
          sharedVaults: get().sharedVaults.map((v) =>
            v.id === vaultId ? updatedVault : v,
          ),
          selectedSharedVault:
            get().selectedSharedVault?.id === vaultId
              ? updatedVault
              : get().selectedSharedVault,
          isLoading: false,
        })
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  removeMember: async (vaultId, userId) => {
    set({ isLoading: true, error: null })
    try {
      await api.removeSharedVaultMember(vaultId, userId)
      const vault = get().sharedVaults.find((v) => v.id === vaultId)
      if (vault) {
        const updatedVault = {
          ...vault,
          members: vault.members.filter((m) => m.userId !== userId),
        }
        set({
          sharedVaults: get().sharedVaults.map((v) =>
            v.id === vaultId ? updatedVault : v,
          ),
          selectedSharedVault:
            get().selectedSharedVault?.id === vaultId
              ? updatedVault
              : get().selectedSharedVault,
          isLoading: false,
        })
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
