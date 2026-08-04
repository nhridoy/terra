import { create } from "zustand";

interface SharedVault {
  id: string;
  name: string;
  teamId: string;
  vaultId: string;
  createdAt: string;
}

interface SharedVaultState {
  sharedVaults: SharedVault[];
  selectedSharedVault: SharedVault | null;
  isLoading: boolean;
  error: string | null;

  fetchSharedVaults: (teamId: string) => Promise<void>;
  createSharedVault: (
    teamId: string,
    vaultId: string,
    name?: string,
  ) => Promise<void>;
  deleteSharedVault: (teamId: string, vaultId: string) => Promise<void>;
  selectSharedVault: (vault: SharedVault | null) => void;
  clearError: () => void;
}

export const useSharedVaultStore = create<SharedVaultState>((set) => ({
  sharedVaults: [],
  selectedSharedVault: null,
  isLoading: false,
  error: null,

  fetchSharedVaults: async () => {},
  createSharedVault: async () => {},
  deleteSharedVault: async () => {},
  selectSharedVault: (vault) => set({ selectedSharedVault: vault }),
  clearError: () => {},
}));
