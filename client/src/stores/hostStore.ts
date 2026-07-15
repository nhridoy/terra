import { create } from 'zustand'
import api from '../lib/api'

function normalizeTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags)
      return Array.isArray(parsed) ? parsed : [tags]
    } catch {
      return tags ? [tags] : []
    }
  }
  return []
}

function normalizeHost(raw: any): Host {
  return { ...raw, tags: normalizeTags(raw.tags) }
}

interface Host {
  id: string
  name: string
  address: string
  port: number
  username?: string
  groupId?: string | null
  tags: string[]
  color?: string
  icon?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface Group {
  id: string
  name: string
  parentId?: string | null
  vaultId?: string
  sortOrder: number
  createdAt: string
}

interface HostState {
  hosts: Host[]
  groups: Group[]
  selectedHost: Host | null
  isLoading: boolean
  error: string | null

  fetchHosts: (vaultId?: string) => Promise<void>
  fetchGroups: (vaultId?: string) => Promise<void>
  createHost: (host: Partial<Host>) => Promise<void>
  updateHost: (id: string, host: Partial<Host>) => Promise<void>
  deleteHost: (id: string) => Promise<void>
  selectHost: (host: Host | null) => void
  createGroup: (group: Partial<Group>) => Promise<void>
  updateGroup: (id: string, group: Partial<Group>) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  clearError: () => void
}

export const useHostStore = create<HostState>((set, get) => ({
  hosts: [],
  groups: [],
  selectedHost: null,
  isLoading: false,
  error: null,

  fetchHosts: async (vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.listHosts(vaultId)
      set({ hosts: (result.hosts || []).map(normalizeHost), isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  fetchGroups: async (vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.listGroups(vaultId)
      set({ groups: result.groups, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createHost: async (host) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.createHost(host)
      set({ hosts: [...get().hosts, normalizeHost(result.host)], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateHost: async (id, host) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateHost(id, host)
      set({
        hosts: get().hosts.map((h) => (h.id === id ? normalizeHost(result.host) : h)),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteHost: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteHost(id)
      set({
        hosts: get().hosts.filter((h) => h.id !== id),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectHost: (host) => set({ selectedHost: host }),

  createGroup: async (group) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.createGroup(group)
      set({ groups: [...get().groups, result.group], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateGroup: async (id, group) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateGroup(id, group)
      set({
        groups: get().groups.map((g) => (g.id === id ? result.group : g)),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteGroup: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteGroup(id)
      set({
        groups: get().groups.filter((g) => g.id !== id),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
