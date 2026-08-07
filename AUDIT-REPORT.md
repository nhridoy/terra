# Code Quality Audit — 2026-08-07

## Summary
- **Files scanned:** 219 TS/TSX (client/src), 24 Go (server), 6 Rust (client/src-tauri)
- **Issues found:** 35 across 8 dimensions (severity, security, correctness, a11y, structure, TypeScript, state, config)
- **Estimated effort:** high

Notes: the app is early-stage. A large block of the client is scaffolded-but-absent (host/key/vault stores are no-op stubs) and several server hardening items are wired-only-in-tests. This report is meant to steer development; none of the lower items block shipping a local dev build.

---

## Phase 1: Critical (bug risk or blocked development)

### 1. Domain stores are silent no-op stubs — the product's core is unimplemented
- **File:** `client/src/stores/hosts/hostStore.ts:55-76`, `client/src/stores/keys/keyStore.ts:29-41`
- **Problem:** Host, key, vault, group, snippet, session, port-forward, tab-group, workspace and team stores are shells: `create<HostState>((_set) => ({ ... async () => {} }))`. `getCredentialsForHost()` always returns `{ password:"", privateKey:"", passphrase:"" }` and `getCredentialsForKey()` returns `""`.
- **Impact:** `sessionManager.ts:99-116` feeds these into the SSH `connect` IPC call, so every connection attempt sends empty credentials and fails with a misleading error. Create/rename/delete host/key/vault actions do nothing with zero feedback. The encryption helpers (`crypto.ts`) have no production call sites outside `crypto.test.ts`.
- **Suggestion:** Implement the CRUD + encrypted-credential path (fetch hosts → decrypt secrets → store), or `throw new Error("not implemented")` from every stub so calls fail loudly instead of silently. Add an end-to-end encrypt→server→decrypt test before shipping.

### 2. Unauthenticated token issuance via register replay
- **File:** `server/internal/auth/handlers.go:104-122`
- **Problem:** `POST /register` returns a fresh access+refresh token pair for any existing `user_id` with zero proof; email isn't even matched (the branch exists for idempotent retries).
- **Impact:** Replaying a captured register request or knowing a victim's user UUID (leaked in OAuth redirects and login responses) mints valid tokens for the victim's account.
- **Suggestion:** Make register strictly create-only (409 on existing id) and route retries through `/login`, or require the login-style proof on the replay path.

### 3. Login/recovery are unthrottled — rate limiter is dead code
- **File:** `server/cmd/termvault-server/main.go:47-64` (limiter never wired), `server/internal/auth/middleware.go:97-131` (defined, only used in tests)
- **Problem:** `RateLimit`, `cfg.RateLimitAuth`, `cfg.RateLimitAPI` are parsed but no route uses them.
- **Impact:** Unlimited online brute-force of the password verifier (`/login`) and unlimited recovery-code guessing (`/recovery`).
- **Suggestion:** Apply `RateLimit(RateLimitAuth)` to prelogin/login/register/recovery and `RateLimit(RateLimitAPI)` to the protected group in `main.go`.

### 4. Empty/invalid JWT secret silently accepted; algorithm not pinned
- **File:** `server/internal/config/config.go:42`, `server/internal/auth/jwt.go:16-45`
- **Problem:** `JWTSecret` has no default and no startup validation; an empty key is accepted, and token parsing doesn't use `jwt.WithValidMethods`.
- **Impact:** On a misconfigured deploy anyone can forge access tokens (HS256 with empty key) → full auth bypass.
- **Suggestion:** Fail startup when `JWT_SECRET` is missing or `< 32` bytes; add `jwt.WithValidMethods([]string{"HS256"})`.

