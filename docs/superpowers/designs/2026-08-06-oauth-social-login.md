# OAuth Social Login (Google + GitHub) — Design

Date: 2026-08-06
Status: Proposed
Related spec: `docs/superpowers/specs/2026-08-04-auth-encryption-core-design.md` (§4.4 Social login)

## Goals

- Let users sign up / log in with Google or GitHub via the desktop app.
- New social users complete a one-time "setup" step (encryption password + recovery kit) equivalent to registration.
- Existing social users (already initialized) log straight in.
- Same OAuth apps must work for a future React Native client (one client ID/secret, multiple redirect URIs).
- No changes to OAuth provider console config required for this iteration.
- Auto-unlock on app restart (Termius parity): no password prompt every launch.
- Periodic re-verification: the remembered password is removed from the OS keychain by renewal rules (14-day inactivity, 90-day hard cap), forcing the shared unlock flow to re-prompt. Same rules for password and social users; refresh tokens keep the user logged in throughout (unlock ≠ login).

## Non-goals

- OAuth on mobile (design must not block it, but no mobile code).
- Web browser login page (server keeps 302 support for the future; client uses a JSON variant).
- Replacing `/oauth/exchange` (kept as-is for compat; the new flow never calls it).

## Current state (verified)

Server (all exist, mostly working):
- `GET /api/v1/auth/oauth/start/:provider` — generates PKCE verifier + state, stores `OAuthState`, 302-redirects to provider. Provider callback URL is `OAuthRedirectBase + /api/v1/auth/oauth/callback/:provider` (i.e. the **server**, not the app).
- `GET /api/v1/auth/oauth/callback/:provider` — validates state, exchanges code, fetches user info, links by `(auth_provider, provider_sub)` or by email, creates uninitialized user + personal vault, then:
  - uninitialized → 302 to `termvault://auth/setup?setup_code&user_id` (15-min AuthCode)
  - initialized → 302 to `termvault://auth/success?access_token&refresh_token&user_id`
