# TermVault Verification & Security Audit — 2026-08-08

## Scope
- 8 auth happy paths (email/social × signup/signin × gated/ungated)
- Unhappy paths for all flows
- Recovery (forgot/change password), keychain lifecycle (alwaysAsk, 14d/90d)
- Logout / token expiry / force-logout data clearing
- Encryption correctness
- Client + server security review

## Baseline
- go test ./... — PASS (auth, config, email, models)
- vitest: 55/55 (3 new tests added: logout teardown, refresh-failure teardown, alwaysAsk purge)
- cargo test: 26/26
- tsc --noEmit: PASS, biome: clean

## Verified OK (no action)

**Happy paths** — all traced end-to-end (register `authStore.ts:190`, oauth `:707`/`:821`):
1. Social signup → set-password step (`/setup`, `oauth/setup`) → full kit shown → app. Kit complete in setup call.
2. Social signin → tokens + keyring in response, auto-unlock or lock dialog. ✓
3. Email signup (ungated) → register → `ensureRecoveryKit` → app. ✓
4. Email login (ungated) → tokens + keyring, kit self-heals if missing. ✓
5–8. Gated variants: register returns VERIFICATION_REQUIRED → OTP step → verify → kit → app; server login forces 403 VERIFICATION_REQUIRED; social signup never gated (OAuth sets EmailVerifiedAt on both create+link paths).

**Unhappy paths** — covered: wrong/expired/exhausted OTP, wrong login proof, unknown email uniform, special flagged email, token refresh reuse → revoke all, invalid/expired tokens, weak KDF rejection (new), recovery invalid code/signature, register conflicts, idempotent UUID (see finding F1), rate limit on OTP endpoints. Client surfaces errors inline; `ensureRecoveryKit` swallows attach failures gracefully.

**Recovery flows** — forgot password works for ALL user types *via recovery kit* (`/recovery`, prefetch + HMAC-signature reset, revokes all sessions). Change password: old-proof verified, KDF validated, revokes other devices. OAuth users have verifiers (setup mandatory), so both flows apply.

**Keychain / alwaysAsk** — 14d inactivity / 90d absolute cap enforced in `keychain.ts`, debug overrides, `alwaysAsk` purge (from SecurityTab:131-134 matches constants), renewal on use, unlock re-saves.

**Logout / force expiry** — `teardownSession` fully clears: session→zeroized, saved password + refresh token removed from OS keychain, local SQLite db file + -wal/-shm deleted, store files retained (non-secret profile/theme only). Refresh failure anywhere (startup `restoreSession`) → teardown. Mid-session 401 → apiFetch auto-refresh → retry; if refresh fails → error surfaces (does NOT auto-teardown mid-session — UX gap, see F8).

**Encryption** — cargo tests: Argon2id KDF determinism, ChaCha20Poly1305 roundtrip/wrong-key, recovery wrap/unwrap, zero-salt guard. Correct.

## Findings by severity

### [F1] CRITICAL — Account takeover via idempotent register: `server/internal/auth/handlers.go:130-154`
`/register` with an existing `user_id` UUID returns a VALID token pair + keyring **with no credential proof** — only a UUID parse. The client generates `crypto.randomUUID()` per attempt (`authStore.ts:212`), so it NEVER uses this path; it's a pure attack surface: whoever learns a UUID (leaked via `user_id` in register response/`/me`, OAuth callbacks `oauth.go:418-420,438-440` which embed `user_id`) mints a session. **Fix:** idempotent path must require proof — e.g. return 409 CONFLICT unless the request also matches the existing account's email + verifier; or remove the path entirely (client retry would 409 → treat as retriable).

### [F2] HIGH — No rate limiting on register/login/prelogin/refresh/recovery/OAuth: `main.go:47-67`
`RateLimit` only wraps verify-email/resend/recovery-material. Brute-force of the OTP endpoints is throttled, but register/login are open — allows mass account creation, verifier oracle abuse, and /refresh endpoint storms. `RATE_LIMIT_API` config never applied.

