import { Copy, TerminalWindow, Trash } from '@phosphor-icons/react'
import { invoke } from '@tauri-apps/api/core'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'
import { getDeviceId } from '../../lib/device'
import { triggerSync } from '../../lib/sync'
import { useVaultStore } from '../../stores/vaultStore'
import Modal from '../ui/Modal'

interface Snippet {
  id: string
  name: string
  command: string
  description?: string
  tags: string[]
  createdAt: string
}

export default function SnippetList({
  onMutation,
}: {
  onMutation?: () => void
}) {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { currentVaultId } = useVaultStore()

  const fetchSnippets = useCallback(async () => {
    try {
      const result = await invoke<Snippet[]>('list_snippets', {
        userId: '',
        vaultId: currentVaultId || null,
      })
      setSnippets(result || [])
    } catch (error) {
      console.error('Failed to fetch snippets:', error)
    }
  }, [currentVaultId])

  useEffect(() => {
    fetchSnippets()
  }, [fetchSnippets])

  const handleDelete = async (id: string) => {
    if (
      await tauriConfirm('Are you sure you want to delete this snippet?', {
        title: 'Delete Snippet',
        kind: 'warning',
      })
    ) {
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
            type="button"
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
            <TerminalWindow
              className="w-12 h-12 mx-auto mb-4 text-dark-600"
              weight="bold"
            />
            <p>No snippets yet</p>
            <p className="text-sm mt-2">Save commands for quick access</p>
          </div>
        ) : (
          filteredSnippets.map((snippet) => (
            // biome-ignore lint/a11y/useSemanticElements: contains nested <button> elements for copy/delete
            <div
              key={snippet.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedSnippet(snippet)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedSnippet(snippet)
                }
              }}
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
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopy(snippet.command)
                    }}
                    className="text-dark-400 hover:text-primary-500 p-1"
                    title="Copy command"
                  >
                    <Copy className="w-4 h-4" weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(snippet.id)
                    }}
                    className="text-dark-400 hover:text-red-500 p-1"
                    title="Delete snippet"
                  >
                    <Trash className="w-4 h-4" weight="bold" />
                  </button>
                </div>
              </div>
              {snippet.tags && snippet.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {snippet.tags.map((tag) => (
                    <span
                      key={tag}
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
            const result = await invoke<Snippet>('create_snippet', {
              snippet: {
                userId: '',
                vaultId: currentVaultId || null,
                name: snippet.name,
                command: snippet.command,
                description: snippet.description,
                tags: JSON.stringify(snippet.tags || []),
              },
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
  onCreate: (snippet: {
    name: string
    command: string
    description: string
    tags: string[]
  }) => Promise<void>
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
            <label
              htmlFor="snippet-name"
              className="block text-dark-300 text-sm mb-2"
            >
              Name
            </label>
            <input
              id="snippet-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Check disk usage"
              required
            />
          </div>
          <div>
            <label
              htmlFor="snippet-command"
              className="block text-dark-300 text-sm mb-2"
            >
              Command
            </label>
            <textarea
              id="snippet-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              placeholder="df -h"
              rows={3}
              required
            />
          </div>
          <div>
            <label
              htmlFor="snippet-description"
              className="block text-dark-300 text-sm mb-2"
            >
              Description
            </label>
            <input
              id="snippet-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Show disk usage in human-readable format"
            />
          </div>
          <div>
            <label
              htmlFor="snippet-tags"
              className="block text-dark-300 text-sm mb-2"
            >
              Tags (comma-separated)
            </label>
            <input
              id="snippet-tags"
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
