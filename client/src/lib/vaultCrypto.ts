import { invoke } from '@tauri-apps/api/core'
import { decryptObject, encryptObject, isEncrypted, isUnlocked } from './crypto'

const HOST_CREDENTIAL_FIELDS = ['password', 'privateKey', 'passphrase'] as const
const KEYCHAIN_CREDENTIAL_FIELDS = ['encryptedPrivateKey'] as const

export async function encryptHostCredentials<T extends Record<string, unknown>>(
  host: T,
): Promise<T> {
  if (!isUnlocked()) throw new Error('Vault is locked')
  return encryptObject(host, HOST_CREDENTIAL_FIELDS)
}

export async function decryptHostCredentials<T extends Record<string, unknown>>(
  host: T,
): Promise<T> {
  if (!isUnlocked()) return host
  return decryptObject(host, HOST_CREDENTIAL_FIELDS)
}

export async function encryptKeyCredentials<T extends Record<string, unknown>>(
  key: T,
): Promise<T> {
  if (!isUnlocked()) throw new Error('Vault is locked')
  return encryptObject(key, KEYCHAIN_CREDENTIAL_FIELDS)
}

export async function decryptKeyCredentials<T extends Record<string, unknown>>(
  key: T,
): Promise<T> {
  if (!isUnlocked()) return key
  return decryptObject(key, KEYCHAIN_CREDENTIAL_FIELDS)
}

function getUserId(): string {
  try {
    const raw = localStorage.getItem('user')
    if (raw) return JSON.parse(raw).id || ''
  } catch {}
  return ''
}

function hasPlaintextCredential(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && !isEncrypted(value)
}

/**
 * One-time migration: encrypt any plaintext credentials stored in local SQLite.
 * Called after the master password is unlocked. Scans all hosts and keychain
 * entries, encrypts any unencrypted credential fields in-place.
 */
export async function migratePlaintextCredentials(): Promise<void> {
  if (!isUnlocked()) return
  const userId = getUserId()
  if (!userId) return

  try {
    // Migrate host credentials
    const hosts = await invoke<Array<Record<string, unknown>>>(
      'get_all_hosts_with_credentials',
      { userId },
    )
    for (const host of hosts) {
      let changed = false
      const payload: Record<string, unknown> = { ...host }

      for (const field of HOST_CREDENTIAL_FIELDS) {
        const value = host[field]
        if (hasPlaintextCredential(value)) {
          payload[field] = value
          changed = true
        }
      }

      if (changed) {
        const encrypted = await encryptHostCredentials(payload)
        await invoke('update_host', { id: host.id, host: encrypted })
      }
    }

    // Migrate keychain credentials
    const keys = await invoke<Array<Record<string, unknown>>>(
      'get_all_keys_with_credentials',
      { userId },
    )
    for (const key of keys) {
      const value = key.encryptedPrivateKey
      if (hasPlaintextCredential(value)) {
        const encrypted = await encryptKeyCredentials({ ...key })
        await invoke('update_key', { id: key.id, key: encrypted })
      }
    }
  } catch (err) {
    console.error('Credential migration failed:', err)
  }
}
