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
}

export const useDragStore = create<DragState>((set) => ({
  dropPane: null,
  setDropPane: (p) => set({ dropPane: p }),
}))
