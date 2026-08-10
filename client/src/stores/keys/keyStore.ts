import { create } from "zustand";
import { decryptRowData, encryptRowData } from "@/lib/crypto/crypto";
import type { SyncRow } from "@/lib/db/db";
import { deleteRow, getRow, listRows, upsertRow } from "@/lib/db/db";
import { useVaultStore } from "@/stores/vault/vaultStore";

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

interface KeyPayload {
  keyType: string;
  publicKey: string;
  privateKey: string;
  passphrase?: string;
  fingerprint?: string;
}

function newId(): string {
  return crypto.randomUUID();
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function keyFromRow(row: SyncRow): Promise<Key> {
  const payload = (await decryptRowData(row.data)) as Partial<KeyPayload>;
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? undefined,
    keyType: payload.keyType ?? "ed25519",
    publicKey: payload.publicKey ?? "",
    encryptedPrivateKey: payload.privateKey ?? "",
    fingerprint: payload.fingerprint,
    createdAt: String(row.created_at),
  };
}

export const useKeyStore = create<KeyState>((set, get) => ({
  keys: [],
  selectedKey: null,
  isLoading: false,
  error: null,

  fetchKeys: async (vaultId) => {
    const vid = vaultId ?? useVaultStore.getState().currentVaultId;
    if (!vid) {
      set({ isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const rows = await listRows("keys", vid);
      const keys = await Promise.all(rows.map((row) => keyFromRow(row)));
      set({ keys, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: errorMessage(err) });
    }
  },

  selectKey: (key) => set({ selectedKey: key }),

  importKey: async (key) => {
    const vaultId = useVaultStore.getState().currentVaultId;
    if (!vaultId) {
      set({ isLoading: false, error: "No vault selected" });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const row = await upsertRow("keys", {
        id: key.id ?? newId(),
        vault_id: vaultId,
        name: key.name ?? "",
        description: key.description ?? null,
        sort_order: 0,
        data: await encryptRowData("keys", {
          keyType: key.keyType ?? "ed25519",
          publicKey: key.publicKey ?? "",
          privateKey: key.encryptedPrivateKey ?? "",
          passphrase: undefined,
          fingerprint: key.fingerprint,
        }),
      });
      const created: Key = {
        id: row.id,
        name: row.name ?? "",
        description: row.description ?? undefined,
        keyType: key.keyType ?? "ed25519",
        publicKey: key.publicKey ?? "",
        encryptedPrivateKey: key.encryptedPrivateKey ?? "",
        fingerprint: key.fingerprint,
        createdAt: String(row.created_at),
      };
      set({ keys: [created, ...get().keys], isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: errorMessage(err) });
    }
  },

  generateKey: async (name, keyType) => {
    const vaultId = useVaultStore.getState().currentVaultId;
    if (!vaultId) {
      set({ isLoading: false, error: "No vault selected" });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const row = await upsertRow("keys", {
        id: newId(),
        vault_id: vaultId,
        name: name ?? "",
        description: null,
        sort_order: 0,
        data: await encryptRowData("keys", {
          keyType: keyType ?? "ed25519",
          publicKey: "",
          privateKey: "",
          passphrase: undefined,
          fingerprint: undefined,
        }),
      });
      const created: Key = {
        id: row.id,
        name: row.name ?? "",
        keyType: keyType ?? "ed25519",
        publicKey: "",
        encryptedPrivateKey: "",
        createdAt: String(row.created_at),
      };
      set({ keys: [created, ...get().keys], isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: errorMessage(err) });
    }
  },

  deleteKey: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteRow("keys", id);
      set((s) => ({
        keys: s.keys.filter((k) => k.id !== id),
        selectedKey: s.selectedKey?.id === id ? null : s.selectedKey,
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false, error: errorMessage(err) });
    }
  },

  getCredentialsForKey: async (keyId) => {
    const row = await getRow("keys", keyId);
    if (!row) {
      return "";
    }
    const payload = ((await decryptRowData(row.data)) ??
      {}) as Partial<KeyPayload>;
    return payload.privateKey ?? "";
  },

  clearError: () => set({ error: null }),
}));
