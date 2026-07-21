import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { getDeviceId } from '../lib/device'
import { triggerSync } from '../lib/sync'
import {
  decryptHostCredentials,
  encryptHostCredentials,
} from '../lib/vaultCrypto'
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

function normalizeHost(raw: Omit<Host, 'tags'> & { tags: unknown }): Host {
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
  password?: string
  privateKey?: string
  passphrase?: string
  authType?: 'password' | 'key'
  keyId?: string
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
  getCredentialsForHost: (
    hostId: string,
  ) => Promise<{ password: string; privateKey: string; passphrase: string }>
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

  fetchHosts: async (vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const hosts = await invoke<Host[]>('list_hosts', {
        userId: getUserId(),
        vaultId: vaultId || null,
      })
      set({ hosts: hosts.map(normalizeHost), isLoading: false })
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  fetchGroups: async (vaultId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const groups = await invoke<Group[]>('list_groups', {
        userId: getUserId(),
        vaultId: vaultId || null,
      })
      set({ groups, isLoading: false })
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  createHost: async (host) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const payload: Record<string, unknown> = {
        userId: getUserId(),
        name: host.name || '',
        address: host.address || '',
        port: host.port || 22,
        username: host.username || '',
        groupId: host.groupId || null,
        tags: host.tags ? JSON.stringify(host.tags) : '[]',
        color: host.color || null,
        icon: host.icon || null,
        authType: host.authType || 'password',
        keyId: host.keyId || '',
      }
      if (host.password) payload.password = host.password
      if (host.privateKey) payload.privateKey = host.privateKey
      if (host.passphrase) payload.passphrase = host.passphrase
      const encrypted = await encryptHostCredentials(payload)
      const result = await invoke<Host>('create_host', {
        host: encrypted,
        deviceId,
      })
      set({ hosts: [...get().hosts, normalizeHost(result)], isLoading: false })
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  updateHost: async (id, host) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      const payload: Record<string, unknown> = {
        userId: getUserId(),
        name: host.name || '',
        address: host.address || '',
        port: host.port || 22,
        username: host.username || '',
        groupId: host.groupId || null,
        tags: host.tags ? JSON.stringify(host.tags) : '[]',
        color: host.color || null,
        icon: host.icon || null,
        authType: host.authType || 'password',
        keyId: host.keyId || '',
      }
      if (host.password) payload.password = host.password
      if (host.privateKey) payload.privateKey = host.privateKey
      if (host.passphrase) payload.passphrase = host.passphrase
      const encrypted = await encryptHostCredentials(payload)
      const result = await invoke<Host>('update_host', {
        id,
        host: encrypted,
        deviceId,
      })
      set({
        hosts: get().hosts.map((h) =>
          h.id === id ? normalizeHost(result) : h,
        ),
        isLoading: false,
      })
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
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
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  selectHost: (host) => set({ selectedHost: host }),

  getCredentialsForHost: async (hostId) => {
    try {
      const creds = await invoke<{
        password: string
        privateKey: string
        passphrase: string
      }>('get_host_credentials', { hostId })
      return await decryptHostCredentials(creds)
    } catch {
      return { password: '', privateKey: '', passphrase: '' }
    }
  },

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
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
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
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  deleteGroup: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_group', { id, deviceId })
      const [groups, hosts] = await Promise.all([
        invoke<Group[]>('list_groups', { userId: getUserId(), vaultId: null }),
        invoke<Host[]>('list_hosts', { userId: getUserId(), vaultId: null }),
      ])
      set({
        groups,
        hosts: hosts.map(normalizeHost),
        isLoading: false,
      })
      triggerSync()
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      })
    }
  },

  clearError: () => set({ error: null }),
}))
