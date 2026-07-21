import { useCallback } from 'react'
import {
  decryptField,
  decryptObject,
  encryptField,
  encryptObject,
  isUnlocked,
} from '../lib/crypto'

const ENCRYPTED_FIELDS = {
  host: ['password', 'privateKey', 'passphrase'],
  keychain: ['data'],
  snippet: ['command'],
  workspace: ['layout'],
  tabGroup: ['tabs'],
}

export function useVault() {
  const encryptHost = useCallback(async (host: Record<string, unknown>) => {
    return encryptObject(host, ENCRYPTED_FIELDS.host)
  }, [])

  const decryptHost = useCallback(async (host: Record<string, unknown>) => {
    return decryptObject(host, ENCRYPTED_FIELDS.host)
  }, [])

  const encryptKey = useCallback(async (key: Record<string, unknown>) => {
    return encryptObject(key, ENCRYPTED_FIELDS.keychain)
  }, [])

  const decryptKey = useCallback(async (key: Record<string, unknown>) => {
    return decryptObject(key, ENCRYPTED_FIELDS.keychain)
  }, [])

  const encryptSnippet = useCallback(
    async (snippet: Record<string, unknown>) => {
      return encryptObject(snippet, ENCRYPTED_FIELDS.snippet)
    },
    [],
  )

  const decryptSnippet = useCallback(
    async (snippet: Record<string, unknown>) => {
      return decryptObject(snippet, ENCRYPTED_FIELDS.snippet)
    },
    [],
  )

  const encryptWorkspace = useCallback(
    async (workspace: Record<string, unknown>) => {
      return encryptObject(workspace, ENCRYPTED_FIELDS.workspace)
    },
    [],
  )

  const decryptWorkspace = useCallback(
    async (workspace: Record<string, unknown>) => {
      return decryptObject(workspace, ENCRYPTED_FIELDS.workspace)
    },
    [],
  )

  const encryptTabGroup = useCallback(
    async (tabGroup: Record<string, unknown>) => {
      return encryptObject(tabGroup, ENCRYPTED_FIELDS.tabGroup)
    },
    [],
  )

  const decryptTabGroup = useCallback(
    async (tabGroup: Record<string, unknown>) => {
      return decryptObject(tabGroup, ENCRYPTED_FIELDS.tabGroup)
    },
    [],
  )

  return {
    isUnlocked,
    encryptHost,
    decryptHost,
    encryptKey,
    decryptKey,
    encryptSnippet,
    decryptSnippet,
    encryptWorkspace,
    decryptWorkspace,
    encryptTabGroup,
    decryptTabGroup,
    encryptField,
    decryptField,
  }
}
