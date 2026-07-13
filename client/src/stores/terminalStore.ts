import { create } from 'zustand'

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

export interface LeafNode {
  type: 'leaf'
  id: string
  hostId?: string
  hostName: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
  title: string
  connectionStatus: ConnectionStatus
  lastConnected?: string
  size: number
}

export interface SplitNode {
  type: 'split'
  id: string
  direction: 'horizontal' | 'vertical'
  children: PaneNode[]
  size: number
}

export type PaneNode = LeafNode | SplitNode

export interface TerminalTab {
  id: string
  root: PaneNode
  activePaneId: string | null
  isActive: boolean
  title: string
}

interface ConnectOptions {
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
}

interface TerminalState {
  tabs: TerminalTab[]
  activeTabId: string | null

  addTab: (hostId: string, hostName: string, options?: ConnectOptions) => void
  addEmptyTab: () => string
  connectPane: (
    tabId: string,
    paneId: string,
    hostId: string,
    hostName: string,
    options?: ConnectOptions,
  ) => void
  connectActivePane: (
    tabId: string,
    hostId: string,
    hostName: string,
    options?: ConnectOptions,
  ) => void
  splitPane: (tabId: string, paneId: string, direction: 'horizontal' | 'vertical') => string
  removePane: (tabId: string, paneId: string) => void
  setActivePane: (tabId: string, paneId: string) => void
  setActiveTab: (id: string) => void
  updatePaneConnectionStatus: (tabId: string, paneId: string, status: ConnectionStatus) => void
  updatePaneTitle: (tabId: string, paneId: string, title: string) => void
  setPaneSizes: (tabId: string, splitId: string, sizes: number[]) => void
  removeTab: (id: string) => void
  closeAllTabs: () => void
  reorderTabs: (draggedId: string, targetId: string, before: boolean) => void
  setTabOrder: (ids: string[]) => void
  mergeTabIntoPane: (
    sourceTabId: string,
    targetTabId: string,
    targetPaneId: string,
    side: 'left' | 'right' | 'top' | 'bottom',
  ) => void
}

// ---- Pure tree helpers ----

function makeLeaf(partial: Partial<LeafNode> & { id: string }): LeafNode {
  return {
    type: 'leaf',
    id: partial.id,
    hostId: partial.hostId,
    hostName: partial.hostName ?? 'New Pane',
    hostAddress: partial.hostAddress,
    hostPort: partial.hostPort,
    hostUsername: partial.hostUsername,
    title: partial.title ?? partial.hostName ?? 'New Pane',
    connectionStatus: partial.connectionStatus ?? 'disconnected',
    lastConnected: partial.lastConnected,
    size: partial.size ?? 1,
  }
}

function findLeaf(node: PaneNode, paneId: string): LeafNode | null {
  if (node.type === 'leaf') return node.id === paneId ? node : null
  for (const child of node.children) {
    const found = findLeaf(child, paneId)
    if (found) return found
  }
  return null
}

function mapLeaves(node: PaneNode, fn: (leaf: LeafNode) => LeafNode): PaneNode {
  if (node.type === 'leaf') return fn(node)
  return {
    ...node,
    children: node.children.map((c) => mapLeaves(c, fn)),
  }
}

// Replace the node with the given id with `replacement`.
function replaceNode(node: PaneNode, id: string, replacement: PaneNode): PaneNode {
  if (node.id === id) return replacement
  if (node.type === 'split') {
    return {
      ...node,
      children: node.children.map((c) => replaceNode(c, id, replacement)),
    }
  }
  return node
}

// Remove the leaf with paneId and return the new (possibly collapsed) tree.
function removeLeaf(node: PaneNode, paneId: string): PaneNode {
  if (node.type === 'leaf') {
    return node
  }
  // Only remove a DIRECT leaf child. A split that *contains* the target must
  // be recursed into, never deleted wholesale (that would wipe its siblings).
  const directIdx = node.children.findIndex(
    (c) => c.type === 'leaf' && c.id === paneId,
  )
  if (directIdx !== -1) {
    const remaining = node.children.filter((_, i) => i !== directIdx)
    if (remaining.length === 1) {
      // Collapse: promote the single remaining child
      return remaining[0]
    }
    return { ...node, children: remaining }
  }
  // Otherwise recurse into child splits that may contain the target
  return {
    ...node,
    children: node.children.map((c) => removeLeaf(c, paneId)),
  }
}

