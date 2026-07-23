import { create } from "zustand";

interface Settings {
  id: string;
  userId: string;
  theme: string;
  fontFamily: string;
  fontSize: number;
  cursorStyle: string;
}

interface SettingsState {
  settings: Settings | null;
  isLoading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (
    data: Partial<Omit<Settings, "id" | "userId">>,
  ) => Promise<void>;
  clearError: () => void;
}

export const useSettingsStore = create<SettingsState>((_set) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {},
  updateSettings: async () => {},
  clearError: () => {},
}));
