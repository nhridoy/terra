import { create } from "zustand";
import {
  authApi,
  setRefreshTokenGetter,
  setRefreshTokenSetter,
  type TokenPair,
  type User,
} from "../../lib/api/auth";
import {
  clearKeychain,
  computeLoginProof,
  deriveKek,
  generateAccountMaterial,
  getRefreshToken,
  loadRefreshToken,
  lockSession,
  saveRefreshToken,
  setRefreshToken,
  unwrapDek,
  wrapDek,
} from "../../lib/crypto/crypto";

// Wire up refresh token getter/setter for apiFetch auto-refresh
setRefreshTokenGetter(getRefreshToken);
setRefreshTokenSetter(setRefreshToken);

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
  updateProfile: (data: {
    full_name?: string;
    email?: string;
  }) => Promise<void>;
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

async function persistTokens(tokens: TokenPair | null): Promise<void> {
  // Set in-memory first so apiFetch auto-refresh has it immediately
  setRefreshToken(tokens?.refresh_token ?? null);
  try {
    if (tokens?.refresh_token) {
      await saveRefreshToken(tokens.refresh_token);
    } else {
      await clearKeychain();
    }
  } catch {
    // ignore keychain errors
  }
}

let _restoreSessionLock: Promise<void> | null = null;

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

  register: async (email: string, name: string, password: string) => {
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
        user_id: crypto.randomUUID(),
        email,
        full_name: name,
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
      await persistTokens({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
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
        await unwrapDek(res.keyring.dek_wrapped_by_kek);
      }

      const newTokens = {
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      };
      set({
        user: res.user,
        tokens: newTokens,
        isAuthenticated: true,
        isUnlocked: true,
        isLoading: false,
      });
      await persistTokens(newTokens);
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
      const refreshedTokens = {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
      };
      set({ tokens: refreshedTokens });
      await persistTokens(refreshedTokens);
    } catch {
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isUnlocked: false,
      });
      await persistTokens(null);
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
    await persistTokens(null);
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

  changePassword: async (currentPassword: string, newPassword: string) => {
    const { user, tokens } = get();
    if (!user || !tokens) throw new Error("Not authenticated");

    // 1. Get fresh prelogin data
    const prelogin = await authApi.prelogin(user.email);

    // 2. Derive KEK from current password, compute old proof
    await deriveKek(currentPassword, prelogin.salt_cl);
    const oldProof = await computeLoginProof(
      prelogin.server_salt,
      prelogin.nonce,
    );

    // 3. Generate new KDF params + new salts
    const newKdf = {
      m: 67108864,
      t: 3,
      p: 1,
    };
    const rand16 = new Uint8Array(16);
    crypto.getRandomValues(rand16);
    const newSaltCl = btoa(String.fromCharCode(...rand16)).replace(/=+$/, "");
    crypto.getRandomValues(rand16);
    const newServerSalt = btoa(String.fromCharCode(...rand16)).replace(
      /=+$/,
      "",
    );

    // 4. Derive new KEK from new password, compute new verifier
    await deriveKek(newPassword, newSaltCl);
    const newVerifier = await computeLoginProof(newServerSalt, prelogin.nonce);

    // 5. Re-wrap DEK with new KEK
    const newEncryptedDek = await wrapDek();

    // 6. Send to server
    await authApi.passwordChange(
      {
        old_proof: oldProof.proof,
        old_nonce: prelogin.nonce,
        new_verifier: newVerifier.verifier,
        new_encrypted_dek: newEncryptedDek,
        new_nonce: prelogin.nonce,
        new_kdf: newKdf,
        new_server_salt: newServerSalt,
        new_salt_cl: newSaltCl,
      },
      tokens.access_token,
    );
  },

  clearError: () => set({ error: null }),

  restoreSession: async () => {
    // Deduplicate concurrent calls (e.g., React.StrictMode double-mount)
    if (_restoreSessionLock) return _restoreSessionLock;

    _restoreSessionLock = (async () => {
      try {
        const refreshToken = await loadRefreshToken();

        if (refreshToken) {
          try {
            const newTokens = await authApi.refresh(refreshToken);
            const tokens = {
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token,
            };
            set({ tokens });
            await persistTokens(tokens);

            const user = await authApi.me(newTokens.access_token);
            set({ user, isAuthenticated: true, isUnlocked: true });
          } catch {
            set({
              user: null,
              tokens: null,
              isAuthenticated: false,
              isUnlocked: false,
            });
            await persistTokens(null);
          }
        }
      } catch {
        // ignore
      } finally {
        _restoreSessionLock = null;
        set({ isLoading: false, isInitialized: true });
      }
    })();

    return _restoreSessionLock;
  },
}));
