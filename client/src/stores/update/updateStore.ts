import { create } from "zustand";

interface UpdateState {
  updateAvailable: boolean;
  updateInfo: {
    version: string;
    notes: string;
    date: string;
  } | null;
  downloading: boolean;
  downloadProgress: number;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  updateAvailable: false,
  updateInfo: null,
  downloading: false,
  downloadProgress: 0,
  error: null,

  checkForUpdates: async () => {
    set({ updateAvailable: false });
  },
  downloadUpdate: async () => {},
  installUpdate: async () => {},
}));
