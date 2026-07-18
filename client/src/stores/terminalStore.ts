import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../lib/device'
import { useWorkspaceStore } from './workspaceStore'
import { triggerSync } from '../lib/sync'

function getUserId(): string {
  try {
    const raw = localStorage.getItem('user')
    if (raw) return JSON.parse(raw).id || ''
  } catch {}
  return ''
}

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

// Serialized representation of all open tabs, used to save/restore a workspace.
export interface WorkspaceLayout {
  tabs: Array<{
    title: string
    root: PaneNode
  }>
}

export interface TerminalTab {
  id: string
  root: PaneNode
  activePaneId: string | null
  isActive: boolean
  title: string
  // Preset tracking: when this tab was launched from / saved as a Quick Preset.
  activePresetId: string | null
  activePresetName: string | null
  savedPresetSnapshot: string
  presetDirty: boolean
}

interface ConnectOptions {
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
}

interface TerminalState {
  tabs: TerminalTab[]
  activeTabId: string | null

  // Workspace tracking: which saved workspace the current tabs were launched
  // from, its display name, whether the live tabs differ from the saved
  // snapshot, and a serialized snapshot used to detect changes.
  activeWorkspaceId: string | null
  activeWorkspaceName: string | null
  isDirty: boolean
  savedSnapshot: string

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
  movePane: (
    tabId: string,
    sourcePaneId: string,
    targetPaneId: string,
    side: 'left' | 'right' | 'top' | 'bottom',
  ) => void
  mergeTabIntoPane: (
    sourceTabId: string,
    targetTabId: string,
    targetPaneId: string,
    side: 'left' | 'right' | 'top' | 'bottom',
  ) => void
  // Restore a saved workspace: rebuild every tab and reconnect to its hosts.
  launchWorkspace: (layout: WorkspaceLayout, workspaceId?: string, workspaceName?: string) => void
  // Restore a saved Quick Preset: replace a single tab's pane tree and reconnect hosts.
  restorePreset: (preset: { id?: string; name?: string; layout: string }, tabId: string) => void
  // Persist the current tab's layout back onto its active preset (overwrite).
  saveCurrentPreset: (tabId: string) => Promise<void>
  // Mark a tab as belonging to a preset (used right after saving a new preset).
  setPresetForTab: (tabId: string, presetId: string, presetName: string) => void
  // Persist the current tabs back onto the active workspace (overwrite).
  saveCurrentWorkspace: () => Promise<void>
  // Persist the current tabs as a brand new workspace.
  saveAsNewWorkspace: (name: string, vaultId?: string) => Promise<void>
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

export function findLeaf(node: PaneNode, paneId: string): LeafNode | null {
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

// Returns the direct parent SplitNode that contains the leaf with `paneId`.
// Returns null if the pane is the root or not found.
function findParentSplit(node: PaneNode, paneId: string): SplitNode | null {
  if (node.type === 'leaf') return null
  const directIdx = node.children.findIndex(
    (c) => c.type === 'leaf' && c.id === paneId,
  )
  if (directIdx !== -1) return node
  for (const child of node.children) {
    const found = findParentSplit(child, paneId)
    if (found) return found
  }
  return null
}

// Returns a deep copy of a saved tree with every node id replaced by a fresh
// id, so restored workspaces never collide with live tabs.
function regenerateNodeIds(node: PaneNode): PaneNode {
  if (node.type === 'leaf') {
    return {
      ...node,
      id: `pane_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      connectionStatus: 'disconnected',
    }
  }
  return {
    ...node,
    id: `split_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    children: node.children.map(regenerateNodeIds),
  }
}

// Strip volatile, runtime-only fields from a tree so two trees that differ
// only by connection state still serialize identically (used for dirty checks
// and saved snapshots).
function stripVolatile(node: PaneNode): PaneNode {
  if (node.type === 'leaf') {
    const { connectionStatus: _cs, lastConnected: _lc, ...rest } = node
    void _cs
    void _lc
    return rest as LeafNode
  }
  return { ...node, children: node.children.map(stripVolatile) }
}

export interface WorkspaceSavePayload {
  tabs: Array<{ title: string; root: PaneNode }>
  hostIds: string[]
}

// Build the serializable workspace payload from live tabs. A tab is included
// only if it has at least one connected leaf (a fully-empty "New Tab" is
// skipped). Volatile fields are stripped from every node.
export function serializeWorkspaceLayout(tabs: TerminalTab[]): WorkspaceSavePayload {
  const out: Array<{ title: string; root: PaneNode }> = []
  const hostIds: string[] = []
  tabs.forEach((t) => {
    const hasConnectedLeaf = (node: PaneNode): boolean => {
      if (node.type === 'leaf') return !!node.hostId
      return node.children.some(hasConnectedLeaf)
    }
    if (!hasConnectedLeaf(t.root)) return
    const cleanRoot = stripVolatile(t.root)
    out.push({ title: t.title, root: cleanRoot })
    const collect = (node: PaneNode) => {
      if (node.type === 'leaf') {
        if (node.hostId && !hostIds.includes(node.hostId)) hostIds.push(node.hostId)
      } else {
        node.children.forEach(collect)
      }
    }
    collect(cleanRoot)
  })
  return { tabs: out, hostIds }
}

// A stable snapshot of a single tab's pane tree (volatile fields stripped).
// Used for per-tab Quick Preset dirty detection.
export function computeTabSnapshot(root: PaneNode): string {
  return JSON.stringify(stripVolatile(root))
}

// A stable snapshot of the live tabs' structure (only connected, volatile
// stripped). Used to cheaply detect whether the user changed the layout.
function computeSnapshot(tabs: TerminalTab[]): string {
  const { tabs: layoutTabs } = serializeWorkspaceLayout(tabs)
  return JSON.stringify(layoutTabs.map((t) => stripVolatile(t.root)))
}

// ---- Store ----

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  activeWorkspaceId: null,
  activeWorkspaceName: null,
  isDirty: false,
  savedSnapshot: '',

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
      activePresetId: null,
      activePresetName: null,
      savedPresetSnapshot: '',
      presetDirty: false,
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
      activePresetId: null,
      activePresetName: null,
      savedPresetSnapshot: '',
      presetDirty: false,
    }
    const tabs = get().tabs.map((t) => ({ ...t, isActive: false }))
    set({ tabs: [...tabs, tab], activeTabId: tab.id })
    return tab.id
  },

