import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { getDeviceId } from '../lib/device'
import { triggerSync } from '../lib/sync'
import { useAuthStore } from './authStore'
import type { PaneNode } from './terminalStore'
import { useTerminalStore } from './terminalStore'

export interface TabGroup {
  id: string
  name: string
  layout: string
  vaultId?: string
  createdAt?: string
}

function stripVolatile(node: PaneNode): PaneNode {
  if (node.type === 'leaf') {
    const { connectionStatus: _cs, lastConnected: _lc, ...rest } = node
    void _cs
    void _lc
    return rest as PaneNode
  }
  return { ...node, children: node.children.map(stripVolatile) }
}

function getUserId(): string {
  return useAuthStore.getState().user?.id || ''
}

export const useTabGroupStore = create<{
  tabGroups: TabGroup[]
  fetchTabGroups: (vaultId?: string) => Promise<void>
  createTabGroup: (
    name: string,
    root: PaneNode,
    vaultId?: string,
  ) => Promise<TabGroup | null>
  renameTabGroup: (id: string, name: string) => Promise<void>
  deleteTabGroup: (id: string) => Promise<void>
}>((set, get) => ({
  tabGroups: [],

  fetchTabGroups: async (vaultId?: string) => {
    try {
      const tabGroups = await invoke<TabGroup[]>('list_tab_groups', {
        userId: getUserId(),
        vaultId: vaultId || null,
      })
      set({ tabGroups })
    } catch (e) {
      console.error('Failed to fetch tab groups:', e)
    }
  },

  createTabGroup: async (name, root, vaultId?: string) => {
    try {
      const deviceId = await getDeviceId()
      const layout = JSON.stringify(stripVolatile(root))
      const result = await invoke<TabGroup>('create_tab_group', {
        tg: {
          userId: getUserId(),
          name,
          layout,
          vaultId: vaultId || null,
        },
        deviceId,
      })
      set({
        tabGroups: [result, ...get().tabGroups],
      })
      triggerSync()
      return result
    } catch (e) {
      console.error('Failed to create tab group:', e)
    }
    return null
  },

  renameTabGroup: async (id, name) => {
    try {
      const deviceId = await getDeviceId()
      const existing = get().tabGroups.find((g) => g.id === id)
      await invoke('update_tab_group', {
        id,
        tg: {
          userId: getUserId(),
          name,
          layout: existing?.layout || '{}',
          vaultId: existing?.vaultId || null,
        },
        deviceId,
      })
      set({
        tabGroups: get().tabGroups.map((g) =>
          g.id === id ? { ...g, name } : g,
        ),
      })
      triggerSync()
    } catch (e) {
      console.error('Failed to rename tab group:', e)
    }
  },

  deleteTabGroup: async (id) => {
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_tab_group', { id, deviceId })
      set({ tabGroups: get().tabGroups.filter((g) => g.id !== id) })
      triggerSync()
      const { tabs } = useTerminalStore.getState()
      if (tabs.some((t) => t.activePresetId === id)) {
        useTerminalStore.setState({
          tabs: tabs.map((t) =>
            t.activePresetId === id
              ? {
                  ...t,
                  activePresetId: null,
                  activePresetName: null,
                  presetDirty: false,
                  savedPresetSnapshot: '',
                }
              : t,
          ),
        })
      }
    } catch (e) {
      console.error('Failed to delete tab group:', e)
    }
  },
}))
