import { create } from 'zustand'
import api from '../lib/api'

interface WorkspaceTab {
  title: string
  root: unknown
}

interface WorkspaceLayout {
  tabs: WorkspaceTab[]
  hostIds: string[]
}

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
    layout: WorkspaceLayout,
    vaultId?: string,
  ) => Promise<void>
  renameWorkspace: (id: string, name: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  clearError: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  isLoading: false,
  error: null,

  fetchWorkspaces: async (vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.listWorkspaces(vaultId)
      set({ workspaces: result.workspaces || [], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createWorkspace: async (name, layout, vaultId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.createWorkspace({
        name,
        layout: JSON.stringify(layout),
        hostIds: layout.hostIds,
        vaultId,
      })
      set({ workspaces: [...get().workspaces, result.workspace], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      throw error
    }
  },

  renameWorkspace: async (id, name) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateWorkspace(id, { name })
      set({
        workspaces: get().workspaces.map((w) => (w.id === id ? result.workspace : w)),
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
      await api.deleteWorkspace(id)
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
