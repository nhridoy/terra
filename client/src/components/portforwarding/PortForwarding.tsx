import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'

interface PortForward {
  id: string
  hostId: string
  hostName: string
  localPort: number
  remoteHost: string
  remotePort: number
  type: 'local' | 'remote' | 'dynamic'
  isActive: boolean
  createdAt: string
}

interface PortForwardingProps {
  hostId?: string
}

export default function PortForwarding({ hostId }: PortForwardingProps) {
  const [forwards, setForwards] = useState<PortForward[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [localPort, setLocalPort] = useState(8080)
  const [remoteHost, setRemoteHost] = useState('localhost')
  const [remotePort, setRemotePort] = useState(80)
  const [forwardType, setForwardType] = useState<
    'local' | 'remote' | 'dynamic'
  >('local')

  useEffect(() => {
    // Load forwards from API
    loadForwards()
  }, [hostId])

  const loadForwards = async () => {
    try {
      // TODO: Implement API call
      // const result = await api.listPortForwards(hostId);
      // setForwards(result.forwards);
    } catch (error) {
      console.error('Failed to load forwards:', error)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // TODO: Implement API call
      const newForward: PortForward = {
        id: `forward_${Date.now()}`,
        hostId: hostId || 'all',
        hostName: 'Local',
        localPort,
        remoteHost,
        remotePort,
        type: forwardType,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      setForwards([...forwards, newForward])
      setShowCreateModal(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create forward:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (await tauriConfirm('Delete this port forward?', { title: 'Delete Port Forward', kind: 'warning' })) {
      try {
        // TODO: Implement API call
        setForwards(forwards.filter((f) => f.id !== id))
      } catch (error) {
        console.error('Failed to delete forward:', error)
      }
    }
  }

  const handleToggle = async (id: string) => {
    try {
      // TODO: Implement API call
      setForwards(
        forwards.map((f) =>
          f.id === id ? { ...f, isActive: !f.isActive } : f,
        ),
      )
    } catch (error) {
      console.error('Failed to toggle forward:', error)
    }
  }

  const resetForm = () => {
    setLocalPort(8080)
    setRemoteHost('localhost')
    setRemotePort(80)
    setForwardType('local')
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'local':
        return 'Local'
      case 'remote':
        return 'Remote'
      case 'dynamic':
        return 'Dynamic (SOCKS)'
      default:
        return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'local':
        return 'bg-blue-500/20 text-blue-400'
      case 'remote':
        return 'bg-green-500/20 text-green-400'
      case 'dynamic':
        return 'bg-purple-500/20 text-purple-400'
      default:
        return 'bg-dark-600 text-dark-300'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Port Forwarding</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            + Add Forward
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {forwards.length === 0 ? (
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
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <p>No port forwards configured</p>
            <p className="text-sm mt-2">Create a tunnel to forward ports</p>
          </div>
        ) : (
          <div className="space-y-3">
            {forwards.map((forward) => (
              <div
                key={forward.id}
                className={`p-4 rounded-lg border ${
                  forward.isActive
                    ? 'bg-dark-800 border-dark-700'
                    : 'bg-dark-900 border-dark-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        forward.isActive ? 'bg-green-500' : 'bg-dark-500'
                      }`}
                    />
                    <div>
                      <div className="text-white font-medium">
                        {forward.type === 'dynamic'
                          ? `SOCKS Proxy :${forward.localPort}`
                          : `:${forward.localPort} → ${forward.remoteHost}:${forward.remotePort}`}
                      </div>
                      <div className="text-dark-400 text-sm">
                        {forward.hostName} • {getTypeLabel(forward.type)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${getTypeColor(forward.type)}`}
                    >
                      {getTypeLabel(forward.type)}
                    </span>
                    <button
                      onClick={() => handleToggle(forward.id)}
                      className={`p-1 rounded ${
                        forward.isActive
                          ? 'text-green-500 hover:text-green-400'
                          : 'text-dark-400 hover:text-dark-300'
                      }`}
                    >
                      {forward.isActive ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(forward.id)}
                      className="text-dark-400 hover:text-red-500 p-1"
                    >
                      <svg
                        className="w-5 h-5"
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <Modal
          onClose={() => {
            setShowCreateModal(false)
            resetForm()
          }}
        >
          <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Add Port Forward
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">Type</label>
                <select
                  value={forwardType}
                  onChange={(e) => setForwardType(e.target.value as 'local' | 'remote' | 'dynamic')}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="local">Local (forward local to remote)</option>
                  <option value="remote">
                    Remote (forward remote to local)
                  </option>
                  <option value="dynamic">Dynamic (SOCKS proxy)</option>
                </select>
              </div>

              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Local Port
                </label>
                <input
                  type="number"
                  value={localPort}
                  onChange={(e) =>
                    setLocalPort(Number.parseInt(e.target.value) || 8080)
                  }
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="1"
                  max="65535"
                  required
                />
              </div>

              {forwardType !== 'dynamic' && (
                <>
                  <div>
                    <label className="block text-dark-300 text-sm mb-2">
                      Remote Host
                    </label>
                    <input
                      type="text"
                      value={remoteHost}
                      onChange={(e) => setRemoteHost(e.target.value)}
                      className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="localhost"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-dark-300 text-sm mb-2">
                      Remote Port
                    </label>
                    <input
                      type="number"
                      value={remotePort}
                      onChange={(e) =>
                        setRemotePort(Number.parseInt(e.target.value) || 80)
                      }
                      className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      min="1"
                      max="65535"
                      required
                    />
                  </div>
                </>
              )}

              <div className="bg-dark-800 p-3 rounded-lg text-sm text-dark-400">
                {forwardType === 'local' && (
                  <p>
                    Local port <span className="text-white">:{localPort}</span>{' '}
                    will be forwarded to{' '}
                    <span className="text-white">
                      {remoteHost}:{remotePort}
                    </span>
                  </p>
                )}
                {forwardType === 'remote' && (
                  <p>
                    Remote port <span className="text-white">{remotePort}</span>{' '}
                    will be forwarded to{' '}
                    <span className="text-white">localhost:{localPort}</span>
                  </p>
                )}
                {forwardType === 'dynamic' && (
                  <p>
                    SOCKS proxy will be available on{' '}
                    <span className="text-white">localhost:{localPort}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
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
      )}
    </div>
  )
}
