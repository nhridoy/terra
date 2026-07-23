import { create } from "zustand";
import type { FileItem } from "../lib/sftpTypes";
import {
  findAllLeaves as findAllLeavesUtil,
  findLeaf as findLeafUtil,
} from "../lib/treeUtils";

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
export const findAllLeaves = findAllLeavesUtil;

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
  panes: SftpPaneNode[];
  activePaneId: string | null;
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

export const useSftpStore = create<SftpState>((set, get) => ({
  root: null,
  panes: [],
  activePaneId: null,
  fileDragState: { isDragging: false, sourcePaneId: null, files: [] },
  pendingFileDrop: null,
  transfers: [],
  clipboard: null,
  clipboardMode: null,
  refreshRequests: {},

  addPane: () => {},
  removePane: () => {},
  setActivePane: (paneId) => set({ activePaneId: paneId }),
  setFileDragState: (state) => set({ fileDragState: state }),
  setPendingFileDrop: (drop) => set({ pendingFileDrop: drop }),
  movePane: () => {},
  splitPane: () => {},
  connectLocal: () => {},
  connectHost: () => {},
  setPaneSizes: () => {},
  addTransfer: (transfer) => set({ transfers: [...get().transfers, transfer] }),
  updateTransfer: (id, data) =>
    set({
      transfers: get().transfers.map((t) =>
        t.id === id ? { ...t, ...data } : t,
      ),
    }),
  removeTransfer: (id) =>
    set({ transfers: get().transfers.filter((t) => t.id !== id) }),
  clearCompletedTransfers: () =>
    set({
      transfers: get().transfers.filter((t) => t.status !== "complete"),
    }),
  setClipboard: (hostId, paths, mode, sourceDirect) =>
    set({ clipboard: { paths, hostId, sourceDirect }, clipboardMode: mode }),
  clearClipboard: () => set({ clipboard: null, clipboardMode: null }),
  requestRefresh: (paneId) =>
    set({
      refreshRequests: {
        ...get().refreshRequests,
        [paneId]: (get().refreshRequests[paneId] ?? 0) + 1,
      },
    }),
}));
