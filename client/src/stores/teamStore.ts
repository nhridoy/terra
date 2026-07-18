import { create } from 'zustand'

interface TeamMember {
  id: string
  userId: string
  username: string
  email: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

interface Team {
  id: string
  name: string
  description?: string
  ownerId: string
  members: TeamMember[]
  createdAt: string
  updatedAt: string
}

interface TeamState {
  teams: Team[]
  selectedTeam: Team | null
  isLoading: boolean
  error: string | null

  fetchTeams: () => Promise<void>
  createTeam: (team: Partial<Team>) => Promise<void>
  updateTeam: (id: string, team: Partial<Team>) => Promise<void>
  deleteTeam: (id: string) => Promise<void>
  selectTeam: (team: Team | null) => void
  addMember: (teamId: string, email: string, role: string) => Promise<void>
  removeMember: (teamId: string, userId: string) => Promise<void>
  updateMemberRole: (teamId: string, userId: string, role: string) => Promise<void>
  leaveTeam: (teamId: string) => Promise<void>
  clearError: () => void
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  selectedTeam: null,
  isLoading: false,
  error: 'Teams feature is not available in sync-only mode',

  fetchTeams: async () => {
    set({ isLoading: false })
  },
  createTeam: async () => {
    set({ error: 'Teams feature is not available in sync-only mode' })
  },
  updateTeam: async () => {
    set({ error: 'Teams feature is not available in sync-only mode' })
  },
  deleteTeam: async () => {
    set({ error: 'Teams feature is not available in sync-only mode' })
  },
  selectTeam: (team) => set({ selectedTeam: team }),
  addMember: async () => {
    set({ error: 'Teams feature is not available in sync-only mode' })
  },
  removeMember: async () => {
    set({ error: 'Teams feature is not available in sync-only mode' })
  },
  updateMemberRole: async () => {
    set({ error: 'Teams feature is not available in sync-only mode' })
  },
  leaveTeam: async () => {
    set({ error: 'Teams feature is not available in sync-only mode' })
  },
  clearError: () => set({ error: null }),
}))
