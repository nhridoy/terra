import { useEffect, useState } from 'react'
import { useTeamStore } from '../../stores/teamStore'
import Modal from '../ui/Modal'

export default function TeamManager() {
  const {
    teams,
    selectedTeam,
    fetchTeams,
    createTeam,
    deleteTeam,
    selectTeam,
    addMember,
    removeMember,
    updateMemberRole,
  } = useTeamStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    await createTeam({
      name: teamName,
      description: teamDescription,
    })
    setShowCreateModal(false)
    setTeamName('')
    setTeamDescription('')
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedTeam) {
      await addMember(selectedTeam.id, inviteEmail, inviteRole)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('member')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (selectedTeam && confirm('Remove this member?')) {
      await removeMember(selectedTeam.id, userId)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (selectedTeam) {
      await updateMemberRole(selectedTeam.id, userId, newRole)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/20 text-purple-400'
      case 'admin':
        return 'bg-blue-500/20 text-blue-400'
      default:
        return 'bg-dark-600 text-dark-300'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Teams</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            + New Team
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Team List */}
        <div className="w-64 border-r border-dark-700 overflow-y-auto">
          {teams.length === 0 ? (
            <div className="p-4 text-center text-dark-400">
              <p>No teams yet</p>
              <p className="text-sm mt-2">Create or join a team</p>
            </div>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                onClick={() => selectTeam(team)}
                className={`p-3 cursor-pointer border-b border-dark-700 ${
                  selectedTeam?.id === team.id
                    ? 'bg-primary-600/20 border-l-2 border-l-primary-500'
                    : 'hover:bg-dark-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center">
                    <span className="text-white font-medium">
                      {team.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">
                      {team.name}
                    </div>
                    <div className="text-dark-400 text-sm">
                      {team.members?.length || 0} members
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Team Details */}
        <div className="flex-1 overflow-y-auto">
          {selectedTeam ? (
            <div className="p-6">
              {/* Team Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {selectedTeam.name}
                  </h3>
                  {selectedTeam.description && (
                    <p className="text-dark-400 mt-1">
                      {selectedTeam.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Invite Member
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('Delete this team?')) {
                        await deleteTeam(selectedTeam.id)
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Delete Team
                  </button>
                </div>
              </div>

              {/* Members */}
              <div className="bg-dark-800 rounded-xl p-4">
                <h4 className="text-white font-medium mb-4">
                  Members ({selectedTeam.members?.length || 0})
                </h4>
                <div className="space-y-3">
                  {selectedTeam.members?.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-dark-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-dark-600 rounded-full flex items-center justify-center">
                          <span className="text-white">
                            {member.username?.charAt(0).toUpperCase() ||
                              member.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-white">
                            {member.username || member.email}
                          </div>
                          <div className="text-dark-400 text-sm">
                            {member.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${getRoleBadgeColor(member.role)}`}
                        >
                          {member.role}
                        </span>
                        {member.role !== 'owner' && (
                          <div className="flex gap-1">
                            <select
                              value={member.role}
                              onChange={(e) =>
                                handleRoleChange(member.userId, e.target.value)
                              }
                              className="bg-dark-600 text-white px-2 py-1 rounded text-sm"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
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
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p>Select a team to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Create Team
            </h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="My Team"
                  required
                />
              </div>
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Description
                </label>
                <textarea
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
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

      {/* Invite Member Modal */}
      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)}>
          <div className="bg-dark-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Invite Member
            </h3>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-dark-300 text-sm mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-dark-300 text-sm mb-2">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full bg-dark-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-dark-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  )
}
