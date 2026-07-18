import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../../lib/device'
import { useVaultStore } from '../../stores/vaultStore'
import Modal from '../ui/Modal'
import { triggerSync } from '../../lib/sync'

interface Snippet {
  id: string
  name: string
  command: string
  description?: string
  tags: string[]
  createdAt: string
}

export default function SnippetList({ onMutation }: { onMutation?: () => void }) {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { currentVaultId } = useVaultStore()

  const fetchSnippets = async () => {
    try {
      const result = await invoke<any[]>('list_snippets', { userId: '', vaultId: currentVaultId || null })
      setSnippets(result || [])
    } catch (error) {
      console.error('Failed to fetch snippets:', error)
    }
  }

  useEffect(() => {
    fetchSnippets()
  }, [currentVaultId])

  const handleDelete = async (id: string) => {
    if (await tauriConfirm('Are you sure you want to delete this snippet?', { title: 'Delete Snippet', kind: 'warning' })) {
      try {
        const deviceId = await getDeviceId()
        await invoke('delete_snippet', { id, deviceId })
        await triggerSync()
        setSnippets(snippets.filter((s) => s.id !== id))
        if (selectedSnippet?.id === id) {
          setSelectedSnippet(null)
        }
        onMutation?.()
      } catch (error) {
        console.error('Failed to delete snippet:', error)
      }
    }
  }

  const handleCopy = (command: string) => {
    navigator.clipboard.writeText(command)
  }

  const filteredSnippets = snippets.filter(
    (snippet) =>
      snippet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.command.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Snippets</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            + New Snippet
          </button>
        </div>
        <input
          type="text"
          placeholder="Search snippets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-dark-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredSnippets.length === 0 ? (
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
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p>No snippets yet</p>
            <p className="text-sm mt-2">Save commands for quick access</p>
          </div>
        ) : (
          filteredSnippets.map((snippet) => (
            <div
              key={snippet.id}
              onClick={() => setSelectedSnippet(snippet)}
              className={`p-3 rounded-lg cursor-pointer mb-2 ${
                selectedSnippet?.id === snippet.id
                  ? 'bg-primary-600/20 border border-primary-500/50'
                  : 'bg-dark-800 hover:bg-dark-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {snippet.name}
                  </div>
                  <div className="text-dark-400 text-sm font-mono truncate">
                    {snippet.command}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopy(snippet.command)
                    }}
                    className="text-dark-400 hover:text-primary-500 p-1"
                    title="Copy command"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(snippet.id)
                    }}
                    className="text-dark-400 hover:text-red-500 p-1"
                    title="Delete snippet"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {snippet.tags && snippet.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {snippet.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-dark-700 text-dark-300 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateSnippetModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (snippet) => {
            const deviceId = await getDeviceId()
            const result = await invoke<any>('create_snippet', {
              snippet: { userId: '', vaultId: currentVaultId || null, name: snippet.name, command: snippet.command, description: snippet.description, tags: JSON.stringify(snippet.tags || []) },
              deviceId,
            })
            await triggerSync()
            setSnippets((prev) => [...prev, result])
            setShowCreateModal(false)
            onMutation?.()
          }}
        />
      )}
    </div>
  )
}

function CreateSnippetModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (snippet: any) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onCreate({
      name,
      command,
      description,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    })
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold text-white mb-4">
          Create Snippet
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-dark-300 text-sm mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Check disk usage"
              required
            />
          </div>
          <div>
            <label className="block text-dark-300 text-sm mb-2">Command</label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              placeholder="df -h"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-dark-300 text-sm mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Show disk usage in human-readable format"
            />
          </div>
          <div>
            <label className="block text-dark-300 text-sm mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="monitoring, disk"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-dark-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
