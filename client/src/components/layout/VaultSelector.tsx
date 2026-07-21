import {
  CaretDown,
  Check,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Shield,
  Trash,
  X,
} from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import { getDeviceId } from '../../lib/device'
import { useAuthStore } from '../../stores/authStore'
import { useVaultStore } from '../../stores/vaultStore'

interface VaultItem {
  id: string
  name: string
  description?: string
  isDefault?: boolean
  isSystem?: boolean
  createdAt: string
  updatedAt: string
}

const VAULT_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
]

function colorFor(vault: Partial<VaultItem>, index: number): string {
  if (vault.isDefault) return 'bg-amber-500'
  return VAULT_COLORS[index % VAULT_COLORS.length]
}

export function VaultSelector() {
  const { vaults, currentVaultId, switchVault, createVault } = useVaultStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingVault, setEditingVault] = useState<VaultItem | null>(null)
  const [newVaultName, setNewVaultName] = useState('')
  const [newVaultDesc, setNewVaultDesc] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const currentVault = vaults.find((v) => v.id === currentVaultId)

  const filtered = vaults.filter(
    (v) =>
      v.name.toLowerCase().includes(query.toLowerCase()) ||
      (v.description || '').toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openCreateModal = () => {
    setOpen(false)
    setEditingVault(null)
    setNewVaultName('')
    setNewVaultDesc('')
    setError('')
    setShowModal(true)
  }

  const openEditModal = (vault: VaultItem) => {
    setOpen(false)
    setEditingVault(vault)
    setNewVaultName(vault.name)
    setNewVaultDesc(vault.description || '')
    setError('')
    setShowModal(true)
  }

  const handleDelete = async (vault: VaultItem) => {
    if (vault.isSystem) return
    if (
      !(await tauriConfirm(
        `Delete vault "${vault.name}"? All hosts, keys, groups, snippets, and history in this vault will be permanently removed.`,
        { title: 'Delete Vault', kind: 'warning' },
      ))
    ) {
      return
    }
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_vault', { id: vault.id, deviceId })
      const { fetchVaults } = useVaultStore.getState()
      fetchVaults()
    } catch (e) {
      console.error('Failed to delete vault:', e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVaultName.trim()) return

    setIsCreating(true)
    setError('')
    try {
      const deviceId = await getDeviceId()
      if (editingVault) {
        await invoke('update_vault', {
          id: editingVault.id,
          vault: {
            userId: useAuthStore.getState().user?.id || '',
            name: newVaultName.trim(),
            description: newVaultDesc.trim(),
          },
          deviceId,
        })
        const { fetchVaults } = useVaultStore.getState()
        fetchVaults()
      } else {
        await createVault(newVaultName.trim(), newVaultDesc.trim())
      }
      setShowModal(false)
    } catch (err: unknown) {
      const msg =
        typeof err === 'string'
          ? err
          : err instanceof Error
            ? err.message
            : 'Failed to save vault'
      if (msg.includes('already exists') || msg.includes('UNIQUE')) {
        setError('A vault with this name already exists')
      } else if (msg.includes('default vault')) {
        setError('Cannot edit default vault')
      } else {
        setError(msg)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const resetModal = () => {
    setShowModal(false)
    setEditingVault(null)
    setNewVaultName('')
    setNewVaultDesc('')
    setError('')
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-lg border border-dark-700 bg-dark-800 hover:bg-dark-700 hover:border-dark-600 transition-colors"
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${colorFor(
            currentVault || {},
            vaults.findIndex((v) => v.id === currentVaultId),
          )}`}
        />
        <span className="text-sm font-medium text-white truncate max-w-[140px]">
          {currentVault?.name || 'Vault'}
        </span>
        <CaretDown
          className={`w-3.5 h-3.5 text-dark-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 z-50 rounded-xl bg-dark-900 border border-dark-700 shadow-2xl overflow-hidden animate-[fadeIn_120ms_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-800">
            <MagnifyingGlass className="w-4 h-4 text-dark-400" />
            <span className="text-sm font-semibold text-white">Vaults</span>
            <span className="ml-auto text-xs text-dark-500">
              {vaults.length}
            </span>
          </div>

          {/* Search */}
          {vaults.length > 3 && (
            <div className="px-3 py-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vaults..."
                className="w-full px-3 py-1.5 text-sm text-white bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-dark-600"
              />
            </div>
          )}

          {/* List */}
          <div className="max-h-72 overflow-y-auto scrollbar-none py-1 px-2">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-dark-500">
                No vaults found
              </div>
            )}
            {filtered.map((vault, i) => {
              const active = currentVaultId === vault.id
              return (
                <div key={vault.id} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      switchVault(vault.id)
                      setOpen(false)
                    }}
                    className={`group flex items-center gap-3 w-full px-2.5 py-2 rounded-lg transition-colors ${
                      active ? 'bg-primary-600/15' : 'hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorFor(vault, i)}`}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${active ? 'text-primary-300' : 'text-white'}`}
                        >
                          {vault.name}
                        </span>
                        {vault.isDefault && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-500/15 rounded">
                            Default
                          </span>
                        )}
                        {vault.isSystem && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dark-400 bg-white/5 rounded">
                            <Shield className="w-2.5 h-2.5" weight="fill" />
                            Protected
                          </span>
                        )}
                      </div>
                      {vault.description && (
                        <p className="text-xs text-dark-500 truncate mt-0.5">
                          {vault.description}
                        </p>
                      )}
                    </div>
                    {vault.isSystem ? (
                      <span className="w-4 flex-shrink-0" />
                    ) : (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {active && (
                          <Check
                            className="w-4 h-4 text-primary-400 group-hover:hidden"
                            weight="bold"
                          />
                        )}
                        <div className="hidden group-hover:flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(vault)
                            }}
                            className="p-1 text-dark-400 hover:text-white hover:bg-white/10 rounded"
                            title="Edit vault"
                          >
                            <PencilSimple className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(vault)
                            }}
                            className="p-1 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                            title="Delete vault"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-dark-800">
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-primary-400 hover:text-primary-300 hover:bg-primary-600/10 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create vault
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <button
          type="button"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={resetModal}
          onKeyDown={(e) => {
            if (e.key === 'Escape') resetModal()
          }}
        >
          <div className="w-full max-w-sm mx-4 p-5 rounded-xl bg-dark-900 border border-dark-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">
                {editingVault ? 'Edit Vault' : 'Create Vault'}
              </h3>
              <button
                type="button"
                onClick={resetModal}
                className="p-1 text-dark-500 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                <X className="w-4 h-4" weight="bold" />
              </button>
            </div>
            {error && (
              <div className="mb-3 px-3 py-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="vault-name"
                  className="block mb-1.5 text-xs font-medium text-dark-400 uppercase tracking-wider"
                >
                  Name
                </label>
                <input
                  id="vault-name"
                  type="text"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-white bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder:text-dark-600"
                  placeholder="e.g. Personal, Production, Staging"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="vault-desc"
                  className="block mb-1.5 text-xs font-medium text-dark-400 uppercase tracking-wider"
                >
                  Description
                </label>
                <input
                  id="vault-desc"
                  type="text"
                  value={newVaultDesc}
                  onChange={(e) => setNewVaultDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-white bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder:text-dark-600"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-3 py-1.5 text-sm text-dark-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newVaultName.trim()}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isCreating ? 'Saving...' : editingVault ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </button>
      )}
    </div>
  )
}

export default VaultSelector
