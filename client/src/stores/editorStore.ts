import { create } from "zustand";
import {
  type DropSide,
  findAllLeaves,
  findFirstLeafId,
  findLeaf as findLeafUtil,
  removeNode,
  replaceNode,
  sideToDirection,
  sourceFirstFromSide,
} from "../lib/treeUtils";

export const ROOT_VIEW_ID = "editor-view-root";

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
  connectionType: "host" | "local" | null;
  hostId?: string;
  hostName?: string;
  hostAddress?: string;
  hostPort?: number;
  hostUsername?: string;
  localPath?: string;

  viewTrees: EditorViewNode | null;
  activeView: string | null;
  openFiles: Record<string, EditorOpenFile[]>;
  activeFile: Record<string, string | null>;
  previewFile: Record<string, string | null>;

  connectLocal: (localPath: string) => void;
  connectHost: (
    hostId: string,
    hostName: string,
    hostAddress?: string,
    hostPort?: number,
    hostUsername?: string,
  ) => void;
  disconnect: () => void;

  openFile: (path: string, name: string, isPreview?: boolean) => void;
  closeFile: (path: string) => void;
  closeFileEverywhere: (path: string) => void;
  makeFilePermanent: (path: string) => void;
  setActiveFile: (path: string | null) => void;

  splitView: (viewId: string, direction: "horizontal" | "vertical") => void;
  removeView: (viewId: string) => void;
  setActiveView: (viewId: string) => void;
  setViewSizes: (splitId: string, sizes: number[]) => void;
  openFileInView: (
    viewId: string,
    path: string,
    name: string,
    isPreview?: boolean,
  ) => void;
  closeFileInView: (viewId: string, path: string) => void;
  setActiveFileInView: (viewId: string, path: string | null) => void;
  makeFilePermanentInView: (viewId: string, path: string) => void;
  setFileOrder: (viewId: string, ordered: EditorOpenFile[]) => void;
  moveFileToView: (
    sourceViewId: string,
    targetViewId: string,
    path: string,
    name: string,
    side?: DropSide | null,
  ) => void;
}

let editorViewCounter = 0;
function nextEditorViewId() {
  return `editor-view-${++editorViewCounter}-${Date.now()}`;
}

function withoutKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  const next = { ...map };
  delete next[key];
  return next;
}

export function activeViewIdFor(
  viewTrees: EditorViewNode | null,
  activeView: string | null,
): string {
  if (!viewTrees) return ROOT_VIEW_ID;
  if (activeView && findLeafUtil(viewTrees, activeView)) return activeView;
  return findFirstLeafId(viewTrees) ?? ROOT_VIEW_ID;
}

export function useActiveViewId(): string {
  const viewTrees = useEditorStore((s) => s.viewTrees);
  const activeView = useEditorStore((s) => s.activeView);
  return activeViewIdFor(viewTrees, activeView);
}

