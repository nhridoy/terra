import { create } from 'zustand'
import api from '../lib/api'
import type { PaneNode } from './terminalStore'
import { useTerminalStore } from './terminalStore'

export interface TabGroup {
  id: string
  name: string
  layout: string // JSON string of the PaneNode tree root
  vaultId?: string
  createdAt?: string
}

// Strip volatile fields (connection status) from a pane tree before saving.
function stripVolatile(node: PaneNode): PaneNode {
  if (node.type === 'leaf') {
    const { connectionStatus: _cs, lastConnected: _lc, ...rest } = node
    void _cs
    void _lc
    return rest as PaneNode
  }
  return { ...node, children: node.children.map(stripVolatile) }
}

export const useTabGroupStore = create<{
  tabGroups: TabGroup[]
  fetchTabGroups: (vaultId?: string) => Promise<void>
  createTabGroup: (name: string, root: PaneNode, vaultId?: string) => Promise<TabGroup | null>
  renameTabGroup: (id: string, name: string) => Promise<void>
  deleteTabGroup: (id: string) => Promise<void>
}>((set, get) => ({
  tabGroups: [],

  fetchTabGroups: async (vaultId?: string) => {
    try {
      const result = await api.listTabGroups(vaultId)
      if (result.tabGroups) set({ tabGroups: result.tabGroups })
    } catch (e) {
      console.error('Failed to fetch tab groups:', e)
    }
  },

  createTabGroup: async (name, root, vaultId?: string) => {
    try {
      const layout = JSON.stringify(stripVolatile(root))
      const result = await api.createTabGroup({ name, layout, vaultId })
      if (result.tabGroup) {
        set({
          tabGroups: [result.tabGroup as TabGroup, ...get().tabGroups],
        })
        return result.tabGroup as TabGroup
      }
    } catch (e) {
      console.error('Failed to create tab group:', e)
    }
    return null
  },

  renameTabGroup: async (id, name) => {
    try {
      await api.renameTabGroup(id, name)
      set({
        tabGroups: get().tabGroups.map((g) => (g.id === id ? { ...g, name } : g)),
      })
    } catch (e) {
      console.error('Failed to rename tab group:', e)
    }
  },

  deleteTabGroup: async (id) => {
    try {
      await api.deleteTabGroup(id)
      set({ tabGroups: get().tabGroups.filter((g) => g.id !== id) })
      // Clear Quick Preset tracking on any tab that was launched from this preset
      // so the "save as new" button re-appears there.
      const { tabs } = useTerminalStore.getState()
      if (tabs.some((t) => t.activePresetId === id)) {
        useTerminalStore.setState({
          tabs: tabs.map((t) =>
            t.activePresetId === id
              ? { ...t, activePresetId: null, activePresetName: null, presetDirty: false, savedPresetSnapshot: '' }
              : t,
          ),
        })
      }
    } catch (e) {
      console.error('Failed to delete tab group:', e)
    }
  },
}))
