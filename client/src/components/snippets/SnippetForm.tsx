import { useState } from 'react'
import { useSnippetStore } from '../../stores/snippetStore'
import { useVaultStore } from '../../stores/vaultStore'

interface Snippet {
  id: string
  name: string
  command: string
  description?: string
  tags?: string[]
  vaultId?: string
  createdAt: string
}

interface SnippetFormProps {
  snippet?: Snippet
  onClose: () => void
}

function parseTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags)
      return Array.isArray(parsed) ? parsed : [tags]
    } catch {
      return tags ? [tags] : []
    }
  }
  return []
}

export default function SnippetForm({ snippet, onClose }: SnippetFormProps) {
  const { createSnippet, updateSnippet } = useSnippetStore()
  const { currentVaultId } = useVaultStore()
  const [name, setName] = useState(snippet?.name || '')
  const [command, setCommand] = useState(snippet?.command || '')
  const [description, setDescription] = useState(snippet?.description || '')
  const [tags, setTags] = useState(parseTags(snippet?.tags).join(', '))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !command.trim()) {
      setError('Name and command are required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)
      if (snippet) {
        await updateSnippet(snippet.id, {
          name: name.trim(),
          command: command.trim(),
          description: description.trim(),
          tags: tagArray
        })
      } else {
        await createSnippet({
          name: name.trim(),
          command: command.trim(),
          description: description.trim(),
          tags: tagArray,
          vaultId: currentVaultId || undefined,
        })
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save snippet')
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
        <label htmlFor="snippet-name" className="block text-dark-300 text-sm mb-2">
          Name
        </label>
        <input
          id="snippet-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Snippet name"
          required
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="snippet-command" className="block text-dark-300 text-sm mb-2">
          Command
        </label>
        <textarea
          id="snippet-command"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          rows={4}
          className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
          placeholder="ssh user@host&#10;ls -la"
          required
        />
      </div>

      <div>
        <label htmlFor="snippet-description" className="block text-dark-300 text-sm mb-2">
          Description (optional)
        </label>
        <textarea
          id="snippet-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="What does this snippet do?"
        />
      </div>

      <div>
        <label htmlFor="snippet-tags" className="block text-dark-300 text-sm mb-2">
          Tags (comma separated)
        </label>
        <input
          id="snippet-tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="production, deploy, ssh"
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
          {isLoading ? 'Saving...' : snippet ? 'Save Changes' : 'Create Snippet'}
        </button>
      </div>
    </form>
  )
}