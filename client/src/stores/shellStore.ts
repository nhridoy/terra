import { create } from "zustand";
import { detectShells, type ShellInfo } from "../lib/shellDetection";

interface ShellStore {
  shells: ShellInfo[];
  detected: boolean;
  detect: () => void;
}

export const useShellStore = create<ShellStore>((set) => ({
  shells: [],
  detected: false,
  detect: () => {
    detectShells().then((shells) => set({ shells, detected: true }));
  },
}));
