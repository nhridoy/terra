import { load } from "@tauri-apps/plugin-store";

const AUTH_SETTINGS_FILE = "auth.json";
const API_URL_KEY = "apiUrl";
const DEFAULT_API_URL = "http://localhost:8080";

// API URL lives in the tauri store (auth.json) so Rust/other processes could
// read it too; a memory cache keeps per-request reads synchronous.
let cachedApiUrl: string | null = null;

export async function loadApiUrl(): Promise<void> {
  try {
    const store = await load(AUTH_SETTINGS_FILE, { autoSave: false });
    const saved = await store.get<string>(API_URL_KEY);
    cachedApiUrl = saved && saved.trim() !== "" ? saved : null;
  } catch {
    cachedApiUrl = null;
  }
}

export function getApiUrl(): string {
  if (cachedApiUrl !== null) return cachedApiUrl;
  const env = import.meta.env.VITE_API_URL;
  return typeof env === "string" && env.trim() !== "" ? env : DEFAULT_API_URL;
}

export async function setApiUrl(url: string): Promise<void> {
  cachedApiUrl = url;
  try {
    const store = await load(AUTH_SETTINGS_FILE, { autoSave: false });
    await store.set(API_URL_KEY, url);
    await store.save();
  } catch {
    // best-effort: the in-memory value still applies for this session
  }
}

let getRefreshTokenFn: (() => string | null) | null = null;
let setRefreshTokenFn: ((token: string | null) => void) | null = null;

export function setRefreshTokenGetter(fn: () => string | null): void {
  getRefreshTokenFn = fn;
}

export function setRefreshTokenSetter(
  fn: (token: string | null) => void,
): void {
  setRefreshTokenFn = fn;
}

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  email?: string;
}

export class AuthApiError extends Error {
  constructor(
    public status: number,
    public apiError: ApiError,
  ) {
    super(apiError.message);
    this.name = "AuthApiError";
  }
}

