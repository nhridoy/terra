import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../lib/device'
import { useAuthStore } from './authStore'

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

export interface Host {
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

export interface Group {
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

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

export const useHostStore = create<HostState>((set, get) => ({
  hosts: [],
  groups: [],
  selectedHost: null,
  isLoading: false,
  error: null,

  fetchHosts: async (_vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const hosts = await invoke<any[]>('list_hosts', { userId: getUserId() })
      set({ hosts: hosts.map(normalizeHost), isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  fetchGroups: async (_vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const groups = await invoke<Group[]>('list_groups', { userId: getUserId() })
      set({ groups, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createHost: async (host) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const result = await invoke<any>('create_host', {
        host: {
          userId: getUserId(),
          name: host.name || '',
          address: host.address || '',
          port: host.port || 22,
          username: host.username || '',
          groupId: host.groupId || null,
          tags: host.tags ? JSON.stringify(host.tags) : '[]',
          color: host.color || null,
          icon: host.icon || null,
        },
        deviceId,
      })
      set({ hosts: [...get().hosts, normalizeHost(result)], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateHost: async (id, host) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const result = await invoke<any>('update_host', {
        id,
        host: {
          userId: getUserId(),
          name: host.name || '',
          address: host.address || '',
          port: host.port || 22,
          username: host.username || '',
          groupId: host.groupId || null,
          tags: host.tags ? JSON.stringify(host.tags) : '[]',
          color: host.color || null,
          icon: host.icon || null,
        },
        deviceId,
      })
      set({
        hosts: get().hosts.map((h) => (h.id === id ? normalizeHost(result) : h)),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteHost: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_host', { id, deviceId })
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
      const deviceId = await getDeviceId()
      const result = await invoke<Group>('create_group', {
        group: {
          userId: getUserId(),
          name: group.name || '',
          parentId: group.parentId || null,
          vaultId: group.vaultId || null,
        },
        deviceId,
      })
      set({ groups: [...get().groups, result], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateGroup: async (id, group) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const result = await invoke<Group>('update_group', {
        id,
        group: {
          userId: getUserId(),
          name: group.name || '',
          parentId: group.parentId || null,
          vaultId: group.vaultId || null,
        },
        deviceId,
      })
      set({
        groups: get().groups.map((g) => (g.id === id ? result : g)),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteGroup: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_group', { id, deviceId })
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
