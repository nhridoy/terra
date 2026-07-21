import { invoke } from '@tauri-apps/api/core'

let masterKey: string | null = null
let masterSalt: string | null = null
let currentUserId: string | null = null

function saltKey(userId: string): string {
  return `masterSalt:${userId}`
}

export function setCurrentUser(userId: string | null): void {
  currentUserId = userId
}

export async function setupMasterPassword(password: string): Promise<string> {
  const salt = await invoke<string>('generate_salt')
  const key = await invoke<string>('derive_key', { password, saltHex: salt })
  masterKey = key
  masterSalt = salt
  if (currentUserId) {
    localStorage.setItem(saltKey(currentUserId), salt)
  }
  return key
}

export async function unlockMasterPassword(
  password: string,
  saltHex: string,
): Promise<string> {
  const key = await invoke<string>('derive_key', { password, saltHex })
  masterKey = key
  masterSalt = saltHex
  if (currentUserId) {
    localStorage.setItem(saltKey(currentUserId), saltHex)
  }
  return key
}

export function getMasterKey(): string | null {
  return masterKey
}

export function getMasterSalt(): string | null {
  return masterSalt
}

export function getStoredSalt(userId: string): string | null {
  return localStorage.getItem(saltKey(userId))
}

export function lockMasterPassword(): void {
  masterKey = null
  masterSalt = null
}

export function clearMasterSalt(userId: string): void {
  localStorage.removeItem(saltKey(userId))
}

export function isUnlocked(): boolean {
  return masterKey !== null
}

export interface EncryptedData {
  ciphertext: string
  nonce: string
}

export async function encryptField(plaintext: string): Promise<string> {
  if (!masterKey) throw new Error('Master password not unlocked')
  const result = await invoke<EncryptedData>('encrypt', {
    plaintext,
    keyHex: masterKey,
  })
  return JSON.stringify(result)
}

export async function decryptField(encryptedJson: string): Promise<string> {
  if (!masterKey) throw new Error('Master password not unlocked')
  try {
    const data: EncryptedData = JSON.parse(encryptedJson)
    return await invoke<string>('decrypt', {
      ciphertextHex: data.ciphertext,
      nonceHex: data.nonce,
      keyHex: masterKey,
    })
  } catch {
    return encryptedJson
  }
}

export async function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): Promise<T> {
  const result = { ...obj }
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string' && value && !isEncrypted(value)) {
      result[field] = (await encryptField(value)) as T[keyof T]
    }
  }
  return result
}

export async function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): Promise<T> {
  const result = { ...obj }
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string' && value && isEncrypted(value)) {
      result[field] = (await decryptField(value)) as T[keyof T]
    }
  }
  return result
}

export function isEncrypted(value: string): boolean {
  try {
    const data = JSON.parse(value)
    return typeof data.ciphertext === 'string' && typeof data.nonce === 'string'
  } catch {
    return false
  }
}

export interface RecoveryKit {
  version: number
  encrypted_key: EncryptedData
  salt: string
  created_at: string
}

export async function generateRecoveryKit(
  password: string,
): Promise<RecoveryKit> {
  if (!masterKey) throw new Error('Master password not unlocked')
  return invoke<RecoveryKit>('generate_recovery_kit', {
    keyHex: masterKey,
    password,
  })
}

export async function recoverFromKit(
  kitJson: string,
  password: string,
): Promise<string> {
  return invoke<string>('recover_from_kit', { kitJson, password })
}
