import { create } from 'zustand'

export type DropSide = 'left' | 'right' | 'top' | 'bottom'

interface DropPane {
  tabId: string
  paneId: string
  side: DropSide
}

interface DragState {
  dropPane: DropPane | null
  setDropPane: (p: DropPane | null) => void

  // Set when a pane (within a tab) is being dragged for reordering.
  sourcePaneId: string | null
  sourceTabId: string | null
  setSourcePane: (paneId: string | null, tabId: string | null) => void
}

export const useDragStore = create<DragState>((set) => ({
  dropPane: null,
  setDropPane: (p) => set({ dropPane: p }),

  sourcePaneId: null,
  sourceTabId: null,
  setSourcePane: (paneId, tabId) =>
    set({ sourcePaneId: paneId, sourceTabId: tabId }),
}))
