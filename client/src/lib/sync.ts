import { invoke } from '@tauri-apps/api/core'
import { getAccessToken, getApiUrl, getRefreshToken } from './auth'

let syncTimeout: ReturnType<typeof setTimeout> | null = null
let periodicInterval: ReturnType<typeof setInterval> | null = null
let isSyncing = false

const DEBOUNCE_MS = 2000
const DEFAULT_PULL_INTERVAL = 30000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

const TABLES = [
  'hosts',
  'groups',
  'vaults',
  'keychain',
  'snippets',
  'workspaces',
  'tab_groups',
  'settings',
]

export async function syncPull(): Promise<void> {
  if (isSyncing) return
  isSyncing = true
  try {
    const apiUrl = await getApiUrl()
    const token = await getAccessToken()
    const refreshToken = await getRefreshToken()
    if (!apiUrl || !token || !refreshToken) return

    const userJson = localStorage.getItem('user')
    const user = userJson ? JSON.parse(userJson) : null
    if (!user?.id) return

    await invoke('sync_pull', {
      apiUrl,
      token,
      userId: user.id,
    })
  } catch (err) {
    console.error('sync_pull failed:', err)
  } finally {
    isSyncing = false
  }
}

export async function syncPush(
  table: string,
  records: unknown[],
): Promise<Array<{ id: string; status: string; operation: string }> | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const apiUrl = await getApiUrl()
      const token = await getAccessToken()
      if (!apiUrl || !token || !records.length) return null

      const response = await invoke<{
        results: Array<{ id: string; status: string; operation: string }>
      }>('sync_push', {
        apiUrl,
        token,
        table,
        records,
      })

      return response.results
    } catch (err) {
      console.error(`sync_push attempt ${attempt + 1} failed:`, err)
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
      }
    }
  }
  return null
}

export async function triggerSync(): Promise<void> {
  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(async () => {
    await pushUnsynced()
  }, DEBOUNCE_MS)
}

async function pushUnsynced(): Promise<void> {
  let hasConflicts = false
  for (const table of TABLES) {
    try {
      const records = await invoke<unknown[]>('get_unsynced_records', {
        table,
      })
      if (records.length > 0) {
        const results = await syncPush(table, records)
        if (results) {
          await invoke('process_sync_result', { table, results })
          if (results.some((r) => r.status === 'conflict')) {
            hasConflicts = true
          }
        }
      }
    } catch (err) {
      console.error(`push_unsynced ${table} failed:`, err)
    }
  }
  if (hasConflicts) {
    await syncPull()
  }
}

export function startPeriodicSync(
  interval: number = DEFAULT_PULL_INTERVAL,
): void {
  stopPeriodicSync()
  periodicInterval = setInterval(async () => {
    await syncPull()
    await pushUnsynced()
  }, interval)
}

export function stopPeriodicSync(): void {
  if (periodicInterval) {
    clearInterval(periodicInterval)
    periodicInterval = null
  }
}