  restorePreset: (preset, tabId) => {
    let root: PaneNode
    try {
      root = regenerateNodeIds(JSON.parse(preset.layout))
    } catch (e) {
      console.error('Failed to parse preset layout:', e)
      return
    }
    // Replace the CURRENT tab's content (so launching a preset behaves like
    // connecting a host from the New Tab view — same tab, not a new one).
    const snapshot = computeTabSnapshot(root)
    const tabs = get().tabs.map((t) => {
      if (t.id !== tabId) return t
      return {
        ...t,
        root,
        activePaneId: firstLeafId(root),
        title: deriveTitle(root),
        activePresetId: preset.id ?? null,
        activePresetName: preset.name ?? null,
        savedPresetSnapshot: snapshot,
        presetDirty: false,
      }
    })
    set({ tabs })

    // Reconnect every leaf that references a host.
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    const leaves: LeafNode[] = []
    const collect = (node: PaneNode) => {
      if (node.type === 'leaf') leaves.push(node)
      else node.children.forEach(collect)
    }
    collect(tab.root)
    leaves.forEach((leaf) => {
      if (leaf.hostId) {
        get().connectPane(tabId, leaf.id, leaf.hostId, leaf.hostName, {
          hostAddress: leaf.hostAddress,
          hostPort: leaf.hostPort,
          hostUsername: leaf.hostUsername,
        })
      }
    })
  },

