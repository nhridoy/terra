import { useState } from 'react'
import { useHostStore } from '../../stores/hostStore'
import { useVaultStore } from '../../stores/vaultStore'

interface Group {
  id: string
  name: string
  parentId?: string
  vaultId?: string
  sortOrder: number
  createdAt: string
}

interface GroupFormProps {
  group?: Group
  defaultParentId?: string
  onClose: () => void
}

export default function GroupForm({
  group,
  defaultParentId,
  onClose,
}: GroupFormProps) {
  const { createGroup, updateGroup } = useHostStore()
  const { currentVaultId } = useVaultStore()
  const [name, setName] = useState(group?.name || '')
  const parentId = group?.parentId || defaultParentId || ''
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Group name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (group) {
        await updateGroup(group.id, {
          name: name.trim(),
          parentId: parentId || undefined,
        })
      } else {
        await createGroup({
          name: name.trim(),
          parentId: parentId || undefined,
          vaultId: currentVaultId || undefined,
        })
      }
      onClose()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : String(err) || 'Failed to save group',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-400 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="group-name"
          className="block text-dark-300 text-sm mb-2"
        >
          Group Name
        </label>
        <input
          id="group-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Group name"
          required
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-dark-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : group ? 'Save Changes' : 'Create Group'}
        </button>
      </div>
    </form>
  )
}