function firstLeafId(node: PaneNode): string | null {
  if (node.type === 'leaf') return node.id
  for (const c of node.children) {
    const id = firstLeafId(c)
    if (id) return id
  }
  return null
}

function countLeaves(node: PaneNode): number {
  if (node.type === 'leaf') return 1
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
}

function leafTitles(node: PaneNode): string[] {
  if (node.type === 'leaf') return [node.title || node.hostName]
  return node.children.flatMap(leafTitles)
}

function deriveTitle(root: PaneNode): string {
  const titles = leafTitles(root).filter(Boolean)
  if (titles.length === 0) return 'New Tab'
  if (titles.length === 1) return titles[0]
  return `${titles[0]} +${titles.length - 1}`
}

function findSplit(node: PaneNode, splitId: string): SplitNode | null {
  if (node.type === 'split') {
    if (node.id === splitId) return node
    for (const c of node.children) {
      const found = findSplit(c, splitId)
      if (found) return found
    }
  }
  return null
}

function mapSplitChildren(node: PaneNode, splitId: string, children: PaneNode[]): PaneNode {
  if (node.type === 'split') {
    if (node.id === splitId) return { ...node, children }
    return { ...node, children: node.children.map((c) => mapSplitChildren(c, splitId, children)) }
  }
  return node
}