  saveCurrentPreset: async (tabId) => {
    const { tabs } = get()
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab || !tab.activePresetId) return
    try {
      const deviceId = await getDeviceId()
      await invoke('update_tab_group', {
        id: tab.activePresetId,
        tg: { userId: getUserId(), name: '', layout: JSON.stringify(stripVolatile(tab.root)) },
        deviceId,
      })
      await triggerSync()
      set({
        tabs: tabs.map((t) =>
          t.id === tabId
            ? { ...t, savedPresetSnapshot: computeTabSnapshot(t.root), presetDirty: false }
            : t,
        ),
      })
    } catch (e) {
      console.error('Failed to save preset changes:', e)
    }
  },

  setPresetForTab: (tabId, presetId, presetName) => {
    set({
      tabs: get().tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              activePresetId: presetId,
              activePresetName: presetName,
              savedPresetSnapshot: computeTabSnapshot(t.root),
              presetDirty: false,
            }
          : t,
      ),
    })
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
    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
      // Closing the last tab detaches from any loaded workspace.
      ...(newTabs.length === 0
        ? { activeWorkspaceId: null, activeWorkspaceName: null, isDirty: false, savedSnapshot: '' }
        : {}),
    })
  },

  closeAllTabs: () =>
    set({
      tabs: [],
      activeTabId: null,
      activeWorkspaceId: null,
      activeWorkspaceName: null,
      isDirty: false,
      savedSnapshot: '',
    }),

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

  movePane: (tabId, sourcePaneId, targetPaneId, side) => {
    if (sourcePaneId === targetPaneId) return
    const desiredDirection: 'horizontal' | 'vertical' =
      side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
    const sourceFirst = side === 'left' || side === 'top'

    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId)
      if (!tab) return state

      const source = findLeaf(tab.root, sourcePaneId)
      if (!source) return state

      // 1. Remove source from the tree (may collapse a parent split).
      const treeWithoutSource = removeLeaf(tab.root, sourcePaneId)

      // 2. Re-find the target in the new tree (its parent may have changed
      //    if source and target were siblings in the now-collapsed split).
      const target = findLeaf(treeWithoutSource, targetPaneId)
      if (!target) return state

      // 3. Locate the target's direct parent split.
      const parentSplit = findParentSplit(treeWithoutSource, targetPaneId)

      let newRoot: PaneNode

      if (parentSplit && parentSplit.direction === desiredDirection) {
        // Same orientation: insert source into the existing split.
        const targetIndex = parentSplit.children.findIndex((c) => c.id === targetPaneId)
        const insertIndex = sourceFirst ? targetIndex : targetIndex + 1
        const newChildren = [...parentSplit.children]
        newChildren.splice(insertIndex, 0, { ...source, size: 1 })
        // Normalize to equal sizes for predictable layout.
        const equalized = newChildren.map((c) => ({ ...c, size: 1 }))
        newRoot = replaceNode(treeWithoutSource, parentSplit.id, {
          ...parentSplit,
          children: equalized,
        })
      } else {
        // Different orientation: wrap source + target in a fresh split.
        const newSplit: SplitNode = {
          type: 'split',
          id: `split_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          direction: desiredDirection,
          size: 1,
          children: sourceFirst
            ? [{ ...source, size: 1 }, { ...target, size: 1 }]
            : [{ ...target, size: 1 }, { ...source, size: 1 }],
        }
        newRoot = replaceNode(treeWithoutSource, targetPaneId, newSplit)
      }

      const newTabs = state.tabs.map((t) =>
        t.id === tabId
          ? { ...t, root: newRoot, activePaneId: sourcePaneId, title: deriveTitle(newRoot) }
          : t,
      )
      return { tabs: newTabs }
    })
  },

  launchWorkspace: (layout, workspaceId, workspaceName) => {
    // Accept both the wrapped { tabs: [...] } form and a bare array (legacy).
    const savedTabs = (Array.isArray(layout)
      ? layout
      : (layout as WorkspaceLayout).tabs) as Array<{ title: string; root: PaneNode }>
    const newTabs: TerminalTab[] = savedTabs.map((savedTab) => {
      const root = regenerateNodeIds(savedTab.root)
      return {
        id: `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        root,
        activePaneId: firstLeafId(root),
        isActive: false,
        title: savedTab.title || deriveTitle(root),
        activePresetId: null,
        activePresetName: null,
        savedPresetSnapshot: '',
        presetDirty: false,
      }
    })

    set(() => {
      const tabs = newTabs.map((t, i) => ({ ...t, isActive: i === 0 }))
      return {
        tabs,
        activeTabId: tabs.length > 0 ? tabs[0].id : null,
        // Track which workspace these tabs came from and seed the snapshot so
        // the freshly-launched state is not considered dirty.
        activeWorkspaceId: workspaceId ?? null,
        activeWorkspaceName: workspaceName ?? null,
        isDirty: false,
        savedSnapshot: computeSnapshot(newTabs),
      }
    })

    // Collect every leaf that references a host and reconnect it.
    newTabs.forEach((tab) => {
      const leaves: LeafNode[] = []
      const collect = (node: PaneNode) => {
        if (node.type === 'leaf') {
          leaves.push(node)
        } else {
          node.children.forEach(collect)
        }
      }
      collect(tab.root)
      leaves.forEach((leaf) => {
        if (leaf.hostId) {
          get().connectPane(tab.id, leaf.id, leaf.hostId, leaf.hostName, {
            hostAddress: leaf.hostAddress,
            hostPort: leaf.hostPort,
            hostUsername: leaf.hostUsername,
          })
        }
      })
    })
  },

  saveCurrentWorkspace: async () => {
    const { activeWorkspaceId, tabs } = get()
    if (!activeWorkspaceId) return
    const payload = serializeWorkspaceLayout(tabs)
    if (payload.tabs.length === 0) return
    try {
      const deviceId = await getDeviceId()
      await invoke('update_workspace', {
        id: activeWorkspaceId,
        workspace: { userId: getUserId(), name: '', layout: JSON.stringify({ tabs: payload.tabs }), hostIds: payload.hostIds },
        deviceId,
      })
      await triggerSync()
      set({ isDirty: false, savedSnapshot: computeSnapshot(tabs) })
    } catch (e) {
      console.error('Failed to save workspace:', e)
    }
  },

  saveAsNewWorkspace: async (name, vaultId) => {
    const { tabs } = get()
    const payload = serializeWorkspaceLayout(tabs)
    if (payload.tabs.length === 0) return
    try {
      const deviceId = await getDeviceId()
      const result = await invoke<any>('create_workspace', {
        workspace: { userId: getUserId(), name, layout: JSON.stringify({ tabs: payload.tabs }), hostIds: payload.hostIds, vaultId },
        deviceId,
      })
      await triggerSync()
      set({
        activeWorkspaceId: result.id,
        activeWorkspaceName: name,
        isDirty: false,
        savedSnapshot: computeSnapshot(tabs),
      })
      if (vaultId) useWorkspaceStore.getState().fetchWorkspaces(vaultId)
    } catch (e) {
      console.error('Failed to save workspace as new:', e)
    }
  },
}))

// Mark the active workspace dirty whenever the tab layout changes (excluding
// the launch itself, which seeds savedSnapshot in the same set() call).
useTerminalStore.subscribe((state, prev) => {
  if (state.tabs === prev.tabs) return
  if (!state.activeWorkspaceId) return
  if (state.isDirty) return
  if (computeSnapshot(state.tabs) !== state.savedSnapshot) {
    useTerminalStore.setState({ isDirty: true })
  }
})
