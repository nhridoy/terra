import { create } from "zustand";

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { username?: string; email?: string }) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  error: null,

  restoreSession: async () => {
    // TODO: check stored token, call /me endpoint
    await new Promise((r) => setTimeout(r, 300));
    set({ isInitialized: true });
  },

  login: async (email: string, _password: string) => {
    set({ isLoading: true, error: null });
    await new Promise((r) => setTimeout(r, 500));
    set({
      user: { id: "1", email, username: email.split("@")[0] },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  register: async (email: string, username: string, _password: string) => {
    set({ isLoading: true, error: null });
    await new Promise((r) => setTimeout(r, 500));
    set({
      user: { id: "1", email, username },
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    set({ user: null, isAuthenticated: false });
  },

  updateProfile: async (data) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    }));
  },

  changePassword: async (_currentPassword: string, _newPassword: string) => {
    // TODO: call real API
  },

  clearError: () => set({ error: null }),
}));
