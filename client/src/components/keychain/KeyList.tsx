import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../../lib/device'
import { useVaultStore } from '../../stores/vaultStore'
import Modal from '../ui/Modal'
import { triggerSync } from '../../lib/sync'
import { parsePpk } from '../../../../shared/utils/ppkParser'

interface Key {
  id: string
  name: string
  description?: string
  keyType: string
  publicKey: string
  fingerprint?: string
  createdAt: string
}

export default function KeyList({ onMutation }: { onMutation?: () => void }) {
  const [keys, setKeys] = useState<Key[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedKey, setSelectedKey] = useState<Key | null>(null)
  const { currentVaultId } = useVaultStore()

  const fetchKeys = async () => {
    try {
      const result = await invoke<any[]>('list_keys', { userId: '', vaultId: currentVaultId || null })
      setKeys(result || [])
    } catch (error) {
      console.error('Failed to fetch keys:', error)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [currentVaultId])

  const handleDelete = async (id: string) => {
    if (await tauriConfirm('Are you sure you want to delete this key?', { title: 'Delete Key', kind: 'warning' })) {
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
              onClick={() => setShowImportModal(true)}
              className="px-2 py-1 bg-dark-700 hover:bg-dark-600 text-dark-300 text-xs font-medium rounded transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Import
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-2 py-1 bg-dark-700 hover:bg-dark-600 text-dark-300 text-xs font-medium rounded transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {keys.length === 0 ? (
          <div className="text-center text-dark-400 py-8">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-dark-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <p>No SSH keys</p>
            <p className="text-sm mt-2">Import or generate a key</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {keys.map((key) => (
              <div
                key={key.id}
                onClick={() => setSelectedKey(selectedKey?.id === key.id ? null : key)}
                className={`rounded-lg p-3 cursor-pointer transition-colors group relative ${
                  selectedKey?.id === key.id
                    ? 'bg-primary-600/20 border border-primary-500/50'
                    : 'bg-dark-800/50 hover:bg-dark-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg flex-shrink-0">{getKeyTypeIcon(key.keyType)}</span>
                  <span className="text-white text-sm font-medium truncate">{key.name}</span>
                </div>
                <p className="text-dark-500 text-xs mt-1 ml-[28px] truncate">
                  {key.keyType.toUpperCase()} • {key.fingerprint || 'No fingerprint'}
                </p>
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(key.id) }}
                    className="p-1 text-dark-400 hover:text-red-500 rounded hover:bg-dark-700"
                    title="Delete key"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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
            <h3 className="text-white font-medium">{selectedKey.name} — Public Key</h3>
            <button
              onClick={() => setSelectedKey(null)}
              className="text-dark-400 hover:text-white p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <pre className="bg-dark-900 p-3 rounded-lg text-sm text-dark-300 break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
            {selectedKey.publicKey}
          </pre>
          <button
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
            const deviceId = await getDeviceId()
            const result = await invoke<any>('create_key', { key: { userId: '', vaultId: currentVaultId || null, name: key.name, keyType: key.keyType || 'ed25519', publicKey: key.publicKey || '', encryptedPrivateKey: key.privateKey || null, fingerprint: key.fingerprint || null, description: key.description || '' }, deviceId })
            setKeys((prev) => [...prev, result])
            setShowImportModal(false)
            onMutation?.()
          }}
        />
      )}

      {showGenerateModal && (
        <GenerateKeyModal
          vaultId={currentVaultId || undefined}
          onClose={(savedKey?: Key) => {
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
  onImport: (key: any) => Promise<void>
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

      // PPK files
      if (lowerName.endsWith('.ppk')) {
        if (!lowerContent.startsWith('putty-user-key-file-')) {
          setError('Not a valid PuTTY key file')
          return
        }
        const parsed = parsePpk(content)
        setPrivateKey(parsed.privateKey)
        setPublicKey(parsed.publicKey)
        if (!name) setName(file.name.replace(/\.ppk$/i, ''))
        setMode('paste')
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
    } catch (e: any) {
      setError(`Failed to read file: ${e.message}`)
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
    try {
      await onImport({
        name,
        description,
        publicKey,
        encryptedPrivateKey: privateKey,
      })
    } catch (e: any) {
      setError(e.message || 'Failed to import key')
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
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800'
            }`}
          >
            <svg
              className="w-10 h-10 mx-auto mb-3 text-dark-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-dark-300 text-sm">
              Drop a key file here or{' '}
              <span className="text-primary-500">browse</span>
            </p>
            <p className="text-dark-500 text-xs mt-1">
              Supports PEM, OpenSSH, and PuTTY (.ppk) formats
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-dark-300 text-sm mb-2">Key Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="My SSH Key"
                required
              />
            </div>
            <div>
              <label className="block text-dark-300 text-sm mb-2">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Production server key"
              />
            </div>
            <div>
              <label className="block text-dark-300 text-sm mb-2">
                Private Key
              </label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={4}
                required
              />
            </div>
            <div>
              <label className="block text-dark-300 text-sm mb-2">
                Public Key (optional — auto-derived if empty)
              </label>
              <textarea
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
  onClose: (savedKey?: Key) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keyType, setKeyType] = useState('ed25519')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedPrivKey, _setGeneratedPrivKey] = useState<string | null>(null)
  const [savedKey, _setSavedKey] = useState<Key | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      setError('Key generation is not available in sync-only mode. Use import instead.')
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to generate key')
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
            <label className="block text-dark-300 text-sm mb-2">Key Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="My SSH Key"
              required
            />
          </div>
          <div>
            <label className="block text-dark-300 text-sm mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Staging server key"
            />
          </div>
          <div>
            <label className="block text-dark-300 text-sm mb-2">Key Type</label>
            <select
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