// ---- Store ----

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (hostId, hostName, options) => {
    const leaf = makeLeaf({
      id: `pane_${Date.now()}`,
      hostId,
      hostName,
      hostAddress: options?.hostAddress,
      hostPort: options?.hostPort,
      hostUsername: options?.hostUsername,
      title: hostName,
      connectionStatus: 'connecting',
    })
    const tab: TerminalTab = {
      id: `tab_${Date.now()}`,
      root: leaf,
      activePaneId: leaf.id,
      isActive: true,
      title: hostName,
    }
    const tabs = get().tabs.map((t) => ({ ...t, isActive: false }))
    set({ tabs: [...tabs, tab], activeTabId: tab.id })
  },

  addEmptyTab: () => {
    const leaf = makeLeaf({ id: `pane_${Date.now()}`, hostName: 'New Pane', title: 'New Pane' })
    const tab: TerminalTab = {
      id: `tab_${Date.now()}`,
      root: leaf,
      activePaneId: leaf.id,
      isActive: true,
      title: 'New Tab',
    }
    const tabs = get().tabs.map((t) => ({ ...t, isActive: false }))
    set({ tabs: [...tabs, tab], activeTabId: tab.id })
    return tab.id
  },

  connectPane: (tabId, paneId, hostId, hostName, options) => {
    set({
      tabs: get().tabs.map((t) => {
        if (t.id !== tabId) return t
        const root = mapLeaves(t.root, (leaf) =>
          leaf.id === paneId
            ? {
                ...leaf,
                hostId,
                hostName,
                hostAddress: options?.hostAddress,
                hostPort: options?.hostPort,
                hostUsername: options?.hostUsername,
                title: hostName,
                connectionStatus: 'connecting' as ConnectionStatus,
              }
            : leaf,
        )
        return { ...t, root, title: deriveTitle(root), activePaneId: paneId }
      }),
    })
  },

  connectActivePane: (tabId, hostId, hostName, options) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab || !tab.activePaneId) return
    get().connectPane(tabId, tab.activePaneId, hostId, hostName, options)
  },

  splitPane: (tabId, paneId, direction) => {
    const newId = `pane_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    const newLeaf = makeLeaf({ id: newId, hostName: 'New Pane', title: 'New Pane' })

    let newTitle = ''
    set({
      tabs: get().tabs.map((t) => {
        if (t.id !== tabId) return t
        const original = findLeaf(t.root, paneId)
        if (!original) return t
        const splitNode: SplitNode = {
          type: 'split',
          id: `split_${Date.now()}`,
          direction,
          size: 1,
          children: [
            { ...original, size: 1 },
            { ...newLeaf, size: 1 },
          ],
        }
        const root = replaceNode(t.root, paneId, splitNode)
        newTitle = deriveTitle(root)
        return { ...t, root, activePaneId: newId, title: newTitle }
      }),
    })
    return newId
  },

  removePane: (tabId, paneId) => {
    const tabs = get().tabs
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    if (countLeaves(tab.root) <= 1) {
      // Last pane -> remove whole tab
      get().removeTab(tabId)
      return
    }

    const tree = removeLeaf(tab.root, paneId)
    const newActive = tab.activePaneId === paneId ? firstLeafId(tree) : tab.activePaneId
    const newTabs = tabs.map((t) =>
      t.id === tabId
        ? { ...t, root: tree, activePaneId: newActive, title: deriveTitle(tree) }
        : t,
    )

    set({ tabs: newTabs })
  },

  setActivePane: (tabId, paneId) => {
    set({
      tabs: get().tabs.map((t) =>
        t.id === tabId ? { ...t, activePaneId: paneId } : t,
      ),
    })
  },

  setActiveTab: (id) => {
    set({
      tabs: get().tabs.map((t) => ({ ...t, isActive: t.id === id })),
      activeTabId: id,
    })
  },

  updatePaneConnectionStatus: (tabId, paneId, status) => {
    set({
      tabs: get().tabs.map((t) => {
        if (t.id !== tabId) return t
        const root = mapLeaves(t.root, (leaf) =>
          leaf.id === paneId
            ? {
                ...leaf,
                connectionStatus: status,
                lastConnected:
                  status === 'connected' ? new Date().toISOString() : leaf.lastConnected,
              }
            : leaf,
        )
        return { ...t, root }
      }),
    })
  },

  updatePaneTitle: (tabId, paneId, title) => {
    set({
      tabs: get().tabs.map((t) => {
        if (t.id !== tabId) return t
        const root = mapLeaves(t.root, (leaf) => (leaf.id === paneId ? { ...leaf, title } : leaf))
        return { ...t, root, title: deriveTitle(root) }
      }),
    })
  },

  setPaneSizes: (tabId, splitId, sizes) => {
    set({
      tabs: get().tabs.map((t) => {
        if (t.id !== tabId) return t
        const split = findSplit(t.root, splitId)
        if (!split) return t
        const children = split.children.map((c, i) => ({ ...c, size: sizes[i] ?? c.size }))
        const root = mapSplitChildren(t.root, splitId, children)
        return { ...t, root }
      }),
    })
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get()
    const newTabs = tabs.filter((t) => t.id !== id)
    let newActiveTabId = activeTabId
    if (activeTabId === id) {
      newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null
    }
    set({ tabs: newTabs, activeTabId: newActiveTabId })
  },

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  setTabOrder: (ids) => {
    const byId = new Map(get().tabs.map((t) => [t.id, t]))
    const ordered = ids.map((id) => byId.get(id)).filter((t): t is TerminalTab => Boolean(t))
    if (ordered.length === get().tabs.length) set({ tabs: ordered })
  },

  reorderTabs: (draggedId, targetId, before) => {
    if (draggedId === targetId) return
    const tabs = get().tabs
    const dragged = tabs.find((t) => t.id === draggedId)
    if (!dragged) return
    const without = tabs.filter((t) => t.id !== draggedId)
    const toIdx = without.findIndex((t) => t.id === targetId)
    if (toIdx === -1) return
    const insertAt = before ? toIdx : toIdx + 1
    const newTabs = [...without]
    newTabs.splice(insertAt, 0, dragged)
    set({ tabs: newTabs })
  },

  mergeTabIntoPane: (sourceTabId, targetTabId, targetPaneId, side) => {
    if (sourceTabId === targetTabId) return
    const direction = side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
    const source = get().tabs.find((t) => t.id === sourceTabId)
    if (!source) return
    const sourceRoot = JSON.parse(JSON.stringify(source.root)) as PaneNode

    let newActiveTabId = get().activeTabId
    if (newActiveTabId === sourceTabId) newActiveTabId = targetTabId

    // Source goes first when dropped on the leading edge (left/top),
    // otherwise the original pane stays first.
    const sourceFirst = side === 'left' || side === 'top'

    const newTabs = get().tabs.flatMap((t) => {
      if (t.id === sourceTabId) return []
      if (t.id !== targetTabId) return [t]
      const original = findLeaf(t.root, targetPaneId)
      if (!original) return [t]
      const splitNode: SplitNode = {
        type: 'split',
        id: `split_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        direction,
        size: 1,
        children: sourceFirst
          ? [{ ...sourceRoot, size: 1 }, { ...original, size: 1 }]
          : [{ ...original, size: 1 }, { ...sourceRoot, size: 1 }],
      }
      const root = replaceNode(t.root, targetPaneId, splitNode)
      return [
        {
          ...t,
          root,
          activePaneId: firstLeafId(sourceRoot),
          title: deriveTitle(root),
        },
      ]
    })

    set({ tabs: newTabs, activeTabId: newActiveTabId })
  },
}))
