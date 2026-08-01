import { create } from "zustand";

export type DropSide = "left" | "right" | "top" | "bottom";

interface DropPane {
  tabId: string;
  paneId: string;
  side: DropSide;
}

interface DragState {
  dropPane: DropPane | null;
  setDropPane: (p: DropPane | null) => void;
  draggedTabId: string | null;
  setDraggedTabId: (id: string | null) => void;
  draggedPaneId: string | null;
  setDraggedPaneId: (id: string | null) => void;
  sourcePane: { tabId: string; paneId: string } | null;
  setSourcePane: (pane: { tabId: string; paneId: string } | null) => void;
  editorViewDrop: {
    viewId: string;
    side: DropSide;
  } | null;
  setEditorViewDrop: (drop: { viewId: string; side: DropSide } | null) => void;
}

export const useDragStore = create<DragState>((set) => ({
  dropPane: null,
  setDropPane: (p) => set({ dropPane: p }),
  draggedTabId: null,
  setDraggedTabId: (id) => set({ draggedTabId: id }),
  draggedPaneId: null,
  setDraggedPaneId: (id) => set({ draggedPaneId: id }),
  sourcePane: null,
  setSourcePane: (pane) => set({ sourcePane: pane }),
  editorViewDrop: null,
  setEditorViewDrop: (drop) => set({ editorViewDrop: drop }),
}));
