import { create } from "zustand";
import {
  type DropSide,
  findAllLeaves,
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

export interface EditorViewLeafNode {
  type: "leaf";
  id: string;
  size: number;
}

export interface EditorViewSplitNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  children: EditorViewNode[];
  size: number;
}

export type EditorViewNode = EditorViewLeafNode | EditorViewSplitNode;

export const findLeaf = findLeafUtil;

interface EditorState {
  root: EditorPaneNode | null;
  activePaneId: string | null;
  focusedPaneId: string | null;
  viewTrees: Record<string, EditorViewNode | null>;
  activeView: Record<string, string>;
  openFiles: Record<string, EditorOpenFile[]>;
  activeFile: Record<string, string | null>;
  previewFile: Record<string, string | null>;

  addPane: (leaf: EditorLeafNode) => void;
  removePane: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  setFocusedPane: (paneId: string | null) => void;
  openFile: (
    paneId: string,
    path: string,
    name: string,
    isPreview?: boolean,
  ) => void;
  closeFile: (paneId: string, path: string) => void;
  closeFileInAllViews: (paneId: string, path: string) => void;
  makeFilePermanent: (paneId: string, path: string) => void;
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

  splitView: (
    paneId: string,
    viewId: string,
    direction: "horizontal" | "vertical",
  ) => void;
  removeView: (paneId: string, viewId: string) => void;
  setActiveView: (paneId: string, viewId: string) => void;
  setViewSizes: (paneId: string, splitId: string, sizes: number[]) => void;
  openFileInView: (
    paneId: string,
    viewId: string,
    path: string,
    name: string,
    isPreview?: boolean,
  ) => void;
  closeFileInView: (paneId: string, viewId: string, path: string) => void;
  setActiveFileInView: (viewId: string, path: string | null) => void;
  makeFilePermanentInView: (viewId: string, path: string) => void;
  setFileOrder: (viewId: string, ordered: EditorOpenFile[]) => void;
  moveFileToView: (
    paneId: string,
    sourceViewId: string,
    targetViewId: string,
    path: string,
    name: string,
    side?: DropSide | null,
  ) => void;
}

let editorPaneCounter = 0;
function nextEditorPaneId() {
  return `editor-pane-${++editorPaneCounter}-${Date.now()}`;
}

