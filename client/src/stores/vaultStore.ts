import { create } from "zustand";

interface VaultItem {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VaultDecryptedData {
  hosts?: unknown[];
  keys?: unknown[];
  snippets?: unknown[];
  groups?: unknown[];
  history?: unknown[];
}

interface VaultState {
  vaults: VaultItem[];
  currentVaultId: string | null;
  decryptedData: VaultDecryptedData | null;
  isLoading: boolean;
  error: string | null;

  fetchVaults: () => Promise<void>;
  createVault: (name: string, description?: string) => Promise<void>;
  updateVault: (id: string, vault: Partial<VaultItem>) => Promise<void>;
  deleteVault: (id: string) => Promise<void>;
  switchVault: (vaultId: string) => Promise<void>;
  clearError: () => void;
}

export const useVaultStore = create<VaultState>((_set) => ({
  vaults: [],
  currentVaultId: null,
  decryptedData: null,
  isLoading: false,
  error: null,

  fetchVaults: async () => {},
  createVault: async () => {},
  updateVault: async () => {},
  deleteVault: async () => {},
  switchVault: async () => {},
  clearError: () => {},
}));