### [F3] HIGH — X-Forwarded-For spoof bypasses ALL rate limiting: `main.go` never calls `r.SetTrustedProxies`; `TRUSTED_PROXIES` env parsed (`config.go:85-93`) but dead
Gin v1.9.1 trusts all proxies by default → `X-Forwarded-For` spoofing resets every limiter key. **Fix:** `r.SetTrustedProxies(cfg.TrustedProxies)` (or `SetTrustedProxies(nil)`).

### [F4] MEDIUM — CORS reflects any origin: `middleware.go:134-154`
Any web origin can call the API. Not cookies/bearer so no token theft, but browser-downloaded scripts, CSRF-style abuse (if the OS/keychain is compromised) are enabled; it's against the principle of least surprise for a local desktop client. **Fix:** restrict to `http://localhost:1420` and the `termvault://` scheme or configurable allowlist.

### [F5] MEDIUM — Login proof replay: `handlers.go:86` nonce generated but never stored/bound; login never checks freshness
Captured (email, nonce, proof) pair is replayable indefinitely until password change. **Fix:** server stores nonce from prelogin, single-use, expires, cleared on change.

### [F6] MEDIUM — User enumeration: `handlers.go:156-158` 409 "email already registered"; `verify-email:849-853` 401 "invalid email"
prelogin/login/resend are uniform; register and /verify-email leak account existence. **Fix:** uniform responses on register conflict.

### [F7] MEDIUM — Password change keyring write is NOT atomic: `handlers.go:510-517`
verifier/salts in one Save, `upsertUserKey` outside any transaction → crash mid-update leaves old pos mismatch (password changed, DEK still wrapped with old key). Contrast: AttachRecoveryMaterial uses a transaction. **Fix:** wrap both in a single tx.

### [F8] LOW/MED — Mid-session revocation doesn't log the client out
If the server revokes refresh tokens (recovery/password change elsewhere), mid-session my apiFetch auto-refresh runs → fails → request errors; app stays "authenticated" with dead tokens until a store `refresh`/`restoreSession` (client `teardownSession` handles it). HandleRefresh failure must trigger `teardownSession` immediately.

### [F9] LOW — `randBytes` ignores crypto/rand errors: `handlers.go:965-969`
On RNG failure returns all-zero secrets (refresh tokens, nonces, states) instead of aborting.

### [F10] LOW — OTP logged in plaintext when SMTP unset: `email/sender.go:29-32`
Dev convenience. If production runs `REQUIRE_EMAIL_VERIFICATION=true` without SMTP, codes are in stdout logs. **Fix:** log-only path is acceptable but document; or refuse to enroll OTP when SMTP missing.

### [F11] LOW — Dead code / cruft
- `GenerateTokenPair` signs a second refresh JWT never returned/verified (`jwt.go:31-40`)
- `refresh_tokens.ReplacedBy` never written (`models/refresh_token.go:18`)
- `RequestID()` middleware never mounted in production → all `request_id` values empty (handlers tests verify; add to `main.go`)

### [F12] INFO — `ForgotPasswordPage.tsx:32` is a **stub** (1s setTimeout, no API call, "Check your email")
Not reachable via login link (`/recovery` is linked instead). Either wire it (needs a password-reset email token flow — a real feature) or remove the stub.

## Other observations
- Client holds no plaintext secrets in localStorage; only sftp widths/sidebar flags. XSS surface clean (no dangerouslySetInnerHTML).
- `device_id` client-controlled; no session listing; unlimited concurrent tokens per user — dupe of F2.
- `crypto.randomUUID` per register attempt → network-failure retry creates a NEW attempt → 409 CONFLICT on second attempt (re-DNA), which F1 makes work only for attacker minting.

## Recommended Fix Order
F1 → F2/F3 (paired) → F4 → F5 → F6 → F7 → F8 → F9-F11 cleanup → F12 decision.