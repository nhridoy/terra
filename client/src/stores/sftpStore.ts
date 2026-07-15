import { create } from 'zustand'
import type { TransferItem } from '../lib/sftpTypes'

// ---- Node types ----

export interface SftpLeafNode {
  type: 'leaf'
  id: string
  connectionType: 'host' | 'local' | null
  hostId?: string
  hostName?: string
  hostAddress?: string
  hostPort?: number
  hostUsername?: string
  localPath?: string
  size: number
}

export interface SftpSplitNode {
  type: 'split'
  id: string
  direction: 'horizontal' | 'vertical'
  children: SftpPaneNode[]
  size: number
}

export type SftpPaneNode = SftpLeafNode | SftpSplitNode

// ---- Pure tree helpers ----

let _counter = 0
function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${++_counter}`
}

function makeLeaf(partial: Partial<SftpLeafNode> & { id: string }): SftpLeafNode {
  return {
    type: 'leaf',
    id: partial.id,
    connectionType: partial.connectionType ?? null,
    hostId: partial.hostId,
    hostName: partial.hostName,
    hostAddress: partial.hostAddress,
    hostPort: partial.hostPort,
    hostUsername: partial.hostUsername,
    localPath: partial.localPath,
    size: partial.size ?? 1,
  }
}

export function findLeaf(node: SftpPaneNode, paneId: string): SftpLeafNode | null {
  if (node.type === 'leaf') return node.id === paneId ? node : null
  for (const child of node.children) {
    const found = findLeaf(child, paneId)
    if (found) return found
  }
  return null
}

function findSplit(node: SftpPaneNode, splitId: string): SftpSplitNode | null {
  if (node.type === 'split') {
    if (node.id === splitId) return node
    for (const c of node.children) {
      const found = findSplit(c, splitId)
      if (found) return found
    }
  }
  return null
}

function replaceNode(node: SftpPaneNode, id: string, replacement: SftpPaneNode): SftpPaneNode {
  if (node.id === id) return replacement
  if (node.type === 'split') {
    return { ...node, children: node.children.map((c) => replaceNode(c, id, replacement)) }
  }
  return node
}

function removeLeaf(node: SftpPaneNode, paneId: string): SftpPaneNode {
  if (node.type === 'leaf') return node
  const directIdx = node.children.findIndex((c) => c.type === 'leaf' && c.id === paneId)
  if (directIdx !== -1) {
    const remaining = node.children.filter((_, i) => i !== directIdx)
    if (remaining.length === 1) return remaining[0]
    return { ...node, children: remaining }
  }
  return { ...node, children: node.children.map((c) => removeLeaf(c, paneId)) }
}

function countLeaves(node: SftpPaneNode): number {
  if (node.type === 'leaf') return 1
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
}

function mapSplitChildren(node: SftpPaneNode, splitId: string, children: SftpPaneNode[]): SftpPaneNode {
  if (node.type === 'split') {
    if (node.id === splitId) return { ...node, children }
    return { ...node, children: node.children.map((c) => mapSplitChildren(c, splitId, children)) }
  }
  return node
}

// ---- Store ----

interface ClipboardEntry {
  hostId: string
  paths: string[]
}

interface SftpState {
  root: SftpPaneNode
  activePaneId: string | null
  transfers: TransferItem[]
  clipboard: ClipboardEntry | null
  clipboardMode: 'copy' | 'cut' | null

  splitPane: (paneId: string, direction: 'horizontal' | 'vertical') => void
  removePane: (paneId: string) => void
  setActivePane: (paneId: string) => void
  setPaneSizes: (splitId: string, sizes: number[]) => void
  movePane: (sourcePaneId: string, targetPaneId: string, side: 'left' | 'right' | 'top' | 'bottom') => void
  connectHost: (paneId: string, hostId: string, hostName: string, options?: { hostAddress?: string; hostPort?: number; hostUsername?: string }) => void
  connectLocal: (paneId: string, path: string) => void
  disconnectPane: (paneId: string) => void
  addTransfer: (transfer: TransferItem) => void
  updateTransfer: (id: string, updates: Partial<TransferItem>) => void
  removeTransfer: (id: string) => void
  clearCompletedTransfers: () => void
  setClipboard: (hostId: string, paths: string[], mode: 'copy' | 'cut') => void
  clearClipboard: () => void
}

// Two horizontal panes by default
const initialRoot: SftpPaneNode = {
  type: 'split',
  id: 'sftp_root',
  direction: 'horizontal',
  size: 1,
  children: [
    makeLeaf({ id: uid('sftp_pane'), size: 1 }),
    makeLeaf({ id: uid('sftp_pane'), size: 1 }),
  ],
}

export const useSftpStore = create<SftpState>((set, get) => ({
  root: initialRoot,
  activePaneId: findFirstLeafId(initialRoot),
  transfers: [],
  clipboard: null,
  clipboardMode: null,

  splitPane: (paneId, direction) => {
    const newId = uid('sftp_pane')
    const newLeaf = makeLeaf({ id: newId, size: 1 })
    set({
      root: (() => {
        const leaf = findLeaf(get().root, paneId)
        if (!leaf) return get().root
        const splitNode: SftpSplitNode = {
          type: 'split',
          id: uid('sftp_split'),
          direction,
          size: 1,
          children: [{ ...leaf, size: 1 }, newLeaf],
        }
        return replaceNode(get().root, paneId, splitNode)
      })(),
      activePaneId: newId,
    })
  },

  removePane: (paneId) => {
    const { root, activePaneId } = get()
    if (countLeaves(root) <= 1) return // keep at least one pane
    const newRoot = removeLeaf(root, paneId)
    const newActive = activePaneId === paneId ? findFirstLeafId(newRoot) : activePaneId
    set({ root: newRoot, activePaneId: newActive })
  },

  setActivePane: (paneId) => set({ activePaneId: paneId }),

  setPaneSizes: (splitId, sizes) => {
    set({
      root: (() => {
        const split = findSplit(get().root, splitId)
        if (!split) return get().root
        const children = split.children.map((c, i) => ({ ...c, size: sizes[i] ?? c.size }))
        return mapSplitChildren(get().root, splitId, children)
      })(),
    })
  },

  movePane: (sourcePaneId, targetPaneId, side) => {
    if (sourcePaneId === targetPaneId) return
    const { root } = get()
    const sourceLeaf = findLeaf(root, sourcePaneId)
    if (!sourceLeaf) return

    // Determine split direction from side
    const direction: 'horizontal' | 'vertical' = side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
    const sourceCopy = { ...sourceLeaf }

    // Remove source from tree
    let newRoot = removeLeaf(root, sourcePaneId)
    // If removing source collapsed a split, the target might be gone — bail
    const targetLeaf = findLeaf(newRoot, targetPaneId)
    if (!targetLeaf) {
      set({ root: get().root })
      return
    }

    // Wrap target + source in new split
    const newSplit: SftpSplitNode = {
      type: 'split',
      id: uid('sftp_split'),
      direction,
      size: 1,
      children:
        side === 'left' || side === 'top'
          ? [sourceCopy, { ...targetLeaf, size: 1 }]
          : [{ ...targetLeaf, size: 1 }, sourceCopy],
    }
    newRoot = replaceNode(newRoot, targetPaneId, newSplit)
    set({ root: newRoot, activePaneId: sourceCopy.id })
  },

  connectHost: (paneId, hostId, hostName, options) => {
    set({
      root: (() => {
        const leaf = findLeaf(get().root, paneId)
        if (!leaf) return get().root
        return replaceNode(get().root, paneId, {
          ...leaf,
          connectionType: 'host',
          hostId,
          hostName,
          hostAddress: options?.hostAddress,
          hostPort: options?.hostPort,
          hostUsername: options?.hostUsername,
        })
      })(),
    })
  },

  connectLocal: (paneId, path) => {
    set({
      root: (() => {
        const leaf = findLeaf(get().root, paneId)
        if (!leaf) return get().root
        return replaceNode(get().root, paneId, {
          ...leaf,
          connectionType: 'local',
          hostName: 'Local',
          localPath: path,
        })
      })(),
    })
  },

  disconnectPane: (paneId) => {
    set({
      root: (() => {
        const leaf = findLeaf(get().root, paneId)
        if (!leaf) return get().root
        return replaceNode(get().root, paneId, {
          ...leaf,
          connectionType: null,
          hostId: undefined,
          hostName: undefined,
          hostAddress: undefined,
          hostPort: undefined,
          hostUsername: undefined,
          localPath: undefined,
        })
      })(),
    })
  },

  addTransfer: (transfer) => {
    set({ transfers: [...get().transfers, transfer] })
  },

  updateTransfer: (id, updates) => {
    set({
      transfers: get().transfers.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })
  },

  removeTransfer: (id) => {
    set({ transfers: get().transfers.filter((t) => t.id !== id) })
  },

  clearCompletedTransfers: () => {
    set({ transfers: get().transfers.filter((t) => t.status !== 'complete' && t.status !== 'error') })
  },

  setClipboard: (hostId, paths, mode) => {
    set({ clipboard: { hostId, paths }, clipboardMode: mode })
  },

  clearClipboard: () => {
    set({ clipboard: null, clipboardMode: null })
  },
}))

function findFirstLeafId(node: SftpPaneNode): string | null {
  if (node.type === 'leaf') return node.id
  for (const c of node.children) {
    const id = findFirstLeafId(c)
    if (id) return id
  }
  return null
}
