import { invoke } from '@tauri-apps/api/core'

let cachedDeviceId: string | null = null

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId
  cachedDeviceId = await invoke<string>('get_device_id')
  return cachedDeviceId
}

export async function setUserId(userId: string): Promise<void> {
  await invoke('set_user_id', { userId })
}

export async function setEncryptionKey(key: string): Promise<void> {
  await invoke('set_encryption_key', { key })
}
