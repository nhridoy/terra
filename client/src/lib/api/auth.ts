const API_URL_KEY = "termvault:api_url";

export function getApiUrl(): string {
  try {
    return localStorage.getItem(API_URL_KEY) || "http://localhost:8080";
  } catch {
    return "http://localhost:8080";
  }
}

export function setApiUrl(url: string): void {
  try {
    localStorage.setItem(API_URL_KEY, url);
  } catch {
    // ignore
  }
}

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
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

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

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
  name?: string;
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

export interface RegisterRequest {
  user_id: string;
  email: string;
  password_hash: string;
  encrypted_dek: string;
  encrypted_privkey: string;
  nonce: string;
  kdf: { m: number; t: number; p: number };
  server_salt: string;
  salt_cl: string;
}

export interface RegisterResponse extends TokenPair {
  user: User;
}

export const authApi = {
  async prelogin(email: string): Promise<PreloginResponse> {
    return apiFetch("POST", "/api/v1/auth/prelogin", { email });
  },

  async register(req: RegisterRequest): Promise<RegisterResponse> {
    return apiFetch("POST", "/api/v1/auth/register", req);
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

  async passwordChange(params: {
    old_proof: string;
    old_nonce: string;
    new_verifier: string;
    new_encrypted_dek: string;
    new_nonce: string;
    new_kdf: { m: number; t: number; p: number };
    new_server_salt: string;
    new_salt_cl: string;
  }): Promise<void> {
    return apiFetch("POST", "/api/v1/auth/password-change", params);
  },

  async recovery(params: {
    recovery_code: string;
    signature: string;
    new_verifier: string;
    new_encrypted_dek: string;
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

  async oauthSetup(params: {
    setup_token: string;
    encrypted_dek: string;
    encrypted_privkey: string;
    auth_verifier: string;
  }): Promise<TokenPair & { user: User }> {
    return apiFetch("POST", "/api/v1/auth/oauth/setup", params);
  },
};