async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If 401 and we have a token, try refreshing and retrying once
  if (res.status === 401 && token) {
    try {
      const storedRefresh = getRefreshTokenFn?.() ?? null;
      if (storedRefresh) {
        const refreshRes = await fetch(`${getApiUrl()}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: storedRefresh }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccessToken = refreshData.data?.access_token;
          const newRefreshToken = refreshData.data?.refresh_token;

          if (newAccessToken) {
            if (newRefreshToken) {
              setRefreshTokenFn?.(newRefreshToken);
            }

            // Retry original request with new token
            headers.Authorization = `Bearer ${newAccessToken}`;
            res = await fetch(url, {
              method,
              headers,
              body: body ? JSON.stringify(body) : undefined,
            });
          }
        }
      }
    } catch {
      // Refresh failed, fall through to error handling below
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();

  if (!res.ok) {
    const error = json?.error || { code: "UNKNOWN", message: "Request failed" };
    throw new AuthApiError(res.status, error);
  }

  return json?.data ?? json;
}

export interface PreloginResponse {
  nonce: string;
  kdf: { m: number; t: number; p: number };
  server_salt: string;
  salt_cl: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  initialized: boolean;
  auth_provider: string;
  created_at: string;
}

export interface LoginResponse extends TokenPair {
  user: User;
  keyring?: {
    dek_wrapped_by_kek: string;
    dek_wrapped_by_recovery: string;
    private_key_wrapped_by_dek: string;
  };
}

export interface KeyringRows {
  dek_wrapped_by_kek: string;
  dek_wrapped_by_recovery: string;
  private_key_wrapped_by_dek: string;
}

export interface RegisterRequest {
  user_id: string;
  email: string;
  full_name?: string;
  password_hash: string;
  recovery_code?: string;
  public_key?: string;
  keyring?: KeyringRows;
  nonce: string;
  kdf: { m: number; t: number; p: number };
  server_salt: string;
  salt_cl: string;
}

export interface RegisterResponse extends Partial<TokenPair> {
  user: User;
  verification_required?: boolean;
}

export interface VerifyEmailResponse extends TokenPair {
  user: User;
  keyring?: KeyringRows;
}

export interface RecoveryPrefetchResponse {
  nonce: string;
  email: string;
  kdf: { m: number; t: number; p: number };
  server_salt: string;
  salt_cl: string;
  dek_wrapped_by_recovery: string;
}

export const authApi = {
  async prelogin(email: string): Promise<PreloginResponse> {
    return apiFetch("POST", "/api/v1/auth/prelogin", { email });
  },

  async register(req: RegisterRequest): Promise<RegisterResponse> {
    return apiFetch("POST", "/api/v1/auth/register", req);
  },

  async verifyEmail(params: {
    email: string;
    otp: string;
    device_id: string;
  }): Promise<VerifyEmailResponse> {
    return apiFetch("POST", "/api/v1/auth/verify-email", params);
  },

  async resendVerification(email: string): Promise<{
    verification_required: boolean;
  }> {
    return apiFetch("POST", "/api/v1/auth/resend-verification", { email });
  },

  async login(params: {
    email: string;
    proof: string;
    nonce: string;
    device_id: string;
    client_pubkey: string;
  }): Promise<LoginResponse> {
    return apiFetch("POST", "/api/v1/auth/login", params);
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    return apiFetch("POST", "/api/v1/auth/refresh", {
      refresh_token: refreshToken,
    });
  },

  async logout(refreshToken: string): Promise<void> {
    return apiFetch("POST", "/api/v1/auth/logout", {
      refresh_token: refreshToken,
    });
  },

  async me(token: string): Promise<User> {
    return apiFetch("GET", "/api/v1/me", undefined, token);
  },

  async passwordChange(
    params: {
      old_proof: string;
      old_nonce: string;
      new_verifier: string;
      new_encrypted_dek: string;
      new_nonce: string;
      new_kdf: { m: number; t: number; p: number };
      new_server_salt: string;
      new_salt_cl: string;
    },
    token: string,
  ): Promise<void> {
    return apiFetch("POST", "/api/v1/auth/password-change", params, token);
  },

  async recoveryPrefetch(
    recoveryCode: string,
  ): Promise<RecoveryPrefetchResponse> {
    return apiFetch("POST", "/api/v1/auth/recovery/prefetch", {
      recovery_code: recoveryCode,
    });
  },

  async recovery(params: {
    recovery_code: string;
    signature: string;
    new_recovery_code: string;
    new_verifier: string;
    new_encrypted_dek: string;
    new_dek_wrapped_by_recovery: string;
    new_nonce: string;
    new_kdf: { m: number; t: number; p: number };
    new_server_salt: string;
    new_salt_cl: string;
  }): Promise<void> {
    return apiFetch("POST", "/api/v1/auth/recovery", params);
  },

  async oauthExchange(params: {
    setup_code: string;
    user_id: string;
  }): Promise<TokenPair & { user: User; initialized: boolean }> {
    return apiFetch("POST", "/api/v1/auth/oauth/exchange", params);
  },

  async oauthStart(params: {
    provider: string;
    device_id: string;
    app_callback: string;
  }): Promise<{ auth_url: string }> {
    const qs = new URLSearchParams({
      device_id: params.device_id,
      app_callback: params.app_callback,
      format: "json",
    });
    return apiFetch(
      "GET",
      `/api/v1/auth/oauth/start/${params.provider}?${qs.toString()}`,
    );
  },

  async oauthSetup(params: {
    setup_token: string;
    auth_verifier: string;
    recovery_code: string;
    public_key: string;
    keyring: KeyringRows;
    server_salt: string;
    salt_cl: string;
    kdf: { m: number; t: number; p: number };
  }): Promise<TokenPair & { user: User }> {
    return apiFetch("POST", "/api/v1/auth/oauth/setup", params);
  },

  async fetchKeyring(token: string): Promise<{
    keyring: KeyringRows;
    salt_cl: string;
  }> {
    return apiFetch("GET", "/api/v1/auth/keyring", undefined, token);
  },

  async attachRecoveryMaterial(
    params: {
      recovery_code: string;
      dek_wrapped_by_recovery: string;
    },
    token: string,
  ): Promise<{ recovery_attached: boolean }> {
    return apiFetch("POST", "/api/v1/auth/recovery-material", params, token);
  },
};
