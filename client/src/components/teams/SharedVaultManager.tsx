import { useEffect, useState } from 'react'
import { useSharedVaultStore } from '../../stores/sharedVaultStore'
import Modal from '../ui/Modal'

interface SharedVaultManagerProps {
  teamId: string
}

export default function SharedVaultManager({
  teamId,
}: SharedVaultManagerProps) {
  const {
    sharedVaults,
    selectedSharedVault,
    isUnlocked,
    decryptedData,
    fetchSharedVaults,
    createSharedVault,
    deleteSharedVault,
    selectSharedVault,
    unlockSharedVault,
    lockSharedVault,
    addMember,
  } = useSharedVaultStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [vaultName, setVaultName] = useState('')
  const [vaultDescription, setVaultDescription] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('member')

  useEffect(() => {
    if (teamId) {
      fetchSharedVaults(teamId)
    }
  }, [teamId, fetchSharedVaults])

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault()
    await createSharedVault(
      {
        name: vaultName,
        description: vaultDescription,
        teamId,
      },
      vaultPassword,
    )
    setShowCreateModal(false)
    setVaultName('')
    setVaultDescription('')
    setVaultPassword('')
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    await unlockSharedVault(unlockPassword)
    setShowUnlockModal(false)
    setUnlockPassword('')
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSharedVault) {
      await addMember(selectedSharedVault.id, memberEmail, memberRole)
      setShowMembersModal(false)
      setMemberEmail('')
      setMemberRole('member')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Shared Vaults</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            + New Vault
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Vault List */}
        <div className="w-64 border-r border-dark-700 overflow-y-auto">
          {sharedVaults.length === 0 ? (
            <div className="p-4 text-center text-dark-400">
              <p>No shared vaults</p>
              <p className="text-sm mt-2">Create a vault for your team</p>
            </div>
          ) : (
            sharedVaults.map((vault) => (
              <div
                key={vault.id}
                onClick={() => selectSharedVault(vault)}
                className={`p-3 cursor-pointer border-b border-dark-700 ${
                  selectedSharedVault?.id === vault.id
                    ? 'bg-primary-600/20 border-l-2 border-l-primary-500'
                    : 'hover:bg-dark-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-primary-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">
                      {vault.name}
                    </div>
                    <div className="text-dark-400 text-sm">
                      {vault.members?.length || 0} members
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${isUnlocked && selectedSharedVault?.id === vault.id ? 'bg-green-500' : 'bg-dark-500'}`}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Vault Details */}
        <div className="flex-1 overflow-y-auto">
          {selectedSharedVault ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {selectedSharedVault.name}
                  </h3>
                  {selectedSharedVault.description && (
                    <p className="text-dark-400 mt-1">
                      {selectedSharedVault.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {isUnlocked ? (
                    <button
                      onClick={lockSharedVault}
                      className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Lock
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowUnlockModal(true)}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Unlock
                    </button>
                  )}
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Members
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('Delete this vault?')) {
                        await deleteSharedVault(selectedSharedVault.id)
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Vault Content */}
              {isUnlocked ? (
                <div className="bg-dark-800 rounded-xl p-4">
                  <h4 className="text-white font-medium mb-4">
                    Vault Contents
                  </h4>
                  <div className="text-dark-400">
                    {decryptedData ? (
                      <div className="space-y-2">
                        <div>Hosts: {decryptedData.hosts?.length || 0}</div>
                        <div>Keys: {decryptedData.keys?.length || 0}</div>
                        <div>
                          Snippets: {decryptedData.snippets?.length || 0}
                        </div>
                      </div>
                    ) : (
                      <p>No data loaded</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-dark-800 rounded-xl p-8 text-center">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-dark-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <p className="text-dark-400">
                    Unlock the vault to view contents
                  </p>
                </div>
              )}

              {/* Members List */}
              <div className="mt-6 bg-dark-800 rounded-xl p-4">
                <h4 className="text-white font-medium mb-4">
                  Members ({selectedSharedVault.members?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedSharedVault.members?.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between p-3 bg-dark-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-dark-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm">
                            {member.username?.charAt(0).toUpperCase() ||
                              member.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-white text-sm">
                            {member.username || member.email}
                          </div>
                          <div className="text-dark-400 text-xs">
                            {member.email}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          member.role === 'owner'
                            ? 'bg-purple-500/20 text-purple-400'
                            : member.role === 'admin'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-dark-600 text-dark-300'
                        }`}
                      >
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-dark-400">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-dark-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <p>Select a vault to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Vault Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Create Shared Vault
            </h3>
            <form onSubmit={handleCreateVault} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">Name</label>
                <input
                  type="text"
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Team Secrets"
                  required
                />
              </div>
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Description
                </label>
                <textarea
                  value={vaultDescription}
                  onChange={(e) => setVaultDescription(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Vault password"
                  required
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

      {/* Unlock Modal */}
      {showUnlockModal && (
        <Modal onClose={() => setShowUnlockModal(false)}>
          <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Unlock Vault
            </h3>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter vault password"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-4 py-2 text-dark-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <Modal onClose={() => setShowMembersModal(false)}>
          <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Manage Members
            </h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-dark-300 text-sm mb-2">Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowMembersModal(false)}
                  className="px-4 py-2 text-dark-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  )
}