- `POST /oauth/exchange` — setup code → tokens (marks code used; **we won't call it**).
- `POST /oauth/setup` — **OUTDATED**: accepts `setup_token, encrypted_dek, encrypted_privkey, auth_verifier`; stores old `dek`/`privkey` keyring rows. Must be rewritten to the current keyring model.

Client (all stubs):
- `OAuthLogin.tsx` — buttons show "not yet available".
- `LoginPage` / `RegisterPage` — `handleOAuthSuccess` console.logs.
- `SetupPage.tsx` — stub with mock recovery code.
- `lib/api/auth.ts` — has `oauthExchange` / `oauthSetup` (generic params), no `oauthStart`.
- No deep-link handling; no listener.
- Rust: `tauri_plugin_opener` (external URLs), tokio, all crypto commands (`generate_account_material`, `derive_kek`, `build_keyring_rows`, `compute_login_proof`) available.

Key finding: prelogin for an uninitialized OAuth user returns an **empty `server_salt`** (`AuthSalt` is NULL) — unusable. OAuth setup must use **client-generated `server_salt` + nonce** (same pattern as password-change/recovery).

## Decisions

### D1 — Loopback HTTP callback listener (not OS deep links)

- Rust binds `127.0.0.1:<port>` via tokio only while OAuth is in flight; receives the server's redirect; serves a tiny "You can close this tab" HTML page; returns the full callback URL to the frontend; closes immediately. 120s timeout.
- Port strategy: try 1421 → 1422 → 1423 (deterministic; covered by allowlist). Google itself allows any loopback port; GitHub requires exact URI registration, so the allowlist controls what's tried.
- Why not `tauri-plugin-deep-link`: cross-platform scheme registration (registry / Info.plist / .desktop), flaky in dev on Windows (scheme binds to packaged app, not dev binary), global OS state, and it doesn't remove the server work anyway.
- Future mobile: register the RN deep-link URI in the same provider apps + add it to the server allowlist. Zero server code change.

### D2 — Allowlist-validated `app_callback` on `/oauth/start`

- `GET /oauth/start/:provider?device_id=X&app_callback=<uri>&format=json`:
  - `app_callback` must exactly match an entry in new env `TERMVAULT_OAUTH_REDIRECT_URIS` (default `http://127.0.0.1:1421/oauth/callback,http://127.0.0.1:1422/oauth/callback,http://127.0.0.1:1423/oauth/callback`); mismatch → 400 `INVALID_CALLBACK`.
  - Stored on `OAuthState` (new column `RedirectURI`); every post-callback redirect uses it (adds `dest=setup|success|error` query param).
  - `format=json` → respond `{"auth_url": "..."}` instead of 302 (302 kept when absent, for future web).
  - Errors before state lookup (missing code/state) fall back to `AppScheme` as today.
- Prevents open-redirect once `app_callback` becomes dynamic. Env doc added to AGENTS.md.

### D3 — Client-generated `server_salt` + `nonce` for setup

Mirror of register, minus prelogin: client generates `server_salt` (32-byte hex) and `nonce` (32-byte hex), computes `compute_login_proof(serverSalt, nonce)`, sends verifier + salt + KDF in `/oauth/setup`. Server stores them exactly like `HandleRegister` does.

### D4 — GitHub hidden-email fallback

`fetchGitHubUserInfo` → if `email` is null, call `GET /user/emails`, pick primary (verified preferred). Prevents unique-index collision. (Refactor to accept a base URL for testability; default `https://api.github.com`.)

### D5 — Unlock model: keys are per-session, never restored

Crypto keys (KEK/DEK) live **only in the Rust session** (`CryptoState`, in-memory). Every app restart wipes them. OAuth grants tokens, never keys. **Authenticated** (refresh-token restore) and **unlocked** (keys present) are orthogonal — a user stays logged in while locked. The unlock/decrypt password box is **one shared component** across all entry points (D7).

Pre-existing gaps now scoped in: `restoreSession` blindly sets `isUnlocked: true` (fake-unlocked → every decrypt fails at runtime), and `authStore.unlock` is a stub that ignores the password.

### D6 — Auto-unlock via OS keychain (Termius parity)

- Store the **raw password** in the OS keychain (`tauri-plugin-keyring-store`, already registered in lib.rs:848). The password is the only account-level secret, which is why Termius stores the password rather than a per-device key; any device-local derived key can't reproduce auto-unlock across devices.
- Keychain entry carries timestamps: `set_at` and `last_used_at` (updated after every successful unlock; `last_used_at` tracks real app usage).
- Renewal rules, checked **at app launch**; a hit = delete entry → shared unlock flow → success re-stores with fresh timestamps:
  - `now − last_used_at > N` days (inactivity grace) — default **14**
  - `now − set_at > M` days (absolute cap, safety net) — default **90**
- **Logout always purges** the keychain entry — the invariant that makes "after logout+login, password is always required, same device or not" hold (point 2).
- **changePassword success** → replace the cached entry with the new password + reset timestamps (no stale secret).
- **Self-heal**: a failed auto-unlock attempt (e.g., stale/rotated secret) → purge entry → unlock flow → next success re-stores. No phantom stale state.
- **Escape hatch**: Settings toggle "Always ask for my password" → never write the keychain, and turning it ON also purges any saved entry (toggle-off first-launch therefore prompts until one manual unlock).

Start-up sequence:
1. Restore refresh token (auth). Keys already in session (fresh after setup/login) → unlocked.
2. Else read keychain: present + fresh (and toggle off) → fetch keyring + salt_cl → derive KEK → unwrap DEK → unlocked silently.
3. Absent / expired / failed / toggle-on → unlock screen (D7): password (or recovery-code link) → keys → re-store with new timestamps.

Accepted bound (documented trade-off): a compromised local OS account can read the password from the keychain. The renewal rules bound the idle window; the toggle removes the exposure entirely. Exfil of the keychain secret compromises the account — parity cost of auto-unlock.

### D7 — One shared unlock/decrypt component

A single `UnlockDialog` (password field + "Use recovery code" link) rendered for every `isAuthenticated && !isUnlocked` state: post-setup stale keychain (D6), logout→login (D6 purge), social `dest=success` on any device, restart after expiry, and manual "Lock" action. Same component, one routing rule, zero duplication.

## API contract

`POST /api/v1/auth/oauth/setup` (rewritten):

```json
{
  "setup_token": "…",
  "auth_verifier": "…",
  "recovery_code": "…",
  "public_key": "…",
  "keyring": { "dek_wrapped_by_kek": "…", "dek_wrapped_by_recovery": "…", "private_key_wrapped_by_dek": "…" },
  "kdf": { "m": 65536, "t": 3, "p": 2 },
  "server_salt": "…",
  "salt_cl": "…"
}
```

Response (unchanged shape): `{ "access_token", "refresh_token", "user" }`.

Server logic (mirrors `HandleRegister` storage):
1. Look up AuthCode by `hashToken(setup_token)` + purpose `oauth_setup`; reject used/expired/mismatched.
2. Reject if `user.Initialized` (409).
3. Mark code used; `user.AuthVerifier = verifier`, `AuthSalt = server_salt`, `SaltCL`, `KDFM/T/P`, `PublicKey`, `RecoveryHash = sha256(recovery_code)` (validate base64 like register), `Initialized = true`.
4. Seed the 3 keyring rows (`dek_wrapped_by_kek`, `dek_wrapped_by_recovery`, `private_key_wrapped_by_dek`) — same as register.
5. Return token pair + user.

## Flow (client)

1. Click "Continue with Google/GitHub" in `OAuthLogin`.
2. Rust: `bind_oauth_listener()` → tries 1421→1422→1423, returns bound port (all busy → clear error).
3. `authApi.oauthStart(provider, { device_id, app_callback: "http://127.0.0.1:<port>/oauth/callback", format: "json" })` → `{ auth_url }`.
4. `openUrl(auth_url)` (opener plugin, `opener:allow-open-url` capability) → system browser.
5. Rust: `await_oauth_callback(port)` → resolves with full callback URL (e.g. `http://127.0.0.1:1421/oauth/callback?dest=setup&setup_code=X&user_id=Y`) or times out (120s → "OAuth timed out, try again").
6. Parse `dest`:
   - `setup` → store `{ setup_code, user_id }` in `authStore.oauthSetup` → navigate `/setup`.
   - `success` → persist tokens, `isAuthenticated: true` → D6 sequence (keychain entry present & fresh → silent unlock → home; otherwise unlock screen).
   - `error` → show message on the auth page, stay put.

Unlock screen (D5/D6/D7) shows whenever `isAuthenticated && !isUnlocked` after the D6 attempt: password (+ recovery-code link) → `unlock()` fetches keyring + salt_cl → derives KEK → unwraps DEK → re-stores keychain entry → home. Covers: social login on any device, restart after keychain expiry, logout→login on any device.

`SetupPage` (real implementation):
1. No `oauthSetup` in store → info state + back link.
2. Password + confirm form (no name field — name comes from provider).
3. Submit: `generateAccountMaterial()` → `deriveKek(password, salt_cl)` → `buildKeyringRows(recovery_code)` → client `server_salt`/`nonce` → `compute_login_proof` → `authApi.oauthSetup(...)` → set auth state (user, tokens, unlocked) → **store password in OS keychain** (D6, fresh timestamps) → `pendingRecoveryCode`/`pendingRecoveryContext: "signup"` → `RecoveryRevealModal` shows (same as register; kit filename uses `user.email` from the response).
4. Errors surfaced in form; expired setup token → "link expired" + navigate to login.

Note (parity with register): generating account material overwrites the session's keys — same behavior as the register page today.

## File changes

Server:
- `internal/config/config.go` — `OAuthRedirectURIs []string` from `TERMVAULT_OAUTH_REDIRECT_URIS`.
- `internal/models/oauth_state.go` — add `RedirectURI string`.
- `internal/auth/oauth.go` — allowlist helper; `app_callback` + `format=json` in start; store redirect; `dest=` query on all callback redirects; GitHub `/user/emails` fallback; rewrite `HandleOAuthSetup`.
- `internal/auth/handlers.go` — new `HandleKeyring` (`GET /auth/keyring`, token-authed, returns `{ keyring, salt_cl }`); `main.go` route registration.
- `internal/auth/oauth_test.go` + `handlers_test.go` — extend: allowlist rejection, JSON start, full setup flow (keyring rows + recovery hash + salts persisted), setup errors, GitHub email fallback (httptest), keyring endpoint (auth required, correct payload).

Client:
- `src-tauri/src/lib.rs` (+ `src-tauri/src/oauth.rs`) — `bind_oauth_listener`, `await_oauth_callback` commands (tokio TcpListener, loopback-only, 120s timeout, HTML response), registered in `invoke_handler`.
- `src-tauri/src/lib.rs` (+ `src-tauri/src/keychain.rs`) — `store_password`, `load_password`, `clear_password`, `password_meta` commands via `tauri-plugin-keyring-store` (raw password + `set_at`/`last_used_at` JSON).
- `src-tauri/capabilities/default.json` — `opener:allow-open-url` (+ keyring-store perms if plugin requires).
- `src/lib/keychain/` — pure helpers: `shouldEvict(setAt, lastUsedAt, now, inactiveDays, maxAgeDays)`, `normalize` (testable); renewal constants `KEYCHAIN_INACTIVE_DAYS=14`, `KEYCHAIN_MAX_AGE_DAYS=90` (debug overrides via localStorage, `0` = always prompt).
- `src/lib/api/auth.ts` — `oauthStart`, `oauthSetup`, `fetchKeyring` typed to new contract.
- `src/lib/oauth/parseCallbackUrl.ts` — pure parser (testable).
- `src/components/auth/forms/OAuthLogin.tsx` — real flow.
- `src/pages/auth/LoginPage.tsx` + `RegisterPage.tsx` — real `handleOAuthSuccess` (route via callback parse).
- `src/pages/auth/SetupPage.tsx` — full implementation.
- `src/components/auth/UnlockDialog.tsx` (+ route) — the single shared unlock/decrypt component (D7).
- `src/stores/auth/authStore.ts` — `oauthSetup` state; real `unlock()` (fetch keyring → derive KEK → unwrap DEK); `restoreSession` runs D6 (auto-unlock attempt → unlock screen); `logout` purges keychain; `changePassword` refreshes keychain entry; settings flag "always ask".
- `src/stores/settings/settingsStore.ts` (or existing) — `unlockAlwaysAsk` toggle.

Docs: AGENTS.md env table (`TERMVAULT_OAUTH_REDIRECT_URIS`, `TERMVAULT_KEYCHAIN_INACTIVE_DAYS`, `TERMVAULT_KEYCHAIN_MAX_AGE_DAYS`).

## Tests

- Server: `go vet ./...` + `go test ./...` (oauth flow, allowlist, setup rewrite, email fallback, keyring endpoint).
- Client: `pnpm vitest` — `parseCallbackUrl` unit tests; `shouldEvict` renewal-rule tests (inactivity hit, cap hit, both miss, boundary days); SetupPage flow (mocked APIs/crypto + keychain store); OAuthLogin handler; unlock flow (mock fetchKeyring + crypto, heal on stale); logout purge; changePassword refresh; `pnpm biome check .`; `tsc`.
- Rust: `cargo test` (listener parses request line; port fallback logic).
- Manual: real GitHub + Google login end-to-end; **restart app → auto-unlock, no prompt**; "Always ask for password" (settings toggle) → unlock box on every launch; social login on second device → unlock box; logout → login → unlock box (same device); close-tab timeout; wrong-port cleanup.

## Verification

All four suites green (go test, vitest, tsc, biome, cargo test) before commit. Manual smoke: GitHub (has hidden-email account if available) and Google flows, recovery kit download, logout → login (existing user: social → unlock box → home), auto-unlock restart, force-reauth restart.

## Behavior change note

`restoreSession` previously auto-set `isUnlocked: true`; it now runs the D6 sequence: silent auto-unlock when a fresh keychain entry exists (Termius-like), otherwise the shared unlock box. No more fake-unlocked state (which caused runtime decrypt failures). Applies to password and social users alike.
