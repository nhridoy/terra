import { useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useTerminalStore } from '../../stores/terminalStore'
import WorkspaceForm from './WorkspaceForm'

interface WorkspaceListProps {
  onLaunch: (tabId: string) => void
  onSaveNew: () => void
}

function previewFromLayout(layoutStr: string): { tabCount: number; hosts: string[] } {
  try {
    const layout = JSON.parse(layoutStr)
    const tabs: any[] = Array.isArray(layout) ? layout : (layout.tabs || [])
    const hosts: string[] = []
    tabs.forEach((tab) => {
      const collect = (node: any) => {
        if (!node) return
        if (node.type === 'leaf') {
          if (node.hostName) hosts.push(node.hostName)
        } else if (node.children) {
          node.children.forEach(collect)
        }
      }
      collect(tab.root)
    })
    return { tabCount: tabs.length, hosts }
  } catch {
    return { tabCount: 0, hosts: [] }
  }
}

export default function WorkspaceList({ onLaunch, onSaveNew }: WorkspaceListProps) {
  const { workspaces, renameWorkspace, deleteWorkspace } = useWorkspaceStore()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingName, setRenamingName] = useState('')
  const [showRename, setShowRename] = useState(false)

  // How many currently-open tabs have at least one connected pane. Used to
  // disable "New Workspace" until there is a real group to save.
  const connectedTabCount = useTerminalStore((s) =>
    s.tabs.reduce((acc, t) => {
      const has = (node: any): boolean =>
        node.type === 'leaf' ? !!node.hostId : node.children.some(has)
      return acc + (has(t.root) ? 1 : 0)
    }, 0),
  )
  const activeWorkspaceId = useTerminalStore((s) => s.activeWorkspaceId)
  // "New Workspace" only when there are 2+ connected tabs AND no workspace is
  // currently active (created workspaces must first be deleted to make a new one).
  const canSave = connectedTabCount >= 2 && !activeWorkspaceId

  // Launch a saved workspace: rebuild its tabs and switch to the terminal view.
  const handleLaunch = (layoutStr: string, id: string, name: string) => {
    try {
      const layout = JSON.parse(layoutStr)
      useTerminalStore.getState().launchWorkspace(layout, id, name)
      const firstTabId = useTerminalStore.getState().activeTabId
      if (firstTabId) onLaunch(firstTabId)
    } catch (e) {
      console.error('Failed to launch workspace:', e)
    }
  }

  const openRename = (id: string, name: string) => {
    setRenamingId(id)
    setRenamingName(name)
    setShowRename(true)
  }

  const handleRenameSubmit = (name: string) => {
    if (renamingId) renameWorkspace(renamingId, name)
    setShowRename(false)
    setRenamingId(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this workspace? This cannot be undone.')) return
    const activeId = useTerminalStore.getState().activeWorkspaceId
    deleteWorkspace(id)
    // If we just deleted the workspace that is currently open, drop the
    // "active workspace" tracking so the save buttons re-activate.
    if (activeId && activeId === id) {
      useTerminalStore.setState({
        activeWorkspaceId: null,
        activeWorkspaceName: null,
        isDirty: false,
        savedSnapshot: '',
      })
    }
  }

  return (
    <div className="flex-1 p-4 space-y-6 overflow-y-auto">
      {/* Workspaces Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold tracking-wider uppercase text-dark-400">Workspaces</h3>
           <button
            onClick={onSaveNew}
            disabled={!canSave}
            title={canSave ? 'Save current layout as a new workspace' : activeWorkspaceId ? 'Delete the current workspace first' : 'Open at least 2 connected terminals'}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white transition-colors rounded bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Workspace
          </button>
        </div>

        {workspaces.length === 0 ? (
          <div
            onClick={onSaveNew}
            className="p-6 text-center transition-colors border-2 border-dashed rounded-lg cursor-pointer border-dark-600 hover:border-dark-500 hover:bg-dark-800/50"
          >
            <svg className="w-8 h-8 mx-auto mb-2 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
            </svg>
            <p className="text-sm text-dark-400">No workspaces yet — open terminals and click the save icon to create one</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {workspaces.map((ws) => {
              const { tabCount, hosts } = previewFromLayout(ws.layout)
              return (
                <div
                  key={ws.id}
                  onClick={() => handleLaunch(ws.layout, ws.id, ws.name)}
                  className="relative p-3 transition-colors rounded-lg cursor-pointer bg-dark-800/50 hover:bg-dark-800 group"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-primary-600">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v5a1 1 0 001 1h5" />
                      </svg>
                    </div>
                    <span className="flex-1 text-sm font-medium text-white truncate">{ws.name}</span>
                  </div>
                  <p className="mt-2 text-xs text-dark-500">
                    {tabCount} tab{tabCount === 1 ? '' : 's'}
                    {hosts.length > 0 && ` • ${hosts.length} connection${hosts.length === 1 ? '' : 's'}`}
                  </p>
                  {hosts.length > 0 && (
                    <p className="mt-1 text-xs text-dark-500 truncate">
                      {hosts.slice(0, 3).join(', ')}{hosts.length > 3 ? ` +${hosts.length - 3}` : ''}
                    </p>
                  )}
                  <div className="absolute flex items-center gap-1 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); openRename(ws.id, ws.name) }}
                      className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                      title="Rename workspace"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(ws.id) }}
                      className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
                      title="Delete workspace"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <WorkspaceForm
        open={showRename}
        title="Rename Workspace"
        initialName={renamingName}
        submitLabel="Rename"
        onSubmit={handleRenameSubmit}
        onClose={() => { setShowRename(false); setRenamingId(null) }}
      />
    </div>
  )
}
