import { useCallback, useState } from 'react'
import {
  base64ToBuffer,
  bufferToBase64,
  bufferToString,
  decryptSecret,
  deriveKey,
  encryptSecret,
  generateNonce,
  generateSalt,
  initSodium,
  stringToBuffer,
} from '../../../shared/utils/encryption'
import { useVaultStore } from '../stores/vaultStore'

interface VaultData {
  hosts?: any[]
  keys?: any[]
  snippets?: any[]
  [key: string]: any
}

export function useVault() {
  const {
    vaults,
    currentVaultId,
    isUnlocked,
    decryptedData,
    isLoading,
    error,
    fetchVaults,
    createVault,
    updateVault,
    deleteVault,
    switchVault,
    unlockVault,
    lockVault,
    clearError,
  } = useVaultStore()

  const [decryptError, setDecryptError] = useState<string | null>(null)
  const [derivedKey, setDerivedKey] = useState<Uint8Array | null>(null)

  const selectedVault = vaults.find((v) => v.id === currentVaultId) || null

  const ensureInitialized = useCallback(async () => {
    await initSodium()
  }, [])

  const deriveEncryptionKey = useCallback(
    async (password: string, salt: string): Promise<Uint8Array> => {
      await ensureInitialized()
      const saltBytes = base64ToBuffer(salt)
      return deriveKey(password, saltBytes)
    },
    [ensureInitialized],
  )

  const decryptVault = useCallback(
    async (password: string): Promise<VaultData | null> => {
      if (!selectedVault) {
        setDecryptError('No vault selected')
        return null
      }

      setDecryptError(null)
      try {
        await ensureInitialized()

        const key = await deriveEncryptionKey(password, selectedVault.salt || '')
        setDerivedKey(key)

        const decryptedBytes = await decryptSecret(
          {
            ciphertext: selectedVault.encryptedData || '',
            nonce: selectedVault.iv || '',
          },
          key,
        )

        const decryptedJson = bufferToString(decryptedBytes)
        const vaultData: VaultData = JSON.parse(decryptedJson)

        unlockVault(password)

        return vaultData
      } catch (err: any) {
        setDecryptError(err.message || 'Failed to decrypt vault')
        return null
      }
    },
    [selectedVault, ensureInitialized, deriveEncryptionKey, unlockVault],
  )

  const encryptData = useCallback(
    async (
      data: VaultData,
      password: string,
      existingSalt?: string,
    ): Promise<{ encryptedData: string; iv: string; salt: string } | null> => {
      setDecryptError(null)
      try {
        await ensureInitialized()

        const salt = existingSalt || bufferToBase64(generateSalt())
        const key = await deriveEncryptionKey(password, salt)

        const plaintext = stringToBuffer(JSON.stringify(data))
        const nonce = generateNonce()
        const encrypted = await encryptSecret(plaintext, nonce, key)

        return {
          encryptedData: encrypted.ciphertext,
          iv: encrypted.nonce,
          salt: salt,
        }
      } catch (err: any) {
        setDecryptError(err.message || 'Failed to encrypt data')
        return null
      }
    },
    [ensureInitialized, deriveEncryptionKey],
  )

  const saveToVault = useCallback(
    async (data: VaultData, password: string): Promise<boolean> => {
      if (!selectedVault) {
        setDecryptError('No vault selected')
        return false
      }

      setDecryptError(null)
      try {
        const encrypted = await encryptData(data, password, selectedVault.salt)
        if (!encrypted) return false

        await updateVault(selectedVault.id, {
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          salt: encrypted.salt,
        })

        return true
      } catch (err: any) {
        setDecryptError(err.message || 'Failed to save to vault')
        return false
      }
    },
    [selectedVault, encryptData, updateVault],
  )

  const createNewVault = useCallback(
    async (
      name: string,
      description: string | undefined,
      password: string,
    ): Promise<boolean> => {
      setDecryptError(null)
      try {
        const emptyData: VaultData = {
          hosts: [],
          keys: [],
          snippets: [],
        }

        const encrypted = await encryptData(emptyData, password)
        if (!encrypted) return false

        await createVault(name, description)

        return true
      } catch (err: any) {
        setDecryptError(err.message || 'Failed to create vault')
        return false
      }
    },
    [encryptData, createVault],
  )

  const changeVaultPassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<boolean> => {
      if (!selectedVault) {
        setDecryptError('No vault selected')
        return false
      }

      setDecryptError(null)
      try {
        const data = await decryptVault(oldPassword)
        if (!data) return false

        const newSalt = bufferToBase64(generateSalt())
        const encrypted = await encryptData(data, newPassword, newSalt)
        if (!encrypted) return false

        await updateVault(selectedVault.id, {
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          salt: encrypted.salt,
        })

        return true
      } catch (err: any) {
        setDecryptError(err.message || 'Failed to change vault password')
        return false
      }
    },
    [selectedVault, decryptVault, encryptData, updateVault],
  )

  const encryptField = useCallback(
    async (
      value: string,
      password: string,
    ): Promise<{ encrypted: string; iv: string; salt: string }> => {
      await ensureInitialized()

      const salt = bufferToBase64(generateSalt())
      const key = await deriveEncryptionKey(password, salt)
      const plaintext = stringToBuffer(value)
      const nonce = generateNonce()
      const encrypted = await encryptSecret(plaintext, nonce, key)

      return {
        encrypted: encrypted.ciphertext,
        iv: encrypted.nonce,
        salt: salt,
      }
    },
    [ensureInitialized, deriveEncryptionKey],
  )

  const decryptField = useCallback(
    async (
      encrypted: string,
      iv: string,
      salt: string,
      password: string,
    ): Promise<string> => {
      await ensureInitialized()

      const key = await deriveEncryptionKey(password, salt)
      const decrypted = await decryptSecret(
        {
          ciphertext: encrypted,
          nonce: iv,
        },
        key,
      )

      return bufferToString(decrypted)
    },
    [ensureInitialized, deriveEncryptionKey],
  )

  return {
    vaults,
    selectedVault,
    isUnlocked,
    decryptedData,
    isLoading,
    error,
    decryptError,
    derivedKey,
    fetchVaults,
    createNewVault,
    updateVault,
    deleteVault,
    switchVault,
    decryptVault,
    encryptData,
    saveToVault,
    lockVault,
    changeVaultPassword,
    encryptField,
    decryptField,
    clearError,
  }
}