function resetViews() {
  return {
    viewTrees: null as EditorViewNode | null,
    activeView: null,
    openFiles: {} as Record<string, EditorOpenFile[]>,
    activeFile: {} as Record<string, string | null>,
    previewFile: {} as Record<string, string | null>,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  connectionType: null,
  viewTrees: null,
  activeView: null,
  openFiles: {},
  activeFile: {},
  previewFile: {},

  connectLocal: (localPath) =>
    set({ connectionType: "local", localPath, ...resetViews() }),

  connectHost: (hostId, hostName, hostAddress, hostPort, hostUsername) =>
    set({
      connectionType: "host",
      hostId,
      hostName,
      hostAddress,
      hostPort,
      hostUsername,
      ...resetViews(),
    }),

  disconnect: () => set({ connectionType: null, ...resetViews() }),

  openFile: (path, name, isPreview = false) => {
    const viewId = activeViewIdFor(get().viewTrees, get().activeView);
    get().openFileInView(viewId, path, name, isPreview);
  },

  closeFile: (path) => {
    const viewId = activeViewIdFor(get().viewTrees, get().activeView);
    get().closeFileInView(viewId, path);
  },

  closeFileEverywhere: (path) => {
    const viewTrees = get().viewTrees;
    const ids = viewTrees
      ? [ROOT_VIEW_ID, ...findAllLeaves(viewTrees).map((l) => l.id)]
      : [ROOT_VIEW_ID];
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

  makeFilePermanent: (path) => {
    const viewId = activeViewIdFor(get().viewTrees, get().activeView);
    get().makeFilePermanentInView(viewId, path);
  },

  setActiveFile: (path) => {
    const viewId = activeViewIdFor(get().viewTrees, get().activeView);
    get().setActiveFileInView(viewId, path);
  },

  splitView: (viewId, direction) => {
    const existing =
      get().viewTrees ??
      ({
        type: "leaf",
        id: ROOT_VIEW_ID,
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
      viewTrees: replaceNode(existing, viewId, split),
      activeView: newLeaf.id,
    });
  },

  removeView: (viewId) => {
    const tree = get().viewTrees;
    if (!tree) return;
    const removed = removeNode(tree, viewId);
    if (!removed) return;
    const leaves = findAllLeaves(removed);
    const cleanedOpen = withoutKey(get().openFiles, viewId);
    const cleanedActive = withoutKey(get().activeFile, viewId);
    const cleanedPreview = withoutKey(get().previewFile, viewId);
    const nextTree =
      leaves.length === 1 && leaves[0].id === ROOT_VIEW_ID ? null : removed;
    set({
      viewTrees: nextTree,
      activeView:
        get().activeView === viewId
          ? nextTree
            ? (findFirstLeafId(nextTree) ?? ROOT_VIEW_ID)
            : ROOT_VIEW_ID
          : get().activeView,
      openFiles: cleanedOpen,
      activeFile: cleanedActive,
      previewFile: cleanedPreview,
    });
  },

  setActiveView: (viewId) => set({ activeView: viewId }),

  setViewSizes: (splitId, sizes) => {
    const tree = get().viewTrees;
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
    set({ viewTrees: apply(tree) });
  },

  openFileInView: (viewId, path, name, isPreview = false) => {
    const existing = get().openFiles[viewId] ?? [];
    const currentPreview = get().previewFile[viewId] ?? null;

    if (existing.some((f) => f.path === path)) {
      set({
        activeFile: { ...get().activeFile, [viewId]: path },
        previewFile: {
          ...get().previewFile,
          [viewId]: isPreview ? currentPreview : null,
        },
        activeView: viewId,
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
      activeView: viewId,
    });
  },

  closeFileInView: (viewId, path) => {
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
      activeView: viewId,
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

  moveFileToView: (sourceViewId, targetViewId, path, name, side = null) => {
    const sourceList = get().openFiles[sourceViewId] ?? [];
    if (!sourceList.some((f) => f.path === path)) {
      console.warn("[moveFileToView] source file not found", {
        sourceViewId,
        targetViewId,
        path,
      });
      return;
    }
    const targetList = get().openFiles[targetViewId] ?? [];

    const tree: EditorViewNode = get().viewTrees ?? {
      type: "leaf",
      id: ROOT_VIEW_ID,
      size: 100,
    };
    const targetLeaf = findLeafUtil(tree, targetViewId);
    if (!targetLeaf) {
      console.warn("[moveFileToView] target leaf not found", {
        sourceViewId,
        targetViewId,
        tree,
      });
      return;
    }

    let resolvedTarget = targetViewId;
    let nextTree = tree;

    if (side) {
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
    const nextTarget =
      resolvedTarget !== targetViewId
        ? [{ path, name }]
        : targetList.some((f) => f.path === path)
          ? targetList
          : [...targetList, { path, name }];

    set({
      viewTrees: nextTree === tree ? get().viewTrees : nextTree,
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
      activeView: resolvedTarget,
    });
  },
}));
