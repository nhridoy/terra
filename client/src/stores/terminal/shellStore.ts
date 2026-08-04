import { create } from "zustand";
import { detectShells, type ShellInfo } from "@/lib/terminal/shellDetection";

interface ShellStore {
  shells: ShellInfo[];
  detected: boolean;
  detect: () => Promise<void>;
}

export const useShellStore = create<ShellStore>((set) => ({
  shells: [],
  detected: false,
  detect: () =>
    detectShells().then((shells) => set({ shells, detected: true })),
}));
