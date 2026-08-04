import { create } from "zustand";
import type { FileItem } from "@/types/sftp/sftpTypes";
import {
  type DropSide,
  findFirstLeafId,
  findLeaf as findLeafUtil,
  recomputeSizes as recomputeSizesUtil,
  removeNode,
  replaceNode,
  sideToDirection,
  sourceFirstFromSide,
} from "@/lib/common/treeUtils";

export interface SftpLeafNode {
  type: "leaf";
  id: string;
  connectionType: "host" | "local" | null;
  hostId?: string;
  hostName?: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  localPath?: string;
  size: number;
}

export interface SftpSplitNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  children: SftpPaneNode[];
  size: number;
}

export type SftpPaneNode = SftpLeafNode | SftpSplitNode;

export const findLeaf = findLeafUtil;

export interface FileDragState {
  isDragging: boolean;
  sourcePaneId: string | null;
  sourceHostId?: string | null;
  sourceDirect?: { host?: string; port?: number; username?: string };
  files: FileItem[];
}

export interface PendingFileDrop {
  paneId?: string;
  files: FileItem[];
  destPaneId?: string;
  sourceHostId?: string;
  destHostId?: string;
  destDirPath?: string;
  sourceDirect?: { host?: string; port?: number; username?: string };
  sourcePaneId?: string;
}

export interface TransferItem {
  id: string;
  fileName: string;
  localPath?: string;
  remotePath?: string;
  direction: "upload" | "download";
  status: "pending" | "active" | "complete" | "error";
  progress: number;
  size: number;
  transferred: number;
  speed?: number;
  error?: string;
}

interface SftpState {
  root: SftpPaneNode | null;
  activePaneId: string | null;
  focusedPaneId: string | null;
  fileDragState: FileDragState | null;
  pendingFileDrop: PendingFileDrop | null;
  transfers: TransferItem[];
  clipboard: {
    paths: string[];
    hostId: string;
    sourceDirect?: { host?: string; port?: number; username?: string };
  } | null;
  clipboardMode: "copy" | "cut" | null;
  refreshRequests: Record<string, number>;

  addPane: (leaf: SftpLeafNode) => void;
  removePane: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  setFocusedPane: (paneId: string | null) => void;
  setFileDragState: (state: FileDragState | null) => void;
  setPendingFileDrop: (drop: PendingFileDrop | null) => void;
  movePane: (
    sourcePaneId: string,
    targetPaneId: string,
    side: "left" | "right" | "top" | "bottom",
  ) => void;
  splitPane: (paneId: string, direction: "horizontal" | "vertical") => void;
  connectLocal: (paneId: string, localPath: string) => void;
  connectHost: (
    paneId: string,
    hostId: string,
    hostName: string,
    hostAddress?: string,
    hostPort?: number,
    hostUsername?: string,
  ) => void;
  setPaneSizes: (splitId: string, sizes: number[]) => void;
  addTransfer: (transfer: TransferItem) => void;
  updateTransfer: (id: string, data: Partial<TransferItem>) => void;
  removeTransfer: (id: string) => void;
  clearCompletedTransfers: () => void;
  setClipboard: (
    hostId: string,
    paths: string[],
    mode: "copy" | "cut",
    sourceDirect?: { host?: string; port?: number; username?: string },
  ) => void;
  clearClipboard: () => void;
  requestRefresh: (paneId: string) => void;
}

let sftpPaneCounter = 0;
function nextSftpPaneId() {
  return `sftp-pane-${++sftpPaneCounter}-${Date.now()}`;
}

function makeEmptySftpLeaf(): SftpLeafNode {
  return {
    type: "leaf",
    id: nextSftpPaneId(),
    connectionType: null,
    size: 100,
  };
}

