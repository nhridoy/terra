import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useHostStore } from '../../stores/hostStore'
import { useTerminalStore } from '../../stores/terminalStore'
import HostForm from '../hosts/HostForm'
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
  const [editingHost, setEditingHost] = useState<any>(null)

  const filteredHosts = hosts.filter(
    (host) =>
      host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.address.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleConnect = (host: any) => {
    selectHost(host)
    addTab(host.id, host.name)
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
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
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
            onClick={logout}
            className="text-dark-400 hover:text-white p-1"
            title="Logout"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Host Form Modal */}
      {showHostForm && (
        <HostForm
          host={editingHost}
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
  host: any
  onConnect: (host: any) => void
  onSftp: (host: any) => void
  onEdit: (host: any) => void
}) {
  return (
    <div
      onClick={() => onConnect(host)}
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
          onClick={(e) => {
            e.stopPropagation()
            onEdit(host)
          }}
          className="text-dark-400 hover:text-yellow-500"
          title="Edit host"
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSftp(host)
          }}
          className="text-dark-400 hover:text-primary-500"
          title="Open SFTP"
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
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onConnect(host)
          }}
          className="text-primary-500 hover:text-primary-400"
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
