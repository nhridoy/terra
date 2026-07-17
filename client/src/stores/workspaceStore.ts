import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../lib/device'
import { useAuthStore } from './authStore'

interface Workspace {
  id: string
  name: string
  layout: string
  vaultId?: string
  hostIds?: string
  createdAt: string
  updatedAt: string
}

interface WorkspaceState {
  workspaces: Workspace[]
  isLoading: boolean
  error: string | null

  fetchWorkspaces: (vaultId?: string) => Promise<void>
  createWorkspace: (
    name: string,
    layout: any,
    vaultId?: string,
  ) => Promise<void>
  renameWorkspace: (id: string, name: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  clearError: () => void
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  isLoading: false,
  error: null,

  fetchWorkspaces: async (_vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const workspaces = await invoke<Workspace[]>('list_workspaces', { userId: getUserId() })
      set({ workspaces, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createWorkspace: async (name, layout, vaultId) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const result = await invoke<Workspace>('create_workspace', {
        ws: {
          userId: getUserId(),
          name,
          layout: JSON.stringify(layout),
          hostIds: JSON.stringify(layout.hostIds || []),
          vaultId: vaultId || null,
        },
        deviceId,
      })
      set({ workspaces: [...get().workspaces, result], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  renameWorkspace: async (id, name) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const existing = get().workspaces.find((w) => w.id === id)
      const result = await invoke<Workspace>('update_workspace', {
        id,
        ws: {
          userId: getUserId(),
          name,
          layout: existing?.layout || '{}',
          hostIds: existing?.hostIds || '[]',
          vaultId: existing?.vaultId || null,
        },
        deviceId,
      })
      set({
        workspaces: get().workspaces.map((w) => (w.id === id ? result : w)),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  deleteWorkspace: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_workspace', { id, deviceId })
      set({
        workspaces: get().workspaces.filter((w) => w.id !== id),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  clearError: () => set({ error: null }),
}))
