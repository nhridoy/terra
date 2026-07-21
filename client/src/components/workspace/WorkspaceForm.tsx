import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'

interface WorkspaceFormProps {
  open: boolean
  title: string
  initialName?: string
  submitLabel?: string
  onSubmit: (name: string) => void
  onClose: () => void
}

export default function WorkspaceForm({
  open,
  title,
  initialName = '',
  submitLabel = 'Save',
  onSubmit,
  onClose,
}: WorkspaceFormProps) {
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="workspace-name"
            className="block mb-1 text-xs font-medium text-dark-400"
          >
            Workspace name
          </label>
          <input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder="e.g. Production Cluster"
            className="w-full px-3 py-2 text-sm text-white bg-dark-950 border border-dark-700 rounded focus:outline-none focus:border-primary-500"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-dark-300 bg-dark-800 rounded hover:bg-dark-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
