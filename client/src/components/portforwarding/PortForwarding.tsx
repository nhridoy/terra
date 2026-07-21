import { ArrowsLeftRight, Pause, Play, Trash } from '@phosphor-icons/react'
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useEffect, useState } from 'react'
import {
  type PortForward,
  usePortForwardingStore,
} from '../../stores/portForwardingStore'
import Modal from '../ui/Modal'
import { toast } from '../ui/Toast'

interface PortForwardingProps {
  hostId?: string
}

export default function PortForwarding({ hostId }: PortForwardingProps) {
  const {
    forwards,
    isLoading,
    error,
    loadForwards,
    startForward,
    stopForward,
    toggleForward,
    clearError,
  } = usePortForwardingStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [localPort, setLocalPort] = useState(8080)
  const [remoteHost, setRemoteHost] = useState('localhost')
  const [remotePort, setRemotePort] = useState(80)

  useEffect(() => {
    loadForwards()
  }, [loadForwards])

  useEffect(() => {
    if (error) {
      toast(error, 'error')
      clearError()
    }
  }, [error, clearError])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hostId) {
      toast('Connect to a host first', 'error')
      return
    }
    try {
      await startForward(hostId, localPort, remoteHost, remotePort)
      setShowCreateModal(false)
      resetForm()
      toast(`Port forward started on :${localPort}`, 'success')
    } catch {
      // Error is handled by store
    }
  }

  const handleDelete = async (id: string) => {
    if (
      await tauriConfirm('Delete this port forward?', {
        title: 'Delete Port Forward',
        kind: 'warning',
      })
    ) {
      await stopForward(id)
      toast('Port forward stopped', 'success')
    }
  }

  const handleToggle = async (id: string) => {
    await toggleForward(id)
  }

  const resetForm = () => {
    setLocalPort(8080)
    setRemoteHost('localhost')
    setRemotePort(80)
  }

  // Filter forwards for current session if hostId is provided
  const displayForwards = hostId
    ? forwards.filter((f) => f.sessionId === hostId)
    : forwards

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Port Forwarding</h2>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            + Add Forward
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center text-dark-400 py-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p>Loading port forwards...</p>
          </div>
        ) : displayForwards.length === 0 ? (
          <div className="text-center text-dark-400 py-8">
            <ArrowsLeftRight
              className="w-12 h-12 mx-auto mb-4 text-dark-600"
              weight="bold"
            />
            <p>No port forwards configured</p>
            <p className="text-sm mt-2">Create a tunnel to forward ports</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayForwards.map((forward) => (
              <ForwardCard
                key={forward.id}
                forward={forward}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
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
                <label
                  htmlFor="local-port"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Local Port
                </label>
                <input
                  id="local-port"
                  type="number"
                  value={localPort}
                  onChange={(e) =>
                    setLocalPort(Number.parseInt(e.target.value, 10) || 8080)
                  }
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="1"
                  max="65535"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="remote-host"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Remote Host
                </label>
                <input
                  id="remote-host"
                  type="text"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="localhost"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="remote-port"
                  className="block text-dark-300 text-sm mb-2"
                >
                  Remote Port
                </label>
                <input
                  id="remote-port"
                  type="number"
                  value={remotePort}
                  onChange={(e) =>
                    setRemotePort(Number.parseInt(e.target.value, 10) || 80)
                  }
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="1"
                  max="65535"
                  required
                />
              </div>

              <div className="bg-dark-800 p-3 rounded-lg text-sm text-dark-400">
                <p>
                  Local port <span className="text-white">:{localPort}</span>{' '}
                  will be forwarded to{' '}
                  <span className="text-white">
                    {remoteHost}:{remotePort}
                  </span>
                </p>
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

function ForwardCard({
  forward,
  onToggle,
  onDelete,
}: {
  forward: PortForward
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        forward.active
          ? 'bg-dark-800 border-dark-700'
          : 'bg-dark-900 border-dark-800 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              forward.active ? 'bg-green-500' : 'bg-dark-500'
            }`}
          />
          <div>
            <div className="text-white font-medium">
              :{forward.localPort} → {forward.remoteHost}:{forward.remotePort}
            </div>
            <div className="text-dark-400 text-sm">Local Forward</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggle(forward.id)}
            className={`p-1 rounded ${
              forward.active
                ? 'text-green-500 hover:text-green-400'
                : 'text-dark-400 hover:text-dark-300'
            }`}
          >
            {forward.active ? (
              <Pause className="w-5 h-5" weight="bold" />
            ) : (
              <Play className="w-5 h-5" weight="bold" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(forward.id)}
            className="text-dark-400 hover:text-red-500 p-1"
          >
            <Trash className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
