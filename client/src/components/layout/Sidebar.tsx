import { Folder, Lightning, PencilSimple, SignOut } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { type Host, useHostStore } from '../../stores/hostStore'
import { useTerminalStore } from '../../stores/terminalStore'
import HostForm, { type HostData } from '../hosts/HostForm'
import KeyList from '../keychain/KeyList'
import SftpView from '../sftp/SftpView'
import SnippetList from '../snippets/SnippetList'
import VaultList from '../vault/VaultList'

export default function Sidebar() {
  const { hosts, groups, selectHost } = useHostStore()
  const { addTab } = useTerminalStore()
  const { user, logout } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState<
    'hosts' | 'vaults' | 'keys' | 'snippets' | 'sftp'
  >('hosts')
  const [sftpHost, setSftpHost] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [showHostForm, setShowHostForm] = useState(false)
  const [editingHost, setEditingHost] = useState<Host | null>(null)

  const filteredHosts = hosts.filter(
    (host) =>
      host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.address.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleConnect = (host: Host) => {
    selectHost(host)
    addTab(host.id, host.name, {
      hostAddress: host.address,
      hostPort: host.port,
      hostUsername: host.username,
      authType: host.authType,
      keyId: host.keyId,
    })
  }

  return (
    <div className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">TV</span>
          </div>
          <span className="text-white font-semibold">TermVault</span>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <input
          type="text"
          placeholder="Search hosts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-dark-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Add Host Button */}
      {activeSection === 'hosts' && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => setShowHostForm(true)}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg text-sm"
          >
            + Add Host
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-dark-700">
        {(['hosts', 'vaults', 'keys', 'snippets', 'sftp'] as const).map(
          (section) => (
            <button
              type="button"
              key={section}
              onClick={() => setActiveSection(section)}
              className={`flex-1 py-2 text-xs font-medium capitalize ${
                activeSection === section
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              {section}
            </button>
          ),
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeSection === 'hosts' && (
          <div>
            {/* Groups */}
            {groups.map((group) => (
              <div key={group.id} className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1 text-dark-400 text-sm">
                  <Folder className="w-4 h-4" weight="bold" />
                  <span>{group.name}</span>
                </div>

                {/* Hosts in group */}
                {filteredHosts
                  .filter((host) => host.groupId === group.id)
                  .map((host) => (
                    <HostItem
                      key={host.id}
                      host={host}
                      onConnect={handleConnect}
                      onSftp={(h) => setSftpHost({ id: h.id, name: h.name })}
                      onEdit={(h) => {
                        setEditingHost(h)
                        setShowHostForm(true)
                      }}
                    />
                  ))}
              </div>
            ))}

            {/* Ungrouped hosts */}
            {filteredHosts
              .filter((host) => !host.groupId)
              .map((host) => (
                <HostItem
                  key={host.id}
                  host={host}
                  onConnect={handleConnect}
                  onSftp={(h) => setSftpHost({ id: h.id, name: h.name })}
                  onEdit={(h) => {
                    setEditingHost(h)
                    setShowHostForm(true)
                  }}
                />
              ))}

            {filteredHosts.length === 0 && (
              <div className="text-center text-dark-400 py-8">
                <p>No hosts found</p>
                <p className="text-sm mt-2">Add a host to get started</p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'vaults' && <VaultList />}
        {activeSection === 'keys' && <KeyList />}
        {activeSection === 'snippets' && <SnippetList />}
        {activeSection === 'sftp' && (
          <div className="h-full">
            {sftpHost ? (
              <SftpView hostId={sftpHost.id} hostName={sftpHost.name} />
            ) : (
              <div className="text-center text-dark-400 py-8">
                <p>SFTP Browser</p>
                <p className="text-sm mt-2">Select a host to browse files</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-dark-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-white text-sm truncate">
              {user?.username}
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-dark-400 hover:text-white p-1"
            title="Logout"
          >
            <SignOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Host Form Modal */}
      {showHostForm && (
        <HostForm
          host={
            editingHost
              ? ({
                  id: editingHost.id,
                  name: editingHost.name,
                  address: editingHost.address,
                  port: editingHost.port,
                  username: editingHost.username || 'root',
                  authType: 'password',
                  color: editingHost.color,
                  groupId: editingHost.groupId || undefined,
                  tags: editingHost.tags,
                } satisfies HostData)
              : undefined
          }
          onClose={() => {
            setShowHostForm(false)
            setEditingHost(null)
          }}
        />
      )}
    </div>
  )
}

function HostItem({
  host,
  onConnect,
  onSftp,
  onEdit,
}: {
  host: Host
  onConnect: (host: Host) => void
  onSftp: (host: Host) => void
  onEdit: (host: Host) => void
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: contains nested <button> elements for edit/sftp/connect
    <div
      role="button"
      tabIndex={0}
      onClick={() => onConnect(host)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onConnect(host)
        }
      }}
      className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-dark-800 group"
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: host.color || '#64748b' }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm truncate">{host.name}</div>
        <div className="text-dark-400 text-xs truncate">{host.address}</div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(host)
          }}
          className="text-dark-400 hover:text-yellow-500"
          title="Edit host"
        >
          <PencilSimple className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSftp(host)
          }}
          className="text-dark-400 hover:text-primary-500"
          title="Open SFTP"
        >
          <Folder className="w-4 h-4" weight="bold" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onConnect(host)
          }}
          className="text-primary-500 hover:text-primary-400"
        >
          <Lightning className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
