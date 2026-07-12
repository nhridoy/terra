import { create } from 'zustand'
import api from '../lib/api'

interface WorkspaceTab {
  hostId: string
  hostName: string
  isActive: boolean
}

interface Workspace {
  id: string
  name: string
  description?: string
  tabs: WorkspaceTab[]
  layout: 'single' | 'split-h' | 'split-v' | 'grid'
  createdAt: string
  updatedAt: string
}

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  isLoading: boolean
  error: string | null

  fetchWorkspaces: () => Promise<void>
  createWorkspace: (workspace: Partial<Workspace>) => Promise<void>
  updateWorkspace: (id: string, workspace: Partial<Workspace>) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  loadWorkspace: (id: string) => Workspace | null
  saveCurrentState: (name: string, description?: string) => Promise<void>
  setActiveWorkspace: (id: string | null) => void
  clearError: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.listWorkspaces()
      set({ workspaces: result.workspaces, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createWorkspace: async (workspace) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.createWorkspace(workspace)
      set({
        workspaces: [...get().workspaces, result.workspace],
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  updateWorkspace: async (id, workspace) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateWorkspace(id, workspace)
      set({
        workspaces: get().workspaces.map((w) =>
          w.id === id ? result.workspace : w,
        ),
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  deleteWorkspace: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteWorkspace(id)
      set({
        workspaces: get().workspaces.filter((w) => w.id !== id),
        activeWorkspaceId:
          get().activeWorkspaceId === id ? null : get().activeWorkspaceId,
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  loadWorkspace: (id) => {
    const workspace = get().workspaces.find((w) => w.id === id)
    return workspace || null
  },

  saveCurrentState: async (name, description) => {
    set({ isLoading: true, error: null })
    try {
      const savedTabs = localStorage.getItem('termvault_current_tabs')
      const tabs = savedTabs ? JSON.parse(savedTabs) : []

      const workspace: Partial<Workspace> = {
        name,
        description,
        tabs: tabs.map((tab: WorkspaceTab) => ({
          hostId: tab.hostId,
          hostName: tab.hostName,
          isActive: tab.isActive,
        })),
        layout: 'single',
      }

      const result = await api.createWorkspace(workspace)
      set({
        workspaces: [...get().workspaces, result.workspace],
        isLoading: false,
      })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  clearError: () => set({ error: null }),
}))
