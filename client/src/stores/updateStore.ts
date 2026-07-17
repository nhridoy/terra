import { create } from 'zustand'

interface UpdateState {
  updateAvailable: boolean
  updateInfo: {
    version: string
    notes: string
    date: string
  } | null
  downloading: boolean
  downloadProgress: number
  error: string | null
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
}

export const useUpdateStore = create<UpdateState>((set) => ({
  updateAvailable: false,
  updateInfo: null,
  downloading: false,
  downloadProgress: 0,
  error: null,

  checkForUpdates: async () => {
    try {
      // Tauri updater - only available in Tauri context
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update) {
          set({
            updateAvailable: true,
            updateInfo: {
              version: update.version,
              notes: update.body || '',
              date: update.date || new Date().toISOString(),
            },
          })
        } else {
          set({ updateAvailable: false, updateInfo: null })
        }
      }
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  downloadUpdate: async () => {
    set({ downloading: true, downloadProgress: 0, error: null })

    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (update) {
          let downloaded = 0
          let contentLength = 0

          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength || 0
                break
              case 'Progress': {
                downloaded += event.data.chunkLength || 0
                const progress =
                  contentLength > 0
                    ? Math.round((downloaded / contentLength) * 100)
                    : 0
                set({ downloadProgress: progress })
                break
              }
              case 'Finished':
                set({ downloading: false, downloadProgress: 100 })
                break
            }
          })
        }
      }
    } catch (error) {
      set({ downloading: false, error: (error as Error).message })
    }
  },

  installUpdate: async () => {
    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      }
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },
}))
