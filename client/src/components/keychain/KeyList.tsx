import { Key, Plus, Trash, UploadSimple, X } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getDeviceId } from '../../lib/device'
import { triggerSync } from '../../lib/sync'
import {
  looksLikePrivateKey,
  MAX_PRIVATE_KEY_LENGTH,
  validateDescription,
  validateName,
  validatePrivateKey,
} from '../../lib/validate'
import { useKeyStore } from '../../stores/keyStore'
import { useVaultStore } from '../../stores/vaultStore'
import Modal from '../ui/Modal'

interface KeyItem {
  id: string
  name: string
  description?: string
  keyType: string
  publicKey: string
  fingerprint?: string
  createdAt: string
}

export default function KeyList({ onMutation }: { onMutation?: () => void }) {
  const [keys, setKeys] = useState<KeyItem[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedKey, setSelectedKey] = useState<KeyItem | null>(null)
  const { currentVaultId } = useVaultStore()

  const fetchKeys = useCallback(async () => {
    try {
      const result = await invoke<KeyItem[]>('list_keys', {
        userId: '',
        vaultId: currentVaultId || null,
      })
      setKeys(result || [])
    } catch (error) {
      console.error('Failed to fetch keys:', error)
    }
  }, [currentVaultId])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleDelete = async (id: string) => {
    if (
      await tauriConfirm('Are you sure you want to delete this key?', {
        title: 'Delete Key',
        kind: 'warning',
      })
    ) {
      try {
        const deviceId = await getDeviceId()
        await invoke('delete_key', { id, deviceId })
        await triggerSync()
        setKeys(keys.filter((k) => k.id !== id))
        if (selectedKey?.id === id) {
          setSelectedKey(null)
        }
        onMutation?.()
      } catch (error) {
        console.error('Failed to delete key:', error)
      }
    }
  }

  const getKeyTypeIcon = (keyType: string) => {
    switch (keyType) {
      case 'ed25519':
        return '🔐'
      case 'rsa':
        return '🔑'
      case 'ecdsa':
        return '🗝️'
      default:
        return '🔑'
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Keychain</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-2 py-1 bg-dark-700 hover:bg-dark-600 text-dark-300 text-xs font-medium rounded transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" weight="bold" />
              Import
            </button>
            <button
              type="button"
              onClick={() => setShowGenerateModal(true)}
              className="px-2 py-1 bg-dark-700 hover:bg-dark-600 text-dark-300 text-xs font-medium rounded transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" weight="bold" />
              Generate
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {keys.length === 0 ? (
          <div className="text-center text-dark-400 py-8">
            <Key
              className="w-12 h-12 mx-auto mb-4 text-dark-600"
              weight="bold"
            />
            <p>No SSH keys</p>
            <p className="text-sm mt-2">Import or generate a key</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {keys.map((key) => (
              // biome-ignore lint/a11y/useSemanticElements: contains nested <button> for delete
              <div
                key={key.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setSelectedKey(selectedKey?.id === key.id ? null : key)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedKey(selectedKey?.id === key.id ? null : key)
                  }
                }}
                className={`rounded-lg p-3 cursor-pointer transition-colors group relative ${
                  selectedKey?.id === key.id
                    ? 'bg-primary-600/20 border border-primary-500/50'
                    : 'bg-dark-800/50 hover:bg-dark-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg flex-shrink-0">
                    {getKeyTypeIcon(key.keyType)}
                  </span>
                  <span className="text-white text-sm font-medium truncate">
                    {key.name}
                  </span>
                </div>
                <p className="text-dark-500 text-xs mt-1 ml-[28px] truncate">
                  {key.keyType.toUpperCase()} •{' '}
                  {key.fingerprint || 'No fingerprint'}
                </p>
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(key.id)
                    }}
                    className="p-1 text-dark-400 hover:text-red-500 rounded hover:bg-dark-700"
                    title="Delete key"
                  >
                    <Trash className="w-3 h-3" weight="bold" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedKey && (
        <div className="p-4 border-t border-dark-700 bg-dark-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-medium">
              {selectedKey.name} — Public Key
            </h3>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              className="text-dark-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" weight="bold" />
            </button>
          </div>
          <pre className="bg-dark-900 p-3 rounded-lg text-sm text-dark-300 break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
            {selectedKey.publicKey}
          </pre>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(selectedKey.publicKey)}
            className="mt-2 text-primary-500 hover:text-primary-400 text-sm"
          >
            Copy to clipboard
          </button>
        </div>
      )}

      {showImportModal && (
        <ImportKeyModal
          onClose={() => setShowImportModal(false)}
          onImport={async (key) => {
            await useKeyStore.getState().importKey({
              name: key.name,
              description: key.description,
              keyType: 'ed25519',
              publicKey: key.publicKey || '',
              encryptedPrivateKey: key.encryptedPrivateKey || '',
              fingerprint: key.fingerprint || '',
            })
            setShowImportModal(false)
            onMutation?.()
          }}
        />
      )}

      {showGenerateModal && (
        <GenerateKeyModal
          vaultId={currentVaultId || undefined}
          onClose={(savedKey?: KeyItem) => {
            if (savedKey) {
              setKeys((prev) => [...prev, savedKey])
              onMutation?.()
            }
            setShowGenerateModal(false)
          }}
        />
      )}
    </div>
  )
}

function ImportKeyModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (key: {
    name: string
    description: string
    publicKey: string
    encryptedPrivateKey: string
  }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<'upload' | 'paste'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)

    const MAX_SIZE = 50 * 1024 // 50KB — SSH keys are small
    if (file.size > MAX_SIZE) {
      setError('File too large. SSH key files are typically under 5KB.')
      return
    }

    try {
      const content = await file.text()
      const lowerName = file.name.toLowerCase()
      const lowerContent = content.trim().toLowerCase()

      // PPK files — not yet supported
      if (lowerName.endsWith('.ppk')) {
        setError(
          'PuTTY (.ppk) format is not yet supported. Please convert to OpenSSH format first.',
        )
        return
      }

      // PEM / OpenSSH private key files
      if (
        lowerContent.includes('begin rsa private key') ||
        lowerContent.includes('begin ec private key') ||
        lowerContent.includes('begin ed25519 private key') ||
        lowerContent.includes('begin dsa private key') ||
        lowerContent.includes('begin openssh private key') ||
        lowerContent.includes('begin private key')
      ) {
        setPrivateKey(content)
        if (!name) setName(file.name.replace(/\.(pem|key)$/i, ''))
        setMode('paste')
        return
      }

      // Public key files
      if (
        lowerContent.startsWith('ssh-rsa ') ||
        lowerContent.startsWith('ssh-ed25519 ') ||
        lowerContent.startsWith('ecdsa-sha2-nistp256 ') ||
        lowerContent.startsWith('ecdsa-sha2-nistp384 ') ||
        lowerContent.startsWith('ecdsa-sha2-nistp521 ') ||
        lowerContent.startsWith('ssh-dss ')
      ) {
        setPublicKey(content.trim())
        if (!name) setName(file.name.replace(/\.(pub)$/i, ''))
        setMode('paste')
        return
      }

      setError('Unrecognized key file. Please use a PEM, OpenSSH, or PPK file.')
    } catch (e: unknown) {
      setError(
        `Failed to read file: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const nameErr = validateName(name)
    if (nameErr) {
      setError(nameErr)
      return
    }

    if (description) {
      const descErr = validateDescription(description)
      if (descErr) {
        setError(descErr)
        return
      }
    }

    if (privateKey) {
      const keyErr = validatePrivateKey(privateKey)
      if (keyErr) {
        setError(keyErr)
        return
      }
    }

    if (privateKey && !looksLikePrivateKey(privateKey) && !publicKey) {
      setError(
        'Private key format not recognized. Expected PEM or OpenSSH format.',
      )
      return
    }

    try {
      await onImport({
        name,
        description,
        publicKey,
        encryptedPrivateKey: privateKey,
      })
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : String(e) || 'Failed to import key',
      )
    }
  }

  const switchToUpload = () => {
    setMode('upload')
    setPrivateKey('')
    setPublicKey('')
    setError(null)
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold text-white mb-4">
          Import SSH Key
        </h3>

        {mode === 'upload' ? (
          // biome-ignore lint/a11y/useSemanticElements: drag-and-drop upload zone cannot be a button element
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800'
            }`}
          >
            <UploadSimple
              className="w-10 h-10 mx-auto mb-3 text-dark-400"
              weight="bold"
            />
            <p className="text-dark-300 text-sm">
              Drop a key file here or{' '}
              <span className="text-primary-500">browse</span>
            </p>
            <p className="text-dark-500 text-xs mt-1">
              Supports PEM and OpenSSH formats
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="import-key-name"
                className="block text-dark-300 text-sm mb-2"
              >
                Key Name
              </label>
              <input
                id="import-key-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="My SSH Key"
                required
              />
            </div>
            <div>
              <label
                htmlFor="import-key-description"
                className="block text-dark-300 text-sm mb-2"
              >
                Description (optional)
              </label>
              <input
                id="import-key-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Production server key"
              />
            </div>
            <div>
              <label
                htmlFor="import-key-private"
                className="block text-dark-300 text-sm mb-2"
              >
                Private Key
              </label>
              <textarea
                id="import-key-private"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={4}
                maxLength={MAX_PRIVATE_KEY_LENGTH}
                required
              />
            </div>
            <div>
              <label
                htmlFor="import-key-public"
                className="block text-dark-300 text-sm mb-2"
              >
                Public Key (optional — auto-derived if empty)
              </label>
              <textarea
                id="import-key-public"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                placeholder="ssh-ed25519 AAAA..."
                rows={3}
              />
            </div>
          </form>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pem,.key,.ppk,.pub,.openssh"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
          className="hidden"
        />

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <div className="mt-4">
          {mode === 'upload' ? (
            <button
              type="button"
              onClick={() => setMode('paste')}
              className="text-primary-500 hover:text-primary-400 text-sm"
            >
              or paste key manually
            </button>
          ) : (
            <button
              type="button"
              onClick={switchToUpload}
              className="text-primary-500 hover:text-primary-400 text-sm"
            >
              or upload file instead
            </button>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-dark-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-dark-400 hover:text-white"
          >
            Cancel
          </button>
          {mode === 'paste' && (
            <button
              type="submit"
              onClick={handleSubmit}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
            >
              Import
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function GenerateKeyModal({
  vaultId: _vaultId,
  onClose,
}: {
  vaultId?: string
  onClose: (savedKey?: KeyItem) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keyType, setKeyType] = useState('ed25519')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedPrivKey, _setGeneratedPrivKey] = useState<string | null>(null)
  const [savedKey, _setSavedKey] = useState<KeyItem | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      setError(
        'Key generation is not available in sync-only mode. Use import instead.',
      )
      setIsLoading(false)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : String(err) || 'Failed to generate key',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (generatedPrivKey) {
      await navigator.clipboard.writeText(generatedPrivKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (generatedPrivKey) {
    return (
      <Modal onClose={() => onClose(savedKey || undefined)}>
        <div className="bg-dark-900 rounded-xl p-6 w-full max-w-lg">
          <h3 className="text-xl font-semibold text-white mb-2">
            Key Generated Successfully
          </h3>
          <p className="text-dark-400 text-sm mb-4">
            Copy and save your private key now. It will not be shown again.
          </p>
          <div className="bg-dark-800 rounded-lg p-4 mb-4">
            <pre className="text-sm text-dark-300 font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {generatedPrivKey}
            </pre>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {copied ? 'Copied!' : 'Copy Private Key'}
            </button>
            <button
              type="button"
              onClick={() => onClose(savedKey || undefined)}
              className="px-4 py-2 text-dark-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={() => onClose()}>
      <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold text-white mb-4">
          Generate SSH Key
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="generate-key-name"
              className="block text-dark-300 text-sm mb-2"
            >
              Key Name
            </label>
            <input
              id="generate-key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="My SSH Key"
              required
            />
          </div>
          <div>
            <label
              htmlFor="generate-key-description"
              className="block text-dark-300 text-sm mb-2"
            >
              Description (optional)
            </label>
            <input
              id="generate-key-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Staging server key"
            />
          </div>
          <div>
            <label
              htmlFor="generate-key-type"
              className="block text-dark-300 text-sm mb-2"
            >
              Key Type
            </label>
            <select
              id="generate-key-type"
              value={keyType}
              onChange={(e) => setKeyType(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ed25519">Ed25519 (Recommended)</option>
              <option value="rsa">RSA (4096-bit)</option>
              <option value="ecdsa">ECDSA (P-256)</option>
            </select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 text-dark-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
