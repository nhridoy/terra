import { create } from "zustand";
import {
  type DropSide,
  findFirstLeafId,
  findLeaf as findLeafUtil,
  recomputeSizes as recomputeSizesUtil,
  removeNode,
  replaceNode,
  sideToDirection,
  sourceFirstFromSide,
} from "../lib/treeUtils";

export interface EditorLeafNode {
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

export interface EditorSplitNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  children: EditorPaneNode[];
  size: number;
}

export type EditorPaneNode = EditorLeafNode | EditorSplitNode;

export interface EditorOpenFile {
  path: string;
  name: string;
}

export const findLeaf = findLeafUtil;

interface EditorState {
  root: EditorPaneNode | null;
  activePaneId: string | null;
  focusedPaneId: string | null;
  openFiles: Record<string, EditorOpenFile[]>;
  activeFile: Record<string, string | null>;

  addPane: (leaf: EditorLeafNode) => void;
  removePane: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  setFocusedPane: (paneId: string | null) => void;
  openFile: (paneId: string, path: string, name: string) => void;
  closeFile: (paneId: string, path: string) => void;
  setActiveFile: (paneId: string, path: string | null) => void;
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
}

let editorPaneCounter = 0;
function nextEditorPaneId() {
  return `editor-pane-${++editorPaneCounter}-${Date.now()}`;
}

function makeEmptyEditorLeaf(): EditorLeafNode {
  return {
    type: "leaf",
    id: nextEditorPaneId(),
    connectionType: null,
    size: 100,
  };
}

function withoutKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  const next = { ...map };
  delete next[key];
  return next;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  root: null,
  activePaneId: null,
  focusedPaneId: null,
  openFiles: {},
  activeFile: {},

  addPane: (leaf) => {
    const root = get().root;
    if (!root) {
      set({ root: leaf, activePaneId: leaf.id });
      return;
    }
    const split: EditorSplitNode = {
      type: "split",
      id: nextEditorPaneId(),
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
      const fresh = makeEmptyEditorLeaf();
      set({
        root: fresh,
        activePaneId: fresh.id,
        focusedPaneId: null,
        openFiles: withoutKey(get().openFiles, paneId),
        activeFile: withoutKey(get().activeFile, paneId),
      });
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
      openFiles: withoutKey(get().openFiles, paneId),
      activeFile: withoutKey(get().activeFile, paneId),
    });
  },

  setActivePane: (paneId) => set({ activePaneId: paneId }),
  setFocusedPane: (paneId) => set({ focusedPaneId: paneId }),

  openFile: (paneId, path, name) => {
    const existing = get().openFiles[paneId] ?? [];
    if (existing.some((f) => f.path === path)) {
      set({ activeFile: { ...get().activeFile, [paneId]: path } });
      return;
    }
    set({
      openFiles: {
        ...get().openFiles,
        [paneId]: [...existing, { path, name }],
      },
      activeFile: { ...get().activeFile, [paneId]: path },
    });
  },

  closeFile: (paneId, path) => {
    const list = get().openFiles[paneId] ?? [];
    const next = list.filter((f) => f.path !== path);
    let active = get().activeFile[paneId] ?? null;
    if (active === path) {
      const idx = list.findIndex((f) => f.path === path);
      active = next[idx]?.path ?? next[idx - 1]?.path ?? null;
    }
    set({
      openFiles: { ...get().openFiles, [paneId]: next },
      activeFile: { ...get().activeFile, [paneId]: active },
    });
  },

  setActiveFile: (paneId, path) =>
    set({ activeFile: { ...get().activeFile, [paneId]: path } }),

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
    const newSplit: EditorSplitNode = {
      type: "split",
      id: nextEditorPaneId(),
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
    const newLeaf = makeEmptyEditorLeaf();
    const split: EditorSplitNode = {
      type: "split",
      id: nextEditorPaneId(),
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
    function apply(node: EditorPaneNode): EditorPaneNode {
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
}));