export const useSftpStore = create<SftpState>((set, get) => ({
  root: null,
  activePaneId: null,
  focusedPaneId: null,
  fileDragState: null,
  pendingFileDrop: null,
  transfers: [],
  clipboard: null,
  clipboardMode: null,
  refreshRequests: {},

  addPane: (leaf) => {
    const root = get().root;
    if (!root) {
      set({ root: leaf, activePaneId: leaf.id });
      return;
    }
    const split: SftpSplitNode = {
      type: "split",
      id: nextSftpPaneId(),
      direction: "horizontal",
      children: [
        { ...root, size: 50 },
        { ...leaf, size: 50 },
      ],
      size: 100,
    };
    set({ root: split, activePaneId: leaf.id });
  },

  removePane: (paneId) => {
    const root = get().root;
    if (!root) return;
    const newRoot = removeNode(root, paneId);
    if (!newRoot) {
      const fresh = makeEmptySftpLeaf();
      set({ root: fresh, activePaneId: fresh.id, focusedPaneId: null });
      return;
    }
    set({
      root: recomputeSizesUtil(newRoot),
      activePaneId:
        get().activePaneId === paneId
          ? findFirstLeafId(newRoot)
          : get().activePaneId,
      focusedPaneId:
        get().focusedPaneId === paneId ? null : get().focusedPaneId,
    });
  },

  setActivePane: (paneId) => set({ activePaneId: paneId }),
  setFocusedPane: (paneId) => set({ focusedPaneId: paneId }),
  setFileDragState: (state) => set({ fileDragState: state }),
  setPendingFileDrop: (drop) => set({ pendingFileDrop: drop }),

  movePane: (sourcePaneId, targetPaneId, side) => {
    const root = get().root;
    if (!root) return;
    const sourceLeaf = findLeafUtil(root, sourcePaneId);
    if (!sourceLeaf) return;
    const withoutSource = removeNode(root, sourcePaneId);
    if (!withoutSource) return;
    const targetLeaf = findLeafUtil(withoutSource, targetPaneId);
    if (!targetLeaf) return;
    const direction = sideToDirection(side as DropSide);
    const sourceFirst = sourceFirstFromSide(side as DropSide);
    const newSplit: SftpSplitNode = {
      type: "split",
      id: nextSftpPaneId(),
      direction,
      children: sourceFirst
        ? [
            { ...sourceLeaf, size: 50 },
            { ...targetLeaf, size: 50 },
          ]
        : [
            { ...targetLeaf, size: 50 },
            { ...sourceLeaf, size: 50 },
          ],
      size: targetLeaf.size,
    };
    set({
      root: replaceNode(withoutSource, targetPaneId, newSplit),
      activePaneId: sourceLeaf.id,
    });
  },

  splitPane: (paneId, direction) => {
    const root = get().root;
    if (!root) return;
    const leaf = findLeafUtil(root, paneId);
    if (!leaf) return;
    const newLeaf = makeEmptySftpLeaf();
    const split: SftpSplitNode = {
      type: "split",
      id: nextSftpPaneId(),
      direction,
      children: [
        { ...leaf, size: 50 },
        { ...newLeaf, size: 50 },
      ],
      size: leaf.size,
    };
    set({
      root: replaceNode(root, paneId, split),
      activePaneId: newLeaf.id,
    });
  },

  connectLocal: (paneId, localPath) => {
    const root = get().root;
    if (!root) return;
    const leaf = findLeafUtil(root, paneId);
    if (!leaf) return;
    set({
      root: replaceNode(root, paneId, {
        ...leaf,
        connectionType: "local",
        localPath,
      }),
    });
  },

  connectHost: (
    paneId,
    hostId,
    hostName,
    hostAddress,
    hostPort,
    hostUsername,
  ) => {
    const root = get().root;
    if (!root) return;
    const leaf = findLeafUtil(root, paneId);
    if (!leaf) return;
    set({
      root: replaceNode(root, paneId, {
        ...leaf,
        connectionType: "host",
        hostId,
        hostName,
        hostAddress,
        hostPort,
        hostUsername,
      }),
    });
  },

  setPaneSizes: (splitId, sizes) => {
    const root = get().root;
    if (!root) return;
    function apply(node: SftpPaneNode): SftpPaneNode {
      if (node.type === "leaf") return node;
      if (node.id === splitId) {
        return {
          ...node,
          children: node.children.map((c, i) => ({
            ...c,
            size: sizes[i] ?? c.size,
          })),
        };
      }
      return { ...node, children: node.children.map(apply) };
    }
    set({ root: apply(root) });
  },

  addTransfer: (transfer) =>
    set((s) => ({ transfers: [...s.transfers, transfer] })),
  updateTransfer: (id, data) =>
    set((s) => ({
      transfers: s.transfers.map((t) => (t.id === id ? { ...t, ...data } : t)),
    })),
  removeTransfer: (id) =>
    set((s) => ({ transfers: s.transfers.filter((t) => t.id !== id) })),
  clearCompletedTransfers: () =>
    set((s) => ({
      transfers: s.transfers.filter((t) => t.status !== "complete"),
    })),
  setClipboard: (hostId, paths, mode, sourceDirect) =>
    set({ clipboard: { paths, hostId, sourceDirect }, clipboardMode: mode }),
  clearClipboard: () => set({ clipboard: null, clipboardMode: null }),
  requestRefresh: (paneId) =>
    set((s) => ({
      refreshRequests: {
        ...s.refreshRequests,
        [paneId]: (s.refreshRequests[paneId] ?? 0) + 1,
      },
    })),
}));
