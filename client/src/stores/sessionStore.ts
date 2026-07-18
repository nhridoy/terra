import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { getDeviceId } from '../lib/device'
import { triggerSync } from '../lib/sync'

interface SessionLogEntry {
  id: string
  hostId: string
  hostName: string
  userId: string
  username: string
  command: string
  output?: string
  exitCode?: number
  startTime: string
  endTime?: string
  duration?: number
}

interface Session {
  id: string
  hostId: string
  hostName: string
  userId: string
  startTime: string
  endTime?: string
  duration?: number
  commandCount: number
  isActive: boolean
}

interface SessionState {
  sessions: Session[]
  currentSession: Session | null
  logs: SessionLogEntry[]
  isLoading: boolean
  error: string | null
  isRecording: boolean

  fetchSessions: (hostId?: string) => Promise<void>
  fetchSessionLogs: (sessionId: string) => Promise<void>
  startSession: (hostId: string, hostName: string) => void
  endSession: () => void
  logCommand: (command: string, output?: string, exitCode?: number) => void
  deleteSession: (id: string) => Promise<void>
  clearError: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  logs: [],
  isLoading: false,
  error: null,
  isRecording: false,

  fetchSessions: async (_hostId?) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<any[]>('list_session_logs', { userId: '' })
      set({ sessions: result || [], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  fetchSessionLogs: async (sessionId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await invoke<any>('get_session_log', { id: sessionId })
      set({ logs: result ? [result] : [], isLoading: false })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  startSession: (hostId, hostName) => {
    const session: Session = {
      id: `session_${Date.now()}`,
      hostId,
      hostName,
      userId: 'current_user',
      startTime: new Date().toISOString(),
      commandCount: 0,
      isActive: true,
    }
    set({ currentSession: session, isRecording: true })
  },

  endSession: () => {
    const { currentSession } = get()
    if (currentSession) {
      const updatedSession = {
        ...currentSession,
        endTime: new Date().toISOString(),
        duration: Date.now() - new Date(currentSession.startTime).getTime(),
        isActive: false,
      }
      set({
        sessions: [updatedSession, ...get().sessions],
        currentSession: null,
        isRecording: false,
      })
    }
  },

  logCommand: (command, output, exitCode) => {
    const { currentSession } = get()
    if (currentSession) {
      const log: SessionLogEntry = {
        id: `log_${Date.now()}`,
        hostId: currentSession.hostId,
        hostName: currentSession.hostName,
        userId: currentSession.userId,
        username: 'current_user',
        command,
        output,
        exitCode,
        startTime: new Date().toISOString(),
      }
      set({
        logs: [...get().logs, log],
        currentSession: {
          ...currentSession,
          commandCount: currentSession.commandCount + 1,
        },
      })
    }
  },

  deleteSession: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = await getDeviceId()
      await invoke('delete_session_log', { id, deviceId })
      await triggerSync()
      set({
        sessions: get().sessions.filter((s) => s.id !== id),
        isLoading: false,
      })
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
