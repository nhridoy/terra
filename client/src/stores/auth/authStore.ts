import { create } from "zustand";
import { authApi, type TokenPair, type User } from "../../lib/api/auth";
import {
  computeLoginProof,
  deriveKek,
  generateAccountMaterial,
  lockSession,
  unwrapDek,
} from "../../lib/crypto/crypto";

interface AuthState {
  user: User | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  isUnlocked: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  prelogin: (email: string) => Promise<{
    nonce: string;
    kdf: { m: number; t: number; p: number };
    serverSalt: string;
    saltCl: string;
  }>;
  register: (email: string, name: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  unlock: (password: string) => Promise<void>;
  updateProfile: (data: { username?: string; email?: string }) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  clearError: () => void;
  restoreSession: () => Promise<void>;
}

const DEVICE_ID_KEY = "termvault:device_id";

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "default-device";
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isUnlocked: false,
  isInitialized: false,
  isLoading: false,
  error: null,

  prelogin: async (email: string) => {
    const res = await authApi.prelogin(email);
    return {
      nonce: res.nonce,
      kdf: res.kdf,
      serverSalt: res.server_salt,
      saltCl: res.salt_cl,
    };
  },

  register: async (email: string, _name: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const prelogin = await authApi.prelogin(email);

      const material = await generateAccountMaterial();
      await deriveKek(password, material.salt_cl);
      const proof = await computeLoginProof(
        prelogin.server_salt,
        prelogin.nonce,
      );

      const res = await authApi.register({
        user_id: material.public_key,
        email,
        password_hash: proof.verifier,
        encrypted_dek: material.private_key_wrapped_by_dek,
        encrypted_privkey: material.private_key_wrapped_by_dek,
        nonce: prelogin.nonce,
        kdf: prelogin.kdf,
        server_salt: prelogin.server_salt,
        salt_cl: material.salt_cl,
      });

      set({
        user: res.user,
        tokens: {
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        },
        isAuthenticated: true,
        isUnlocked: true,
        isLoading: false,
      });
    } catch (err) {
      const message =
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Registration failed";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const prelogin = await authApi.prelogin(email);

      await deriveKek(password, prelogin.salt_cl);
      const proof = await computeLoginProof(
        prelogin.server_salt,
        prelogin.nonce,
      );

      const res = await authApi.login({
        email,
        proof: proof.proof,
        nonce: prelogin.nonce,
        device_id: getDeviceId(),
        client_pubkey: "",
      });

      if (res.keyring) {
        await unwrapDek("", res.keyring.dek_wrapped_by_kek);
      }

      set({
        user: res.user,
        tokens: {
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        },
        isAuthenticated: true,
        isUnlocked: true,
        isLoading: false,
      });
    } catch (err) {
      const message =
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Login failed";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  refresh: async () => {
    const { tokens } = get();
    if (!tokens?.refresh_token) return;

    try {
      const newTokens = await authApi.refresh(tokens.refresh_token);
      set({
        tokens: {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
        },
      });
    } catch {
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isUnlocked: false,
      });
    }
  },

  logout: async () => {
    const { tokens } = get();
    if (tokens?.refresh_token) {
      try {
        await authApi.logout(tokens.refresh_token);
      } catch {
        // ignore logout errors
      }
    }
    await lockSession();
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isUnlocked: false,
    });
  },

  unlock: async (_password: string) => {
    // Unlock with password - requires keyring data
    set({ isUnlocked: true });
  },

  updateProfile: async (data) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    }));
  },

  changePassword: async (_currentPassword: string, _newPassword: string) => {
    // TODO: call password change API with crypto re-encryption
  },

  clearError: () => set({ error: null }),

  restoreSession: async () => {
    // TODO: load tokens from secure storage, call /me
    set({ isLoading: false, isInitialized: true });
  },
}));
