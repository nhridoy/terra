import { invoke } from '@tauri-apps/api/core'

let syncTimer: ReturnType<typeof setInterval> | null = null

export function triggerSync() {
  invoke('sync_push').catch(() => {})
}

export function startPeriodicSync(intervalMs = 10000, onPull?: () => void) {
  stopPeriodicSync()
  syncTimer = setInterval(() => {
    invoke('sync_pull')
      .then(() => onPull?.())
      .catch(() => {})
  }, intervalMs)
}

export function stopPeriodicSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}
