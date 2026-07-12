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
      const result = await api.listTeams()
      set({ teams: result.teams, isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createTeam: async (team) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.createTeam(team)
      set({
        teams: [...get().teams, result.team],
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateTeam: async (id, team) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.updateTeam(id, team)
      set({
        teams: get().teams.map((t) => (t.id === id ? result.team : t)),
        selectedTeam:
          get().selectedTeam?.id === id ? result.team : get().selectedTeam,
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  deleteTeam: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteTeam(id)
      set({
        teams: get().teams.filter((t) => t.id !== id),
        selectedTeam: get().selectedTeam?.id === id ? null : get().selectedTeam,
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  selectTeam: (team) => set({ selectedTeam: team }),

  addMember: async (teamId, email, role) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.addTeamMember(teamId, { email, role })
      const updatedTeam = get().teams.find((t) => t.id === teamId)
      if (updatedTeam) {
        const newTeam = {
          ...updatedTeam,
          members: [...updatedTeam.members, result.member],
        }
        set({
          teams: get().teams.map((t) => (t.id === teamId ? newTeam : t)),
          selectedTeam:
            get().selectedTeam?.id === teamId ? newTeam : get().selectedTeam,
          isLoading: false,
        })
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  removeMember: async (teamId, userId) => {
    set({ isLoading: true, error: null })
    try {
      await api.removeTeamMember(teamId, userId)
      const updatedTeam = get().teams.find((t) => t.id === teamId)
      if (updatedTeam) {
        const newTeam = {
          ...updatedTeam,
          members: updatedTeam.members.filter((m) => m.userId !== userId),
        }
        set({
          teams: get().teams.map((t) => (t.id === teamId ? newTeam : t)),
          selectedTeam:
            get().selectedTeam?.id === teamId ? newTeam : get().selectedTeam,
          isLoading: false,
        })
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateMemberRole: async (teamId, userId, role) => {
    set({ isLoading: true, error: null })
    try {
      await api.updateTeamMemberRole(teamId, userId, role)
      const updatedTeam = get().teams.find((t) => t.id === teamId)
      if (updatedTeam) {
        const newTeam: Team = {
          ...updatedTeam,
          members: updatedTeam.members.map((m) =>
            m.userId === userId ? { ...m, role: role as 'owner' | 'admin' | 'member' } : m,
          ),
        }
        set({
          teams: get().teams.map((t) => (t.id === teamId ? newTeam : t)),
          selectedTeam:
            get().selectedTeam?.id === teamId ? newTeam : get().selectedTeam,
          isLoading: false,
        })
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  leaveTeam: async (teamId) => {
    set({ isLoading: true, error: null })
    try {
      await api.leaveTeam(teamId)
      set({
        teams: get().teams.filter((t) => t.id !== teamId),
        selectedTeam:
          get().selectedTeam?.id === teamId ? null : get().selectedTeam,
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
