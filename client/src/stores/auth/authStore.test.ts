import { beforeEach, describe, expect, it, vi } from "vitest";

const { setRefreshToken, getRefreshToken } = vi.hoisted(() => ({
  setRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(() => null),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
  })),
}));

vi.mock("../../lib/api/auth", () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    prelogin: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  },
  loadApiUrl: vi.fn(async () => {}),
  setRefreshTokenGetter: vi.fn(),
  setRefreshTokenSetter: vi.fn(),
  AuthApiError: class AuthApiError extends Error {
    constructor(
      public status: number,
      public apiError: { code: string; message: string; email?: string },
    ) {
      super(apiError.message);
    }
  },
}));

vi.mock("../../lib/crypto/crypto", () => ({
  generateAccountMaterial: vi.fn(async () => ({
    recovery_code: "rc",
    public_key: "pk",
    salt_cl: "sc",
  })),
  deriveKek: vi.fn(async () => {}),
  buildKeyringRows: vi.fn(async () => ({
    dek_wrapped_by_kek: "kek",
    dek_wrapped_by_recovery: "rec",
    private_key_wrapped_by_dek: "pk",
  })),
  computeLoginProof: vi.fn(async () => ({
    proof: "proof",
    verifier: "verifier",
  })),
  unwrapDek: vi.fn(async () => {}),
  lockSession: vi.fn(async () => {}),
  clearKeychain: vi.fn(async () => {}),
  setRefreshToken,
  getRefreshToken,
  saveRefreshToken: vi.fn(async () => {}),
  loadRefreshToken: vi.fn(async () => null),
  signChallenge: vi.fn(async () => "sig"),
}));

vi.mock("../../lib/db/db", () => ({
  wipeLocalData: vi.fn(async () => {}),
}));

vi.mock("../../lib/keychain/keychain", () => ({
  deletePassword: vi.fn(async () => {}),
  loadPassword: vi.fn(async () => null),
  savePassword: vi.fn(async () => {}),
}));

vi.mock("../../lib/common/device", () => ({
  getDeviceId: vi.fn(async () => "dev-1"),
}));

import { AuthApiError, authApi } from "../../lib/api/auth";
import { useAuthStore } from "./authStore";

const preloginResponse = {
  nonce: "n",
  kdf: { m: 32768, t: 2, p: 1 },
  server_salt: "ss",
  salt_cl: "sc",
};

const user = {
  id: "u1",
  email: "new@example.com",
  initialized: true,
  auth_provider: "password",
  created_at: "2026-01-01",
};

describe("authStore email verification", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isUnlocked: false,
      pendingVerificationEmail: null,
      error: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it("register with verification_required sets pending email and no tokens", async () => {
    vi.mocked(authApi.prelogin).mockResolvedValue(preloginResponse);
    vi.mocked(authApi.register).mockResolvedValue({
      user,
      verification_required: true,
    });

    await useAuthStore.getState().register("new@example.com", "New User", "pw");

    const s = useAuthStore.getState();
    expect(s.pendingVerificationEmail).toBe("new@example.com");
    expect(s.isAuthenticated).toBe(false);
    expect(s.tokens).toBeNull();
  });

  it("login with VERIFICATION_REQUIRED sets pending email", async () => {
    vi.mocked(authApi.prelogin).mockResolvedValue(preloginResponse);
    vi.mocked(authApi.login).mockRejectedValue(
      new AuthApiError(403, {
        code: "VERIFICATION_REQUIRED",
        message: "verify your email",
        email: "gate@example.com",
      }),
    );

    await useAuthStore.getState().login("gate@example.com", "pw");

    const s = useAuthStore.getState();
    expect(s.pendingVerificationEmail).toBe("gate@example.com");
    expect(s.isAuthenticated).toBe(false);
  });

  it("login success clears any pending verification email", async () => {
    useAuthStore.setState({ pendingVerificationEmail: "gate@example.com" });
    vi.mocked(authApi.prelogin).mockResolvedValue(preloginResponse);
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      user,
      keyring: {
        dek_wrapped_by_kek: "kek",
        dek_wrapped_by_recovery: "rec",
        private_key_wrapped_by_dek: "pk",
      },
    });

    await useAuthStore.getState().login("gate@example.com", "pw");

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.isUnlocked).toBe(true);
    expect(s.pendingVerificationEmail).toBeNull();
  });

  it("verifyEmail succeeds and authenticates", async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      user,
      keyring: {
        dek_wrapped_by_kek: "kek",
        dek_wrapped_by_recovery: "rec",
        private_key_wrapped_by_dek: "pk",
      },
    });

    await useAuthStore
      .getState()
      .verifyEmail("new@example.com", "123456", "pw");

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.isUnlocked).toBe(true);
    expect(s.pendingVerificationEmail).toBeNull();
    expect(s.tokens).toEqual({
      access_token: "at",
      refresh_token: "rt",
    });
  });

  it("verifyEmail failure sets error and rethrows", async () => {
    vi.mocked(authApi.verifyEmail).mockRejectedValue(
      new AuthApiError(400, {
        code: "INVALID_OTP",
        message: "bad otp",
      }),
    );

    await expect(
      useAuthStore.getState().verifyEmail("new@example.com", "000000", "pw"),
    ).rejects.toThrow("bad otp");

    const s = useAuthStore.getState();
    expect(s.error).toBe("bad otp");
    expect(s.isLoading).toBe(false);
    expect(s.pendingVerificationEmail).toBeNull();
  });

  it("resendVerification calls the API and keeps the pending email", async () => {
    useAuthStore.setState({ pendingVerificationEmail: "new@example.com" });
    vi.mocked(authApi.resendVerification).mockResolvedValue({
      verification_required: true,
    });

    await useAuthStore.getState().resendVerification("new@example.com");

    expect(authApi.resendVerification).toHaveBeenCalledWith("new@example.com");
    const s = useAuthStore.getState();
    expect(s.pendingVerificationEmail).toBe("new@example.com");
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
  });

  it("resendVerification failure sets error and rethrows", async () => {
    useAuthStore.setState({ pendingVerificationEmail: "new@example.com" });
    vi.mocked(authApi.resendVerification).mockRejectedValue(
      new AuthApiError(429, {
        code: "RATE_LIMITED",
        message: "too many requests",
      }),
    );

    await expect(
      useAuthStore.getState().resendVerification("new@example.com"),
    ).rejects.toThrow("too many requests");

    const s = useAuthStore.getState();
    expect(s.error).toBe("too many requests");
    expect(s.isLoading).toBe(false);
    expect(s.pendingVerificationEmail).toBe("new@example.com");
  });

  it("clearPendingVerification resets the pending email", () => {
    useAuthStore.setState({ pendingVerificationEmail: "new@example.com" });

    useAuthStore.getState().clearPendingVerification();

    expect(useAuthStore.getState().pendingVerificationEmail).toBeNull();
  });
});
