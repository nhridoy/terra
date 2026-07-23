import { create } from "zustand";

interface SessionLogEntry {
  id: string;
  hostId: string;
  hostName: string;
  userId: string;
  username: string;
  command: string;
  output?: string;
  exitCode?: number;
  startTime: string;
  endTime?: string;
  duration?: number;
}

interface Session {
  id: string;
  hostId: string;
  hostName: string;
  userId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  commandCount: number;
  isActive: boolean;
}

interface SessionState {
  sessions: Session[];
  selectedSession: Session | null;
  logs: SessionLogEntry[];
  isRecording: boolean;
  isLoading: boolean;
  error: string | null;

  fetchSessions: (hostId?: string) => Promise<void>;
  selectSession: (session: Session | null) => void;
  fetchLogs: (sessionId: string) => Promise<void>;
  fetchSessionLogs: (sessionId: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  selectedSession: null,
  logs: [],
  isRecording: false,
  isLoading: false,
  error: null,

  fetchSessions: async () => {},
  selectSession: (session) => set({ selectedSession: session }),
  fetchLogs: async () => {},
  fetchSessionLogs: async () => {},
  deleteSession: async () => {},
  clearError: () => {},
}));
