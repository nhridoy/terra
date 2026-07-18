import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import { useHostStore } from '../../stores/hostStore'
import { useVaultStore } from '../../stores/vaultStore'
import { useTabGroupStore } from '../../stores/tabGroupStore'
import WorkspaceForm from '../workspace/WorkspaceForm'

interface HostBrowserProps {
  onConnect: (host: any) => void
  onRestorePreset: (preset: { id?: string; name?: string; layout: string }) => void
}

function previewFromLayout(layoutStr: string): { paneCount: number; hosts: string[] } {
  try {
    const root = JSON.parse(layoutStr)
    let paneCount = 0
    const hosts: string[] = []
    const collect = (node: any) => {
      if (!node) return
      if (node.type === 'leaf') {
        paneCount++
        if (node.hostName) hosts.push(node.hostName)
      } else if (node.children) {
        node.children.forEach(collect)
      }
    }
    collect(root)
    return { paneCount, hosts }
  } catch {
    return { paneCount: 0, hosts: [] }
  }
}

export default function HostBrowser({ onConnect, onRestorePreset }: HostBrowserProps) {
  const { hosts } = useHostStore()
  const { currentVaultId } = useVaultStore()
  const { tabGroups, fetchTabGroups, renameTabGroup, deleteTabGroup } = useTabGroupStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingName, setRenamingName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchTabGroups(currentVaultId || undefined)
  }, [currentVaultId, fetchTabGroups])

  const q = query.toLowerCase()
  const filteredHosts = hosts.filter(
    (host) =>
      host.name.toLowerCase().includes(q) || host.address.toLowerCase().includes(q),
  )
  const presetMatches = tabGroups.filter((g) => g.name.toLowerCase().includes(q))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const noExactHost = !hosts.some(
    (h) => h.name.toLowerCase() === q || h.address.toLowerCase() === q,
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filteredHosts.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      if (filteredHosts[selectedIndex]) {
        onConnect(filteredHosts[selectedIndex])
      } else if (query) {
        handleDirectConnect()
      }
    }
  }

  const handleDirectConnect = () => {
    const match = query.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/)
    if (match) {
      const [, username, address, port] = match
      onConnect({
        id: `direct_${Date.now()}`,
        name: address,
        address,
        port: Number.parseInt(port || '22'),
        username: username || 'root',
        authType: 'password',
      })
    }
  }

  const openRename = (id: string, name: string) => {
    setRenamingId(id)
    setRenamingName(name)
  }

  const handleRenameSubmit = (name: string) => {
    if (renamingId) renameTabGroup(renamingId, name)
    setRenamingId(null)
  }

  const showPresets = !query || presetMatches.length > 0
  const showHosts = !query || filteredHosts.length > 0

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700">
        <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search hosts or presets"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm text-white bg-transparent placeholder-dark-400 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-xs text-dark-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {query && !filteredHosts.some(
          (h) => h.name.toLowerCase() === q || h.address.toLowerCase() === q,
        ) && (
          <button
            onClick={handleDirectConnect}
            className="flex items-center w-full gap-3 px-4 py-3 text-left hover:bg-dark-800"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-sm text-white">Connect to {query}</div>
              <div className="text-xs text-dark-400">Direct connection</div>
            </div>
          </button>
        )}

        {/* Quick Presets section */}
        {showPresets && (
          <div className="pb-2">
            <h3 className="px-4 pt-4 pb-1 text-sm font-semibold tracking-wider uppercase text-dark-400">Quick Presets</h3>
            {presetMatches.length === 0 ? (
              <div className="px-4 py-3 text-sm text-dark-500">
                {query ? 'No presets match your search' : 'No presets yet — split panes in a tab and click the save icon'}
              </div>
            ) : (
              presetMatches.map((g) => {
                const { paneCount, hosts: gHosts } = previewFromLayout(g.layout)
                return (
                  <div
                    key={g.id}
                    onClick={() => onRestorePreset(g)}
                    className="group relative flex items-center w-full gap-3 px-4 py-3 text-left cursor-pointer hover:bg-dark-800"
                  >
                    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-primary-600">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v5a1 1 0 001 1h5" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{g.name}</div>
                      <div className="text-xs text-dark-400 truncate">
                        {paneCount} pane{paneCount === 1 ? '' : 's'}
                        {gHosts.length > 0 && ` • ${gHosts.slice(0, 3).join(', ')}${gHosts.length > 3 ? ` +${gHosts.length - 3}` : ''}`}
                      </div>
                    </div>
                    <div className="absolute flex items-center gap-1 transition-opacity opacity-0 right-2 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); openRename(g.id, g.name) }}
                        className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-700"
                        title="Rename preset"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={async (e) => { e.stopPropagation(); if (await tauriConfirm('Delete this preset?', { title: 'Delete Preset', kind: 'warning' })) deleteTabGroup(g.id) }}
                        className="p-1 rounded text-dark-400 hover:text-red-500 hover:bg-dark-700"
                        title="Delete preset"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Hosts section */}
        {showHosts && (
          <div className="pb-2">
            <h3 className="px-4 pt-2 pb-1 text-sm font-semibold tracking-wider uppercase text-dark-400">Hosts</h3>
            {filteredHosts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-dark-500">
                {query ? 'No hosts match your search' : 'No hosts available — add a host or type a connection string'}
              </div>
            ) : (
              filteredHosts.map((host, index) => (
                <button
                  key={host.id}
                  onClick={() => onConnect(host)}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left ${
                    index === selectedIndex ? 'bg-dark-800' : 'hover:bg-dark-800'
                  }`}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg"
                    style={{ backgroundColor: host.color || '#64748b' }}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{host.name}</div>
                    <div className="text-xs text-dark-400">
                      {host.username ? `${host.username}@` : ''}{host.address}:{host.port}
                    </div>
                  </div>
                  {host.tags && host.tags.length > 0 && (
                    <div className="flex gap-1">
                      {host.tags.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-dark-700 text-dark-300 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* No results at all */}
        {query && !showPresets && !showHosts && noExactHost && (
          <div className="px-4 py-3 text-sm text-dark-500">
            No matches for “{query}”
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between px-4 py-2 text-xs border-t border-dark-700 text-dark-500">
        <span>↑↓ Navigate • ↵ Connect</span>
        <span>{filteredHosts.length} hosts</span>
      </div>

      <WorkspaceForm
        open={renamingId !== null}
        title="Rename Preset"
        submitLabel="Rename"
        initialName={renamingName}
        onSubmit={handleRenameSubmit}
        onClose={() => setRenamingId(null)}
      />
    </div>
  )
}
