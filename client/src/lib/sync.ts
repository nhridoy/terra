import { invoke } from '@tauri-apps/api/core'

let syncTimer: ReturnType<typeof setInterval> | null = null

export async function triggerSync() {
  await invoke('sync_full').catch(() => {})
}

export function startPeriodicSync(intervalMs = 10000, onSync?: () => void) {
  stopPeriodicSync()
  syncTimer = setInterval(async () => {
    await invoke('sync_full')
    onSync?.()
  }, intervalMs)
}

export function stopPeriodicSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}
