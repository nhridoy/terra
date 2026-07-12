import { create } from 'zustand'

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

interface TerminalTab {
  id: string
  hostId?: string
  hostName: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
  title: string
  isActive: boolean
  connectionStatus: ConnectionStatus
  lastConnected?: string
}

interface TerminalState {
  tabs: TerminalTab[]
  activeTabId: string | null
  isConnected: boolean

  addTab: (hostId: string, hostName: string, options?: { hostAddress?: string; hostPort?: number; hostUsername?: string }) => void
  addEmptyTab: () => string
  connectTab: (tabId: string, hostId: string, hostName: string, options?: { hostAddress?: string; hostPort?: number; hostUsername?: string }) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabTitle: (id: string, title: string) => void
  updateTabConnectionStatus: (id: string, status: ConnectionStatus) => void
  setConnected: (connected: boolean) => void
  closeAllTabs: () => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  isConnected: false,

  addTab: (hostId, hostName, options) => {
    const newTab: TerminalTab = {
      id: `tab_${Date.now()}`,
      hostId,
      hostName,
      hostAddress: options?.hostAddress,
      hostPort: options?.hostPort,
      hostUsername: options?.hostUsername,
      title: hostName,
      isActive: true,
      connectionStatus: 'connecting',
    }

    // Deactivate other tabs
    const tabs = get().tabs.map((t) => ({ ...t, isActive: false }))

    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
    })
  },

  addEmptyTab: () => {
    const id = `tab_${Date.now()}`
    const newTab: TerminalTab = {
      id,
      hostName: 'New Tab',
      title: 'New Tab',
      isActive: true,
      connectionStatus: 'disconnected',
    }

    const tabs = get().tabs.map((t) => ({ ...t, isActive: false }))

    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
    })

    return id
  },

  connectTab: (tabId, hostId, hostName, options) => {
    const tabs = get().tabs.map((t) =>
      t.id === tabId
        ? {
            ...t,
            hostId,
            hostName,
            hostAddress: options?.hostAddress,
            hostPort: options?.hostPort,
            hostUsername: options?.hostUsername,
            title: hostName,
            connectionStatus: 'connecting' as ConnectionStatus,
          }
        : t
    )
    set({ tabs })
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get()
    const newTabs = tabs.filter((t) => t.id !== id)

    // If removing active tab, activate the last tab
    let newActiveTabId = activeTabId
    if (activeTabId === id && newTabs.length > 0) {
      newActiveTabId = newTabs[newTabs.length - 1].id
      newTabs[newTabs.length - 1].isActive = true
    }

    set({
      tabs: newTabs,
      activeTabId: newTabs.length === 0 ? null : newActiveTabId,
    })
  },

  setActiveTab: (id) => {
    const tabs = get().tabs.map((t) => ({
      ...t,
      isActive: t.id === id,
    }))

    set({ tabs, activeTabId: id })
  },

  updateTabTitle: (id, title) => {
    const tabs = get().tabs.map((t) => (t.id === id ? { ...t, title } : t))
    set({ tabs })
  },

  updateTabConnectionStatus: (id, status) => {
    const tabs = get().tabs.map((t) =>
      t.id === id
        ? {
            ...t,
            connectionStatus: status,
            lastConnected:
              status === 'connected'
                ? new Date().toISOString()
                : t.lastConnected,
          }
        : t,
    )
    set({ tabs })
  },

  setConnected: (connected) => set({ isConnected: connected }),

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),
}))
