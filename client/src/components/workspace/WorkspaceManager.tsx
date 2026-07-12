import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import Modal from '../ui/Modal'

interface WorkspaceManagerProps {
  onLoadWorkspace: (workspace: any) => void
}

export default function WorkspaceManager({
  onLoadWorkspace,
}: WorkspaceManagerProps) {
  const {
    workspaces,
    fetchWorkspaces,
    createWorkspace,
    deleteWorkspace,
    saveCurrentState,
  } = useWorkspaceStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceDescription, setWorkspaceDescription] = useState('')

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await createWorkspace({
      name: workspaceName,
      description: workspaceDescription,
      tabs: [],
      layout: 'single',
    })
    setShowCreateModal(false)
    setWorkspaceName('')
    setWorkspaceDescription('')
  }

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveCurrentState(workspaceName, workspaceDescription)
    setShowSaveModal(false)
    setWorkspaceName('')
    setWorkspaceDescription('')
  }

  const handleLoad = (workspace: any) => {
    onLoadWorkspace(workspace)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Workspaces</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveModal(true)}
              className="bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              Save Current
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm"
            >
              + New
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {workspaces.length === 0 ? (
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p>No workspaces yet</p>
            <p className="text-sm mt-2">Save your current session layout</p>
          </div>
        ) : (
          workspaces.map((workspace) => (
            <div
              key={workspace.id}
              onClick={() => handleLoad(workspace)}
              className="p-3 rounded-lg cursor-pointer mb-2 bg-dark-800 hover:bg-dark-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {workspace.name}
                  </div>
                  <div className="text-dark-400 text-sm truncate">
                    {workspace.description || 'No description'}
                  </div>
                  <div className="text-dark-500 text-xs mt-1">
                    {workspace.tabs?.length || 0} tabs • {workspace.layout}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteWorkspace(workspace.id)
                  }}
                  className="text-dark-400 hover:text-red-500 p-1"
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
          ))
        )}
      </div>

      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Create Workspace
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="My Workspace"
                  required
                />
              </div>
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Description
                </label>
                <textarea
                  value={workspaceDescription}
                  onChange={(e) => setWorkspaceDescription(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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

      {showSaveModal && (
        <Modal onClose={() => setShowSaveModal(false)}>
          <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Save Current Session
            </h3>
            <form onSubmit={handleSaveCurrent} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Production Servers"
                  required
                />
              </div>
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Description
                </label>
                <textarea
                  value={workspaceDescription}
                  onChange={(e) => setWorkspaceDescription(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="My production environment servers"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 text-dark-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  )
}
