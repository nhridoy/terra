import { useEffect, useState } from 'react'
import { useHostStore } from '../../stores/hostStore'
import { useVaultStore } from '../../stores/vaultStore'
import api from '../../lib/api'
import Modal from '../ui/Modal'

interface HostData {
  id: string
  name: string
  address: string
  port: number
  username: string
  authType: 'password' | 'key'
  keyId?: string
  color?: string
  groupId?: string
  tags?: string[]
}

interface HostFormProps {
  host?: HostData
  onClose: () => void
}

interface Key {
  id: string
  name: string
  description?: string
  keyType: string
  fingerprint?: string
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

export default function HostForm({ host, onClose }: HostFormProps) {
  const { createHost, updateHost } = useHostStore()
  const { currentVaultId } = useVaultStore()
  const [name, setName] = useState(host?.name || '')
  const [address, setAddress] = useState(host?.address || '')
  const [port, setPort] = useState(host?.port || 22)
  const [username, setUsername] = useState(host?.username || '')
  const [authType, setAuthType] = useState<'password' | 'key'>('password')
  const [password, setPassword] = useState('')
  const [keyId, setKeyId] = useState(host?.keyId || '')
  const [color, setColor] = useState(host?.color || '#64748b')
  const [groupId, setGroupId] = useState(host?.groupId || '')
  const [tags, setTags] = useState(parseTags(host?.tags).join(', ') || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keys, setKeys] = useState<Key[]>([])

  useEffect(() => {
    api.listKeys(currentVaultId || undefined).then((res) => setKeys(res.keys)).catch(() => {})
  }, [currentVaultId])

  useEffect(() => {
    if (host) {
      setName(host.name)
      setAddress(host.address)
      setPort(host.port)
      setUsername(host.username)
      setAuthType(host.authType || 'password')
      setKeyId(host.keyId || '')
      setColor(host.color || '#64748b')
      setGroupId(host.groupId || '')
      setTags(host.tags?.join(', ') || '')
    }
  }, [host])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const hostData = {
        name,
        address,
        port,
        username,
        authType,
        keyId: authType === 'key' ? keyId : undefined,
        password: authType === 'password' ? password : undefined,
        color,
        groupId: groupId || undefined,
        vaultId: currentVaultId || undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }

      if (host) {
        await updateHost(host.id, hostData)
      } else {
        await createHost(hostData)
      }
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to save host')
    } finally {
      setIsLoading(false)
    }
  }

  const colors = [
    '#64748b',
    '#ef4444',
    '#f59e0b',
    '#22c55e',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
  ]

  return (
    <Modal open onClose={onClose} title={host ? 'Edit Host' : 'Add Host'}>
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-400 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="host-name" className="block text-dark-300 text-sm mb-2">Name</label>
          <input
            id="host-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="My Server"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="host-address" className="block text-dark-300 text-sm mb-2">Address</label>
            <input
              id="host-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="192.168.1.100 or hostname"
              required
            />
          </div>
          <div>
            <label htmlFor="host-port" className="block text-dark-300 text-sm mb-2">Port</label>
            <input
              id="host-port"
              type="number"
              value={port}
              onChange={(e) => setPort(Number.parseInt(e.target.value) || 22)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              min="1"
              max="65535"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="host-username" className="block text-dark-300 text-sm mb-2">Username</label>
          <input
            id="host-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="root"
            required
          />
        </div>

        <div>
          <label htmlFor="host-auth" className="block text-dark-300 text-sm mb-2">
            Authentication
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAuthType('password')}
              className={`flex-1 py-2 rounded-lg ${
                authType === 'password'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setAuthType('key')}
              className={`flex-1 py-2 rounded-lg ${
                authType === 'key'
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
              }`}
            >
              SSH Key
            </button>
          </div>
        </div>

        {authType === 'password' ? (
          <div>
            <label htmlFor="host-password" className="block text-dark-300 text-sm mb-2">Password</label>
            <input
              id="host-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter password"
              required
            />
          </div>
        ) : (
          <div>
            <label htmlFor="host-key" className="block text-dark-300 text-sm mb-2">SSH Key</label>
            <select
              id="host-key"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">Select a key</option>
              {keys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name} ({key.keyType.toUpperCase()} - {key.fingerprint || key.description || 'No fingerprint'})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="host-color" className="block text-dark-300 text-sm mb-2">Color</label>
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full ${
                  color === c
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-900'
                    : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="host-tags" className="block text-dark-300 text-sm mb-2">Tags</label>
          <input
            id="host-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="production, web (comma-separated)"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-dark-400 hover:text-white"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : host ? 'Save Changes' : 'Add Host'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