### 5. TRUSTED_PROXIES parsed but never applied; Gin trusts every proxy
- **File:** `server/internal/config/config.go:67-74` (parsed), `server/cmd/termvault-server/main.go:39`
- **Problem:** `gin.Default()` trusts all proxies; `cfg.TrustedProxies` is never passed to `r.SetTrustedProxies` — `c.ClientIP()` honors attacker-supplied `X-Forwarded-For`.
- **Impact:** When rate limiting (#3) ships it's trivially bypassable by header spoofing; any IP-based logic is spoofable.
- **Suggestion:** `r.SetTrustedProxies(cfg.TrustedProxies)` in `main.go` (empty = trust none).

### 6. Recovery "signature" is never verified and the client's is forgeable
- **File:** `server/internal/auth/handlers.go:538-543` (only checks length > 0), `client/src-tauri/src/crypto.rs:287-301` (`sign_challenge` = HMAC keyed with the **public** key)
- **Problem:** The recovery authenticity control is decorative on both ends; recovery is guarded solely by the client-chosen recovery code stored as a fast SHA-256 hash with no entropy/length validation.
- **Impact:** Weak recovery codes are brute-forceable online ([UNCERTAIN] the code is random 48 chars in practice), and the "signature" adds zero protection.
- **Suggestion:** Verify a real Ed25519 signature over the new keyring payload server-side (or drop the field), and enforce a minimum recovery-code length/entropy.

### 7. OAuth tokens ride in URL query strings; loopback ports are predictable; no state check client-side
- **File:** `server/internal/auth/oauth.go:406-410` (302 with `access_token`/`refresh_token`), `client/src-tauri/src/oauth.rs:78-100`, `client/src/lib/oauth/oauth.ts:16-59`
- **Problem:** Tokens travel in the redirect URI; the app listens on fixed ports 1421-1423 and accepts the **first** connection; `parseCallbackUrl` never validates an OAuth `state` (the server doesn't include one).
- **Impact:** A local process can rebind the port while the listener is down or win the accept race, injecting/capturing tokens; tokens also leak into browser history / window-manager URL logs.
- **Suggestion:** Include the OAuth `state` in the app redirect and verify it before parsing; use dynamic ports registered with the server; consider a one-time `code` exchange via POST body instead of tokens in the URL.

### 8. Tauri updater ships the well-known placeholder public key
- **File:** `client/src-tauri/tauri.conf.json:76`
- **Problem:** The updater `pubkey` is Tauri's public dev key (private key shipped in the docs).
- **Impact:** Anyone who controls `releases.termvault.app` (domain takeover, DNS, malicious self-host mirror) can ship a signed malicious update → remote code execution.
- **Suggestion:** Disable the updater until a real key pair is generated and the production pubkey is set.

### 9. Capabilities grant full-filesystem read/write/delete from the WebView
- **File:** `client/src-tauri/capabilities/default.json:28-48`, `client/src-tauri/tauri.conf.json:42-43` (`assetProtocol` scope `/**`)
- **Problem:** `fs:scope` includes `C:/**`, `D:/**`, `/**` plus `fs:allow-*` mutation permissions, `opener:allow-open-path`, and unrestricted custom commands `write_file` (`lib.rs:47-54`) and `copy_files_with_progress` (`lib.rs:339-471`).
- **Impact:** Any XSS in the WebView, or a malicious repo processed by the git commands, can read/write/delete arbitrary files the user can access.
- **Suggestion:** Scope `fs`/asset protocol to app-data + explicitly user-picked directories only; sanitize/scope custom-command paths with canonicalization under an allowlisted root.

### 10. "Recovery kit" is a plaintext file, contradicting the docs
- **File:** `client/src/lib/recovery/recoveryKit.ts:18-40`
- **Problem:** `buildRecoveryKitContent` writes the raw recovery code unencrypted; AGENTS.md claims a "downloadable encrypted file".
- **Impact:** The recovery code is a bearer credential that unwraps the DEK; anyone with file access gets an account.
- **Suggestion:** Encrypt the kit (password-bound or OS-keychain-bound) or correct the doc/UI claim.

---

## Phase 2: High (maintainability, security, correctness)

### 11. Refresh-token rotation is not atomic (TOCTOU)
- **File:** `server/internal/auth/handlers.go:288-314`
- **Problem:** Reads `RevokedAt`, then `Update`s — two concurrent requests with the same token both pass the nil check and mint new tokens; reuse detection only revokes the family after the race.
- **Impact:** A stolen token used concurrently with the legitimate client keeps a rogue session alive.
- **Suggestion:** `UPDATE ... SET revoked_at=now WHERE token_hash=? AND revoked_at IS NULL`, check `RowsAffected == 1` before issuing a new token.

### 12. Registration has no email verification → account squatting + enumeration
- **File:** `server/internal/auth/handlers.go:124-169`, `handlers.go:59-86`
- **Problem:** Anyone can register any email with attacker-chosen verifier; the prelogin handler reveals whether an email exists.
- **Impact:** A victim's email can be permanently pre-empted (lockout), and the existence oracle aids targeted attacks.
- **Suggestion:** Email-verification code at registration; randomize unknown-user prelogin responses per request.

### 13. Argon2id parameters are weak for a password vault
- **File:** `client/src-tauri/src/crypto.rs:83` (also 151, 185, 249): `Params::new(32*1024, 2, 1, ...)`
- **Problem:** 32 MiB / t=2 is below the ~64 MiB / t≥3 grade expected for a credential vault, and the same params gate the server verifier.
- **Impact:** Offline GPU/FPGA brute-force of weak user passwords becomes feasible.
- **Suggestion:** Raise to ≥64 MiB, t≥3 (p=1); bump the default KDF advertised in prelogin; store params per-user.

### 14. Login proof nonce is advisory — no replay protection
- **File:** `server/internal/auth/handlers.go:240-245`, `verifier.go`
- **Problem:** The server never tracks used nonces; a captured (nonce, proof) pair can be replayed.
- **Impact:** A captured proof replays indefinitely; only TLS prevents capture.
- **Suggestion:** Store issued nonces bound to the user with expiry and reject reuse.

### 15. Multi-step registration/setup writes are not transactional
- **File:** `server/internal/auth/handlers.go:166-197`, `oauth.go:362-370`, `oauth.go:497-591`; `upsertUserKey` is a read-then-write race (`handlers.go:576-590`)
- **Problem:** create user → seed keyring → seed vault → token are independent writes with no `db.Transaction`.
- **Impact:** Mid-sequence failure leaves half-created accounts; the retry path hits finding #2.
- **Suggestion:** Wrap each flow in a transaction; use `ON CONFLICT` upserts.

### 16. OAuth state is marked used before exchange (racy, burned on failure)
- **File:** `server/internal/auth/oauth.go:297-321`
- **Problem:** `UsedAt` is a read-then-update; it's set *before* the token exchange, so a provider hiccup permanently burns the state.
- **Impact:** Double token issuance in a race; spurious "error" redirects on transient provider failures.
- **Suggestion:** Conditional update with `RowsAffected` check; mark used only after a successful exchange or on terminal failure paths.

### 17. Zeroize gaps around the raw DEK
- **File:** `client/src-tauri/src/crypto.rs:214-232, 237-270`
- **Problem:** The unwrapped `dek_bytes` Vec is never zeroized; passwords/plaintext also cross IPC as non-zeroizing `String` (`lib.rs:777-780`).
- **Impact:** Key material lingers in heap buffers and survives memory dumps.
- **Suggestion:** Wrap DEK buffers in `Zeroizing`; where feasible pass byte buffers for secrets.

### 18. Modal lacks accessible naming; background not inert
- **File:** `client/src/components/ui/Modal.tsx:120-155`
- **Problem:** `role="dialog"`+`aria-modal` but no `aria-labelledby`; the close button is a bare `×` with no `aria-label`; background content isn't `inert`.
- **Impact:** Screen readers announce an unlabeled dialog; background content stays in the AT tree.
- **Suggestion:** `aria-labelledby` → heading; `aria-label="Close"`; mark background `inert` while open.

---

## Phase 3: Medium (architecture, state, structure)

### 19. ~39 whole-store subscriptions cause systemic re-renders
- **File:** `client/src/components/terminal/views/TerminalView.tsx:15-16`, `HostBrowser.tsx:63-66`, `SecurityTab.tsx:27`, `HostsPanel.tsx:38`, `pages/WorkspacesPage.tsx:9-10`
- **Problem:** Selector-less `useStore()` subscribes to entire state slices.
- **Impact:** Every `set()` (e.g., per-SSH-event pane state in terminalStore) re-renders large subtrees.
- **Suggestion:** Use field selectors or `useShallow`.

### 20. Module-level mutable singletons + import-time side effects
- **File:** `client/src/lib/terminal/sessionManager.ts:41` (module-level `sessions` map), `sessionManager.ts:361-365` (`useThemeStore.subscribe()` at import), `client/src/lib/crypto/crypto.ts:26,177` (module state), `authStore.ts:107` (`_restoreSessionLock`)
- **Problem:** State escapes the React/Zustand lifecycle; StrictMode/hot-reload divergence.
- **Suggestion:** Construct singletons at app init with explicit disposal, or route through the store.

### 21. `as`-style silent-corruption casts in the crypto layer
- **File:** `client/src/lib/crypto/crypto.ts:59-85`
- **Problem:** `{...obj} as Record<string, unknown>` + `result as T` mutate arbitrary string fields while claiming exact `T` type safety.
- **Impact:** A wrong `fields` list silently squashes data.
- **Suggestion:** Type via a validated subset or a zod-style round trip on the write path.

### 22. `{} as T` / `undefined as T` fallbacks in the API layer
- **File:** `client/src/lib/api/api.ts:1-12` (dead ApiClient returning `{} as T`), `client/src/lib/api/auth.ts:124` (`return undefined as T` for 204)
- **Problem:** Dead/ambiguous API surface.
- **Impact:** If imported by accident, downstream `.foo` accesses fail only at runtime; the 204 branch erases nullability.
- **Suggestion:** Delete the stub; return `Promise<T | undefined>`.

### 23. `themeStore.ts` mixes ~1,700 lines of static data with the store
- **File:** `client/src/stores/themeStore.ts` (1776 lines: `themes` 66-1016, `terminalThemes` 1046-1709, zustand store 1785-1793)
- **Problem:** Static color tables live inside the store; `applyTheme` also mutates document/theme maps as a side effect.
- **Suggestion:** Split data into `lib/theme/data.ts` and keep runtime state in the store; keep `applyTheme` pure.

### 24. No code-splitting or error boundaries anywhere
- **File:** client-wide (no `React.lazy` / `ErrorBoundary` matches in `client/src`)
- **Problem:** All pages are eagerly bundled; any render error unmounts the whole tree.
- **Suggestion:** `React.lazy` the heavy routes (editor, sftp, git); add an error boundary per major panel.

### 25. Long files, trending monolithic (>500 lines)
- **File:** `client/src/components/editor/panels/SourceControlPanel.tsx` (1155), `LocalFileBrowser.tsx` (827), `EditorExplorer.tsx` (756), `EditorView.tsx` (579), `authStore.ts` (639), `terminalStore.ts` (575), `editorStore.ts` (535); server `internal/auth/handlers.go` (627), `oauth.go` (540)
- **Impact:** Single-responsibility pressure; hard to review/extend.
- **Suggestion:** Split by concern (hooks, subcomponents, selectors).

### 26. ARIA/select component correctness
- **File:** `client/src/components/ui/Select.tsx:146-185` (combobox missing `aria-controls`/`aria-activedescendant`; index computed over a different array than `enabledOptions` — disabled entries break arrow-key nav), `CommandAutocomplete.tsx:145-180` (backdrop in tab order; selection index can exceed the rendered `slice(0,10)` so Enter activates an invisible item), `SortableTab.tsx:54-60` (interactive buttons nested inside `div[role=button]`; inner buttons only `title=` as the accessible name)
- **Fix:** Id the listbox and index within one filtered array; clamp palette selection to the viewport and `aria-hidden` the backdrop; un-nest real buttons.

### [UNCERTAIN] 27. Contrast of textSubtle/muted tokens below WCAG AA
- **File:** `client/src/stores/themeStore.ts:76` (`dark.textSubtle #71717a` on `#0a0a0a` ≈ 4.0:1 < 4.5:1)
- **Problem:** Muted/secondary text uses this token across themes; normal-text AA needs 4.5:1.
- **Suggestion:** Raise muted tokens ≥ #8a8a93, or add a contrast-check CI job.

---

## Phase 4: Low (hygiene, polish, docs)

### 28. Request ID middleware never wired
- **File:** `server/cmd/termvault-server/main.go:39`, `server/internal/auth/middleware.go:14-21`
- **Problem:** Every success/error payload returns `request_id: ""`.
- **Fix:** `r.Use(auth.RequestID())`.

### 29. CORS reflects the request Origin with no allowlist
- **File:** `server/internal/auth/middleware.go:133-152`
- **Problem:** `Access-Control-Allow-Origin` echoes `Origin`; no `Vary: Origin`, no allowlist.
- **Fix:** Allowlist origins (or the configured `BASE_URL` origin) and set `Vary: Origin`.

### 30. Dead/inconsistent code
- **File:** `server/internal/auth/jwt.go:31-44` (JWT refresh token generated on every call and always discarded — real refresh tokens are DB rows); `client/src-tauri/src/db.rs:9-72` (`LocalDb::open` never called in production, while AGENTS.md claims DB "encrypted at rest" — the SQLite file is plaintext with field-level encryption only)
- **Fix:** Delete the JWT refresh return; wire real at-rest encryption (SQLCipher) or correct the claim.

### 31. DATABASE_URL scheme ignored
- **File:** `server/cmd/termvault-server/main.go:23-27`
- **Problem:** Always uses the sqlite GORM driver regardless of DSN scheme, contradicting the documented Postgres/MySQL support.
- **Fix:** Switch on the DSN scheme and use the matching GORM driver.

### 32. Config parse errors fail silently
- **File:** `server/internal/config/config.go:101-104` (`parseDuration` swallows errors → `JWT_EXPIRY=abc` = instantly-expiring tokens)
- **Fix:** Return errors and fail fast at startup.

### 33. Live-looking credentials in the working `.env`
- **File:** `server/.env:24,47-57` (real-format JWT secret + Google/GitHub OAuth secrets)
- **Note:** Confirmed git-ignored (not in `git ls-files`) — but the OAuth secrets are live. Rotate if possibly shared; keep a `.env.example` with placeholders as the committed reference.

### 34. CSP connect-src is wide open to localhost
- **File:** `client/src-tauri/tauri.conf.json:44` — `connect-src` allows `http://localhost:*`
- **Impact:** [UNCERTAIN] An XSS-able WebView becomes a pivot for probing local services.
- **Fix:** Tighten to the API origin + dev server only.

### 35. AGENTS.md documents the wrong quote convention
- **File:** `AGENTS.md` ("biome enforces single quotes") vs `client/biome.json` (`quoteStyle: "double"`, used consistently across the repo).
- **Fix:** Update AGENTS.md to say double quotes.

---

## Phase 5: Info / observations
- Client is green on typecheck (tsc 0), lint (biome), and 38 vitest unit tests; server passes `go vet` + `go test` — but unit coverage is thin for the CRUD/persistence stores given they're stubs.
- Verified clean: no `any`, `@ts-ignore`, `dangerouslySetInnerHTML`, or raw `innerHTML` in the client. Go/Rust SQL is parameterized throughout (GORM builders, rusqlite `params!`); Rust uses XChaCha20Poly1305 with random 24-byte nonces + AAD; git commands run via argv with `--` separators — no shell interpolation.
- SSH connections are deliberately direct client→remote (server never sees credentials) — the zero-knowledge model is sound as designed.
- Auth flows (password login, GitHub+Google OAuth, signup setup, auto-unlock, refresh-token rotation) are implemented and patched end-to-end (commits `0f2c679`, `efcf828`). Recommended next: a manual+automated smoke test over signup/login/session-restore/unlock as outlined in the design doc, then the Phase-1 items above.