let editorViewCounter = 0;
function nextEditorViewId() {
  return `editor-view-${++editorViewCounter}-${Date.now()}`;
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

function viewIdsForPane(
  viewTrees: Record<string, EditorViewNode | null>,
  paneId: string,
): string[] {
  const tree = viewTrees[paneId];
  if (!tree) return [paneId];
  return [paneId, ...findAllLeaves(tree).map((l) => l.id)];
}

export function activeViewIdFor(
  viewTrees: Record<string, EditorViewNode | null>,
  activeView: Record<string, string>,
  paneId: string,
): string {
  const tree = viewTrees[paneId];
  if (!tree) return paneId;
  const active = activeView[paneId];
  if (active && findLeafUtil(tree, active)) return active;
  return findFirstLeafId(tree) ?? paneId;
}

export function useActiveViewId(paneId: string): string {
  const viewTrees = useEditorStore((s) => s.viewTrees);
  const activeView = useEditorStore((s) => s.activeView);
  return activeViewIdFor(viewTrees, activeView, paneId);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  root: null,
  activePaneId: null,
  focusedPaneId: null,
  viewTrees: {},
  activeView: {},
  openFiles: {},
  activeFile: {},
  previewFile: {},

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
    const viewIds = viewIdsForPane(get().viewTrees, paneId);
    const clearMaps = <T>(map: Record<string, T>): Record<string, T> => {
      const next = { ...map };
      for (const id of viewIds) delete next[id];
      return next;
    };
    const newRoot = removeNode(root, paneId);
    if (!newRoot) {
      const fresh = makeEmptyEditorLeaf();
      set({
        root: fresh,
        activePaneId: fresh.id,
        focusedPaneId: null,
        viewTrees: withoutKey(get().viewTrees, paneId),
        activeView: withoutKey(get().activeView, paneId),
        openFiles: clearMaps(get().openFiles),
        activeFile: clearMaps(get().activeFile),
        previewFile: clearMaps(get().previewFile),
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
      viewTrees: withoutKey(get().viewTrees, paneId),
      activeView: withoutKey(get().activeView, paneId),
      openFiles: clearMaps(get().openFiles),
      activeFile: clearMaps(get().activeFile),
      previewFile: clearMaps(get().previewFile),
    });
  },

  setActivePane: (paneId) => set({ activePaneId: paneId }),
  setFocusedPane: (paneId) => set({ focusedPaneId: paneId }),

  openFile: (paneId, path, name, isPreview = false) => {
    const viewId = activeViewIdFor(get().viewTrees, get().activeView, paneId);
    get().openFileInView(paneId, viewId, path, name, isPreview);
  },

  closeFile: (paneId, path) => {
    const viewId = activeViewIdFor(get().viewTrees, get().activeView, paneId);
    get().closeFileInView(paneId, viewId, path);
  },

  closeFileInAllViews: (paneId, path) => {
    const viewTrees = get().viewTrees;
    const ids = viewIdsForPane(viewTrees, paneId);
    const openFiles = { ...get().openFiles };
    const activeFile = { ...get().activeFile };
    const previewFile = { ...get().previewFile };
    for (const viewId of ids) {
      const list = openFiles[viewId] ?? [];
      if (!list.some((f) => f.path === path)) continue;
      const next = list.filter((f) => f.path !== path);
      if (activeFile[viewId] === path) {
        const idx = list.findIndex((f) => f.path === path);
        activeFile[viewId] = next[idx]?.path ?? next[idx - 1]?.path ?? null;
      }
      if (previewFile[viewId] === path) previewFile[viewId] = null;
      openFiles[viewId] = next;
    }
    set({ openFiles, activeFile, previewFile });
  },

  makeFilePermanent: (paneId, path) => {
    const viewId = activeViewIdFor(get().viewTrees, get().activeView, paneId);
    get().makeFilePermanentInView(viewId, path);
  },

  setActiveFile: (paneId, path) => {
    const viewId = activeViewIdFor(get().viewTrees, get().activeView, paneId);
    get().setActiveFileInView(viewId, path);
  },

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

  splitView: (paneId, viewId, direction) => {
    const existing =
      get().viewTrees[paneId] ??
      ({
        type: "leaf",
        id: paneId,
        size: 100,
      } as EditorViewNode);
    const leaf = findLeafUtil(existing, viewId);
    if (!leaf) return;
    const newLeaf: EditorViewLeafNode = {
      type: "leaf",
      id: nextEditorViewId(),
      size: 50,
    };
    const split: EditorViewSplitNode = {
      type: "split",
      id: nextEditorViewId(),
      direction,
      children: [{ ...leaf, size: 50 }, newLeaf],
      size: leaf.size,
    };
    set({
      viewTrees: {
        ...get().viewTrees,
        [paneId]: replaceNode(existing, viewId, split),
      },
      activeView: { ...get().activeView, [paneId]: newLeaf.id },
    });
  },

  removeView: (paneId, viewId) => {
    const tree = get().viewTrees[paneId];
    if (!tree) return;
    const removed = removeNode(tree, viewId);
    if (!removed) return;
    const leaves = findAllLeaves(removed);
    const cleanedOpen: Record<string, EditorOpenFile[]> = {
      ...get().openFiles,
    };
    const cleanedActive: Record<string, string | null> = {
      ...get().activeFile,
    };
    const cleanedPreview: Record<string, string | null> = {
      ...get().previewFile,
    };
    const activeView = { ...get().activeView };
    for (const l of leaves) {
      delete cleanedOpen[l.id];
      delete cleanedActive[l.id];
      delete cleanedPreview[l.id];
      if (activeView[paneId] === l.id) {
        activeView[paneId] = findFirstLeafId(removed) ?? paneId;
      }
    }
    set({
      viewTrees: { ...get().viewTrees, [paneId]: removed },
      activeView,
      openFiles: cleanedOpen,
      activeFile: cleanedActive,
      previewFile: cleanedPreview,
    });
  },

  setActiveView: (paneId, viewId) =>
    set({ activeView: { ...get().activeView, [paneId]: viewId } }),

  setViewSizes: (paneId, splitId, sizes) => {
    const tree = get().viewTrees[paneId];
    if (!tree) return;
    function apply(node: EditorViewNode): EditorViewNode {
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
    set({
      viewTrees: { ...get().viewTrees, [paneId]: apply(tree) },
    });
  },

  openFileInView: (paneId, viewId, path, name, isPreview = false) => {
    const existing = get().openFiles[viewId] ?? [];
    const currentPreview = get().previewFile[viewId] ?? null;

    if (existing.some((f) => f.path === path)) {
      set({
        activeFile: { ...get().activeFile, [viewId]: path },
        previewFile: {
          ...get().previewFile,
          [viewId]: isPreview ? currentPreview : null,
        },
        activeView: { ...get().activeView, [paneId]: viewId },
      });
      return;
    }

    let next = [...existing, { path, name }];
    let preview = currentPreview;

    if (isPreview) {
      if (currentPreview && currentPreview !== path) {
        next = next.filter((f) => f.path !== currentPreview);
      }
      preview = path;
    } else {
      preview = null;
    }

    set({
      openFiles: { ...get().openFiles, [viewId]: next },
      activeFile: { ...get().activeFile, [viewId]: path },
      previewFile: { ...get().previewFile, [viewId]: preview },
      activeView: { ...get().activeView, [paneId]: viewId },
    });
  },

  closeFileInView: (paneId, viewId, path) => {
    const list = get().openFiles[viewId] ?? [];
    const next = list.filter((f) => f.path !== path);
    let active = get().activeFile[viewId] ?? null;
    if (active === path) {
      const idx = list.findIndex((f) => f.path === path);
      active = next[idx]?.path ?? next[idx - 1]?.path ?? null;
    }
    const preview =
      get().previewFile[viewId] === path ? null : get().previewFile[viewId];
    set({
      openFiles: { ...get().openFiles, [viewId]: next },
      activeFile: { ...get().activeFile, [viewId]: active },
      previewFile: { ...get().previewFile, [viewId]: preview },
      activeView: { ...get().activeView, [paneId]: viewId },
    });
  },

  setActiveFileInView: (viewId, path) =>
    set({ activeFile: { ...get().activeFile, [viewId]: path } }),

  makeFilePermanentInView: (viewId, path) => {
    if (get().previewFile[viewId] !== path) return;
    set({
      previewFile: { ...get().previewFile, [viewId]: null },
    });
  },

  setFileOrder: (viewId, ordered) =>
    set({ openFiles: { ...get().openFiles, [viewId]: ordered } }),

  moveFileToView: (
    paneId,
    sourceViewId,
    targetViewId,
    path,
    name,
    side = null,
  ) => {
    const sourceList = get().openFiles[sourceViewId] ?? [];
    if (!sourceList.some((f) => f.path === path)) return;
    const targetList = get().openFiles[targetViewId] ?? [];

    const existing = get().viewTrees[paneId];
    const tree: EditorViewNode = existing ?? {
      type: "leaf",
      id: paneId,
      size: 100,
    };
    const targetLeaf = findLeafUtil(tree, targetViewId);
    if (!targetLeaf) return;

    let resolvedTarget = targetViewId;
    let nextTree = tree;

    if (side && !existing) {
      const newLeaf: EditorViewLeafNode = {
        type: "leaf",
        id: nextEditorViewId(),
        size: 50,
      };
      const direction = sideToDirection(side);
      const sourceFirst = sourceFirstFromSide(side);
      const split: EditorViewSplitNode = {
        type: "split",
        id: nextEditorViewId(),
        direction,
        children: sourceFirst
          ? [newLeaf, { ...targetLeaf, size: 50 }]
          : [{ ...targetLeaf, size: 50 }, newLeaf],
        size: targetLeaf.size,
      };
      nextTree = replaceNode(tree, targetViewId, split);
      resolvedTarget = newLeaf.id;
    }

    const nextSource = sourceList.filter((f) => f.path !== path);
    const nextTarget = targetList.some((f) => f.path === path)
      ? targetList
      : [...targetList, { path, name }];

    set({
      viewTrees:
        nextTree === tree
          ? get().viewTrees
          : { ...get().viewTrees, [paneId]: nextTree },
      openFiles: {
        ...get().openFiles,
        [sourceViewId]: nextSource,
        [resolvedTarget]: nextTarget,
      },
      activeFile: {
        ...get().activeFile,
        [sourceViewId]:
          get().activeFile[sourceViewId] === path
            ? (nextSource[0]?.path ?? null)
            : get().activeFile[sourceViewId],
        [resolvedTarget]: path,
      },
      previewFile: {
        ...get().previewFile,
        [sourceViewId]:
          get().previewFile[sourceViewId] === path
            ? null
            : get().previewFile[sourceViewId],
        [resolvedTarget]:
          get().previewFile[resolvedTarget] === path
            ? get().previewFile[resolvedTarget]
            : null,
      },
      activeView: { ...get().activeView, [paneId]: resolvedTarget },
    });
  },
}));
