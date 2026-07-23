import { create } from "zustand";

interface Key {
  id: string;
  name: string;
  description?: string;
  keyType: string;
  publicKey: string;
  encryptedPrivateKey: string;
  fingerprint?: string;
  createdAt: string;
}

interface KeyState {
  keys: Key[];
  selectedKey: Key | null;
  isLoading: boolean;
  error: string | null;

  fetchKeys: (vaultId?: string) => Promise<void>;
  selectKey: (key: Key | null) => void;
  importKey: (key: Partial<Key>) => Promise<void>;
  generateKey: (name: string, keyType: string) => Promise<void>;
  deleteKey: (id: string) => Promise<void>;
  getCredentialsForKey: (keyId: string) => Promise<string>;
  clearError: () => void;
}

export const useKeyStore = create<KeyState>((set) => ({
  keys: [],
  selectedKey: null,
  isLoading: false,
  error: null,

  fetchKeys: async () => {},
  selectKey: (key) => set({ selectedKey: key }),
  importKey: async () => {},
  generateKey: async () => {},
  deleteKey: async () => {},
  getCredentialsForKey: async () => "",
  clearError: () => {},
}));
