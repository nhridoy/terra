import { create } from 'zustand'
import api from '../lib/api'

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
  members?: TeamMember[]
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
  fetchTeamDetails: (teamId: string) => Promise<void>
  addMember: (teamId: string, email: string, role: string) => Promise<void>
  removeMember: (teamId: string, userId: string) => Promise<void>
  updateMemberRole: (
    teamId: string,
    userId: string,
    role: string,
  ) => Promise<void>
  leaveTeam: (teamId: string) => Promise<void>
  clearError: () => void
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  selectedTeam: null,
  isLoading: false,
  error: null,

  fetchTeams: async () => {
    set({ isLoading: true, error: null })
    try {
      const teams = await api.get<Team[]>('/teams')
      set({ teams, isLoading: false })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  createTeam: async (teamData) => {
    set({ isLoading: true, error: null })
    try {
      const team = await api.post<Team>('/teams', teamData)
      set({ teams: [...get().teams, team], isLoading: false })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  updateTeam: async (id, teamData) => {
    set({ isLoading: true, error: null })
    try {
      const team = await api.put<Team>(`/teams/${id}`, teamData)
      set({
        teams: get().teams.map((t) => (t.id === id ? team : t)),
        selectedTeam: get().selectedTeam?.id === id ? team : get().selectedTeam,
        isLoading: false,
      })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  deleteTeam: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.delete(`/teams/${id}`)
      set({
        teams: get().teams.filter((t) => t.id !== id),
        selectedTeam: get().selectedTeam?.id === id ? null : get().selectedTeam,
        isLoading: false,
      })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  selectTeam: (team) => set({ selectedTeam: team }),

  fetchTeamDetails: async (teamId) => {
    set({ isLoading: true, error: null })
    try {
      const data = await api.get<{ team: Team; members: TeamMember[] }>(
        `/teams/${teamId}`,
      )
      const team = { ...data.team, members: data.members }
      set({
        selectedTeam: team,
        teams: get().teams.map((t) => (t.id === teamId ? team : t)),
        isLoading: false,
      })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  addMember: async (teamId, email, role) => {
    set({ isLoading: true, error: null })
    try {
      await api.post(`/teams/${teamId}/members`, { email, role })
      // Refresh team details to get updated member list
      await get().fetchTeamDetails(teamId)
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  removeMember: async (teamId, userId) => {
    set({ isLoading: true, error: null })
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`)
      // Refresh team details
      await get().fetchTeamDetails(teamId)
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  updateMemberRole: async (teamId, userId, role) => {
    set({ isLoading: true, error: null })
    try {
      await api.put(`/teams/${teamId}/members/${userId}/role`, { role })
      // Refresh team details
      await get().fetchTeamDetails(teamId)
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  leaveTeam: async (teamId) => {
    set({ isLoading: true, error: null })
    try {
      // Get current user ID from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (!user.id) throw new Error('Not authenticated')
      await api.delete(`/teams/${teamId}/members/${user.id}`)
      set({
        teams: get().teams.filter((t) => t.id !== teamId),
        selectedTeam:
          get().selectedTeam?.id === teamId ? null : get().selectedTeam,
        isLoading: false,
      })
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  clearError: () => set({ error: null }),
}))
