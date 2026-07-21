import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'

export interface PortForward {
  id: string
  sessionId: string
  localPort: number
  remoteHost: string
  remotePort: number
  active: boolean
}

interface PortForwardingState {
  forwards: PortForward[]
  isLoading: boolean
  error: string | null

  loadForwards: () => Promise<void>
  startForward: (
    sessionId: string,
    localPort: number,
    remoteHost: string,
    remotePort: number,
  ) => Promise<PortForward>
  stopForward: (forwardId: string) => Promise<void>
  toggleForward: (forwardId: string) => Promise<void>
  clearError: () => void
}

export const usePortForwardingStore = create<PortForwardingState>(
  (set, get) => ({
    forwards: [],
    isLoading: false,
    error: null,

    loadForwards: async () => {
      set({ isLoading: true, error: null })
      try {
        const result = await invoke<PortForward[]>('port_forward_list')
        set({ forwards: result || [], isLoading: false })
      } catch (error) {
        console.error('Failed to load port forwards:', error)
        set({
          isLoading: false,
          error:
            error instanceof Error ? error.message : 'Failed to load forwards',
        })
      }
    },

    startForward: async (sessionId, localPort, remoteHost, remotePort) => {
      set({ error: null })
      try {
        const result = await invoke<PortForward>('port_forward_start', {
          sessionId,
          config: { localPort, remoteHost, remotePort },
        })
        set((state) => ({ forwards: [...state.forwards, result] }))
        return result
      } catch (error) {
        console.error('Failed to start forward:', error)
        const message =
          error instanceof Error ? error.message : 'Failed to start forward'
        set({ error: message })
        throw new Error(message)
      }
    },

    stopForward: async (forwardId) => {
      set({ error: null })
      try {
        await invoke('port_forward_stop', { forwardId })
        set((state) => ({
          forwards: state.forwards.filter((f) => f.id !== forwardId),
        }))
      } catch (error) {
        console.error('Failed to stop forward:', error)
        set({
          error:
            error instanceof Error ? error.message : 'Failed to stop forward',
        })
      }
    },

    toggleForward: async (forwardId) => {
      const { forwards } = get()
      const forward = forwards.find((f) => f.id === forwardId)
      if (!forward) return

      set({ error: null })
      try {
        if (forward.active) {
          await invoke('port_forward_stop', { forwardId })
          set((state) => ({
            forwards: state.forwards.map((f) =>
              f.id === forwardId ? { ...f, active: false } : f,
            ),
          }))
        } else {
          const result = await invoke<PortForward>('port_forward_start', {
            sessionId: forward.sessionId,
            config: {
              localPort: forward.localPort,
              remoteHost: forward.remoteHost,
              remotePort: forward.remotePort,
            },
          })
          set((state) => ({
            forwards: state.forwards.map((f) =>
              f.id === forwardId ? { ...result, active: true } : f,
            ),
          }))
        }
      } catch (error) {
        console.error('Failed to toggle forward:', error)
        set({
          error:
            error instanceof Error ? error.message : 'Failed to toggle forward',
        })
      }
    },

    clearError: () => set({ error: null }),
  }),
)
