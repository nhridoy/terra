# TermVault — Slice 1: Auth + Encryption Core (Design)

Date: 2026-08-04
Status: Draft
Scope: User signup/login (email + Google/GitHub OAuth), end-to-end encryption (envelope keys, recovery code), encrypted local vault, refresh-token sessions.

## 1. Goals

- Email/password signup + login, and social login (Google, GitHub) — one password concept for both login and decryption (Bitwarden/Termius model).
- Zero-knowledge: the server stores only ciphertext, key-wrapping blobs, and auth verifiers. It never receives the password, the KEK, the DEK, or plaintext vault data.
- Local-first: all data lives in an encrypted local SQLite DB; the app is fully usable offline (login trust + decryption are local).
- Professional-grade REST API (structured JSON, correct status codes) and schema (PKs, FKs, indexes) on the server; local schema mirrors the server schema.
- Offline unlock: password by default, optional "remember on this device" (OS keychain).
- Lost password is recoverable via a recovery code (recovery kit), unlike Termius which has no recovery.

## 2. Non-goals (later slices)

- Cross-device sync protocol (slice 2), team vaults / team keyring (slice 3), email verification, 2FA, passkeys, WebSocket/SSE live push, OAuth account linking (same email on two providers → 409 in this slice), refresh-token cross-device revocation UI.

## 3. Threat model & guarantees

- Server compromise: attacker sees ciphertext, wrapped keys, verifiers — cannot read vault data without the user's password (or recovery code). Offline brute-force of the password against the verifier is possible for anyone with the DB (same exposure as Bitwarden/Termius); mitigated by Argon2id parameters and rate limits.
- Device theft (locked): vault ciphertext at rest cannot be decrypted without KEK (password) or the keychain copy (only if user enabled "remember on this device").
- Password never leaves the client; auth verifier is a one-way function of the KEK.
- Refresh token stolen: rotated-on-use + reuse detection revokes all sessions.
- OAuth provider compromise: grants account access (identity), but not vault contents — the vault still requires the encryption password. **Social-setup race**: if an attacker compromises a Google/GitHub account before the legitimate user completes the `/auth/setup` step, the attacker could initialize the encryption identity on their own device first. Mitigated by the short `setup_token` TTL (5 min), device binding, and the fact that the legitimate user is forced through setup immediately on first login. After setup, OAuth access alone is insufficient.

## 4. Cryptography

### 4.1 Algorithms

| Purpose | Algorithm |
|---|---|
| Password KDF | Argon2id13, m=64 MiB, t=3, p=1, 16-byte random salt |
| Secret-key AEAD | XChaCha20-Poly1305, 24-byte random nonce, AAD = record type |
| Asymmetric (identity for team vaults, recovery proof) | X25519 keypair; private key encrypted at rest with the DEK |
| Auth verifier | `V = Argon2id(KEK, serverSalt)`; login proof `HMAC-SHA256(V, nonce)` |
| Token hashing | SHA-256 (refresh tokens stored hashed) |
| Access tokens | JWT HS256, `JWT_SECRET` |

Rust crates: `argon2`, `xchacha20poly1305`, `x25519-dalek`, `sha2`, `hmac`, `zeroize`. No libsodium C dependency. (Termius export interop — their XSalsa20/Poly1305 secretbox — is out of scope; algorithms stay compatible with libsodium `crypto_secretbox` primitives conceptually.)

### 4.2 Key hierarchy (envelope)

```
password ──Argon2id(salt_cl)──▶ KEK            (client-side, never stored)
recovery code (128-bit, base64url) ──Argon2id(salt_cl)──▶ recovery-KEK
DEK = random 32-byte data key, generated once per user, encrypts ALL vault values
X25519 keypair: private key encrypted with DEK; public key stored plaintext
```

### 4.3 Keyring (per-user rows in `user_keys`, synced encrypted)

| key_type | payload |
|---|---|
| `dek_wrapped_by_kek` | DEK sealed under KEK (row present only after password setup) |
| `dek_wrapped_by_recovery` | DEK sealed under recovery-KEK (present for every user) |
| `private_key_wrapped_by_dek` | X25519 private key sealed under DEK |

The X25519 **public key is stored on `users.public_key`** (plaintext, canonical), not as a keyring row.

- **Password change**: derive new KEK → re-wrap only `dek_wrapped_by_kek` → replace verifier. Vault records untouched.
- **Forgot password**: enter recovery code → recovery-KEK → unwrap DEK → set new password (new KEK wrap + new verifier), proven to the server by signing a nonce with the X25519 private key.
- **Social user**: keyring + verifier are NULL until the user completes the mandatory "set your encryption password" setup; setup creates salt_cl, DEK, keypair, recovery code, and all keyring rows.
- **Offline**: salt_cl is stored locally (and on the server — it is not secret); derivation is purely local, so offline unlock/decrypt needs no network.

### 4.4 Record encryption format

```
encrypted record value (stored in `records.data` or local DB):
{ "v": 1, "alg": "xchacha20poly1305", "nonce": b64, "ct": b64 }
```

AAD = `record_type`. Sensitive fields of hosts/keys/snippets are encrypted individually; structural metadata (id, timestamps, revision) stays plaintext so the server can order/sync without seeing content (needed for slice 2).

### 4.5 Recovery kit

At account creation the client generates a 128-bit recovery code (base64url, 22 chars). Shown once; also offered as a downloadable `.termvault-recovery` JSON file (contains `salt_cl` and the recovery-wrapped DEK as an offline backup). The `dek_wrapped_by_recovery` row is also stored server-side, so the code alone works on a brand-new device. No code + no password = data unrecoverable (advertised in UI).

## 5. Auth flows

### 5.1 Email register

1. Client calls `POST /auth/prelogin {email}` → server returns `{nonce, kdf:{type:"argon2id13", m, t, p}, server_salt, salt_cl}`. Prelogin always answers 200 — for unknown emails it returns a random `salt_cl` and `server_salt` so the endpoint cannot be used as an email-existence oracle. For known emails it returns the real values. The client always uses the returned `salt_cl` for login; for registration the client ignores it and generates its own.
2. Client generates salt_cl (16B), DEK, recovery code, X25519 keypair. Derives KEK = Argon2id(password, salt_cl); verifier `V = Argon2id(KEK, server_salt)`; proof `P = HMAC(V, nonce)`.
3. `POST /auth/register {user_id (client-generated UUID), email, name, device_id, salt_cl, verifier: V, proof: P, public_key, keyring: [dek_wrapped_by_kek, dek_wrapped_by_recovery, private_key_wrapped_by_dek]}` → 201 `{access_token, refresh_token, user}`. Register is **idempotent by `user_id`**: if the response is lost in a network drop, retrying the same `user_id` returns 200 with fresh tokens instead of 409 (email uniqueness makes concurrent duplicate registrations impossible).
4. Client persists keyring + user locally, shows recovery code once (kit download).

### 5.2 Email login

1. `POST /auth/prelogin {email}` → 200 `{nonce, kdf, server_salt, salt_cl}` (always 200; unknown emails get random values).
2. Client: KEK = Argon2id(password, salt_cl from server or local) → V → `P = HMAC(V, nonce)`.
3. `POST /auth/login {email, proof: P, device_id}` → server constant-time compares `HMAC(V_stored, nonce)` → 200 `{access_token, refresh_token, user, keyring}` (401 on mismatch; generic error message; 429 on rate limit).
4. Client unwraps DEK with KEK → vault unlocked (or keychain auto-unlock if enabled).

### 5.3 OAuth (Google / GitHub) — desktop flow

Server holds the provider client ID/secret (never shipped in the desktop binary).

1. App opens `GET /auth/oauth/start/{google|github}?device_id=X` in the system browser. Server creates an `oauth_states` row (state, PKCE code_verifier, device_id) and 302-redirects to the provider.
2. Provider redirects to `GET /auth/oauth/callback/{provider}?code&state`. Server exchanges code (PKCE), fetches profile (Google `openid email profile`; GitHub `read:user user:email`), upserts identity:
   - New user → creates user row (auth_provider + provider_sub, email, name) with a one-time `setup_token`; `initialized = false`.
   - Existing user with a different provider for the same email → account conflict (linking is a later slice).
3. Server 302-redirects to `termvault://auth/callback?code=<one_time_code>&setup=<setup_token>` where the one-time code (5 min, single use, `auth_codes` table) was issued for this device; `setup` is present only for new users. All flow errors (state mismatch, provider conflict, code exchange failure) redirect to `termvault://auth/error?reason=<error_code>` instead of surfacing raw HTTP errors in the system browser.
4. App (deep link `termvault://` registered via `tauri-plugin-deep-link`) calls `POST /auth/oauth/exchange {code, device_id}` → 200 `{access_token, refresh_token, user, initialized}`.
5. If `initialized == false`, the app forces the "set your encryption password" screen → `POST /auth/setup {setup_token, salt_cl, verifier, public_key, keyring}` → 200 fresh tokens; user can now unlock normally. Social login without setup cannot access vault features (client gates on `initialized`).

### 5.4 Session & tokens

- Access token: JWT 15 min (`JWT_EXPIRY`), claims `sub, device_id, jti, iat, exp`.
- Refresh token: 32 random bytes; stored as SHA-256 hash; 30 days (`REFRESH_TOKEN_EXPIRY`); bound to `device_id` + user agent.
- `POST /auth/refresh` → rotates: old token marked `rotated_at`, `replaced_by` points at the new token. Presenting an already-rotated token = reuse detected → revoke **all** of the user's sessions → 401.
- `POST /auth/logout` → 204, revokes presented refresh token. **Local wipe**: on logout the client also clears the keychain entry, locks and zeroes the key session, and deletes all locally stored vault data (records, keyring, profile) — the local DB is a cache, and the next login always restores from the server.
- `POST /auth/password` (password change) → requires `old_proof` (HMAC with fresh prelogin nonce), `new_verifier`, new `dek_wrapped_by_kek` → 204, revokes all sessions except current device.
- `POST /auth/recovery` (forgot password) → body: `{recovery_proof: signed_nonce, new_verifier, new keyring rows}` — server verifies the X25519 signature of a fresh nonce against the stored public key → replaces verifier + keyring → 204, revokes all sessions except current device. (`salt_cl` is immutable — both KEK and recovery-KEK derive from it.)

### 5.5 Offline behavior

- Open app with no network: if a local session (refresh token in keychain) and local vault exist, treat as logged in; unlock with password (or keychain if "remember" enabled); decrypt locally. On reconnect, validate refresh token and force re-login if revoked.
- **Account creation is always online** (both email and OAuth): the server must bind email/verifier/identity and enforce uniqueness. There is no offline account creation — this is universal (Bitwarden, 1Password, Termius, Proton all register online; offline only ever applies to *usage* of an existing account). A dropped register request is retried idempotently (see §5.1); a dropped OAuth flow just restarts.
- **Local-first means records, not accounts**: hosts/keys/snippets created while offline carry client-generated UUIDs and are pushed on reconnect (slice 2). Offline-created *accounts* never happen.

## 6. API contract

Base path `/api/v1`. JSON envelope — success: `{ "data": ..., "meta": { "request_id": "..." } }`; error: `{ "error": { "code": "AUTH_INVALID_CREDENTIALS", "message": "...", "request_id": "..." } }`.

| Endpoint | Success | Errors |
|---|---|---|
| `POST /auth/prelogin` | 200 `{nonce, kdf, server_salt, salt_cl}` | 400, 429 |
| `POST /auth/register` | 201 `{access_token, refresh_token, user}` | 400, 409 (email exists), 422, 429 |
| `POST /auth/login` | 200 `{access_token, refresh_token, user, keyring}` | 400, 401, 429 |
| `POST /auth/refresh` | 200 `{access_token, refresh_token}` | 401 (incl. reuse → revoke all), 429 |
| `POST /auth/logout` | 204 | 401 |
| `POST /auth/password` | 204 | 400, 401, 422, 429 |
| `POST /auth/recovery` | 204 | 400, 401, 422, 429 |
| `GET /auth/oauth/start/{provider}` | 302 | 400 (unknown provider), 429 |
| `GET /auth/oauth/callback/{provider}` | 302 → `termvault://auth/callback?...` | 302 → `termvault://auth/error?reason=...` |
| `POST /auth/oauth/exchange` | 200 `{access_token, refresh_token, user, initialized}` | 400, 401 (code invalid/used/expired), 429 |
| `POST /auth/setup` | 200 `{access_token, refresh_token}` | 400, 401 (setup_token invalid), 409 (already initialized), 422, 429 |
| `GET /me` | 200 `{id, email, name, initialized, auth_provider, created_at}` | 401 |

Status code policy: 200 OK (GET/success), 201 Created, 204 No Content (delete/logout/side-effect), 400 malformed body, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 validation, 429 rate-limited (`Retry-After` header), 500 server error. 401 vs 403: 401 = missing/invalid credentials; 403 = authenticated but not permitted (reserved for slice 3 RBAC).

Rate limiting (existing envs): `RATE_LIMIT_AUTH` (10/min) on prelogin/register/login/refresh/recovery/password; `RATE_LIMIT_API` (30/min) on the rest. Trusted proxy CIDRs from `TRUSTED_PROXIES`.

## 7. Server schema (GORM, portable — SQLite default, Postgres/MySQL via `DATABASE_URL`)

SQLite supports everything below (FKs, indexes, unique constraints); schema written dialect-agnostically so Postgres is a drop-in `.env` change — no Postgres credentials required now. The client's local DB mirrors only the **vault layer** of this schema (`vaults`, `records`, `user_keys` + a user-profile subset, see §8.1); the auth tables below are server-only.

```
users
  id            UUID PK (client/server generated)
  email         TEXT NOT NULL (lowercased), UNIQUE index
  name          TEXT NOT NULL
  auth_provider TEXT NOT NULL DEFAULT 'password'   -- password | google | github
  provider_sub  TEXT NULL                           -- provider user id
  auth_verifier TEXT NULL                           -- Argon2id(KEK, serverSalt); NULL until setup
  auth_salt     TEXT NULL
  salt_cl       TEXT NULL                           -- client KDF salt; not secret
  kdf_m         INTEGER NOT NULL DEFAULT 67108864
  kdf_t         INTEGER NOT NULL DEFAULT 3
  kdf_p         INTEGER NOT NULL DEFAULT 1
  public_key    TEXT NULL                           -- X25519, base64
  initialized   BOOLEAN NOT NULL DEFAULT FALSE      -- email register sets TRUE at signup; OAuth users become TRUE after /auth/setup
  last_login_at TIMESTAMP NULL
  created_at / updated_at TIMESTAMP
  UNIQUE (auth_provider, provider_sub)
  INDEX (email), INDEX (auth_provider, provider_sub)

user_keys
  id         INTEGER PK AUTOINCREMENT
  user_id    UUID NOT NULL FK → users(id) ON DELETE CASCADE
  key_type   TEXT NOT NULL        -- dek_wrapped_by_kek | dek_wrapped_by_recovery | private_key_wrapped_by_dek
  payload    BLOB/TEXT NOT NULL   -- base64 sealed payload
  created_at TIMESTAMP
  UNIQUE (user_id, key_type), INDEX (user_id)

refresh_tokens
  id           INTEGER PK AUTOINCREMENT
  user_id      UUID NOT NULL FK → users(id) ON DELETE CASCADE
  token_hash   TEXT NOT NULL UNIQUE (SHA-256 hex)
  device_id    TEXT NOT NULL
  user_agent   TEXT NULL
  expires_at   TIMESTAMP NOT NULL
  rotated_at   TIMESTAMP NULL
  revoked_at   TIMESTAMP NULL
  replaced_by  INTEGER NULL FK → refresh_tokens(id)
  created_at   TIMESTAMP
  INDEX (user_id), INDEX (expires_at), INDEX (token_hash)

oauth_states
  state         TEXT PK (32-byte base64url)
  provider      TEXT NOT NULL
  code_verifier TEXT NOT NULL
  device_id     TEXT NOT NULL
  expires_at    TIMESTAMP NOT NULL
  used_at       TIMESTAMP NULL
  created_at    TIMESTAMP
  INDEX (expires_at)

auth_codes
  id          INTEGER PK AUTOINCREMENT
  code_hash   TEXT NOT NULL UNIQUE   -- one-time codes (oauth exchange, setup tokens) hashed
  purpose     TEXT NOT NULL          -- oauth_exchange | setup
  user_id     UUID NOT NULL FK → users(id) ON DELETE CASCADE
  device_id   TEXT NOT NULL
  expires_at  TIMESTAMP NOT NULL
  used_at     TIMESTAMP NULL
  created_at  TIMESTAMP
  INDEX (expires_at), INDEX (user_id)

vaults  (created now; used by slice 2+)
  id         UUID PK
  owner_id   UUID NOT NULL FK → users(id) ON DELETE CASCADE
  kind       TEXT NOT NULL          -- personal | team
  name       TEXT NOT NULL
  created_at / updated_at
  INDEX (owner_id)

records  (created now; used by slice 2+)
  id          UUID PK (client-generated)
  user_id     UUID NOT NULL FK → users(id) ON DELETE CASCADE
  vault_id    UUID NOT NULL FK → vaults(id) ON DELETE CASCADE
  record_type TEXT NOT NULL          -- host | group | ssh_key | snippet | port_forward
  data        TEXT NOT NULL          -- JSON envelope {v, alg, nonce, ct}
  revision    INTEGER NOT NULL DEFAULT 1
  deleted_at  TIMESTAMP NULL
  created_at / updated_at
  INDEX (vault_id, revision), INDEX (user_id), INDEX (deleted_at)
```

AutoMigrate on startup (existing behavior). Signup seeds the Personal vault row.

## 8. Client architecture

### 8.1 Rust backend (`client/src-tauri`)

- `crypto.rs` — Tauri commands (all key material lives in Rust memory, `zeroize`d; the DEK and X25519 private key are held in an in-memory key session and never cross the IPC boundary):
  - `generate_account_material()` → `{salt_cl, recovery_code, public_key, private_key_wrapped_by_dek}` (DEK generated and retained in the Rust session)
  - `derive_kek(password, salt_cl)` → in-memory KEK (never returned to JS)
  - `compute_login_proof(kek, server_salt, nonce)` → verifier + HMAC proof
  - `build_keyring_rows(kek, recovery_code, salt_cl)` → `{dek_wrapped_by_kek, dek_wrapped_by_recovery, private_key_wrapped_by_dek}` (uses the session DEK)
  - `encrypt_secret(plaintext, record_type)` / `decrypt_secret(payload)` → uses session DEK
  - `unwrap_dek(kek, wrapped)` / `recovery_unwrap_dek(code, salt_cl, wrapped)` → DEK into session
  - `sign_challenge(nonce)` → signature with the session private key
  - `lock()` / `unlock(password, salt_cl)` — unlock derives KEK and unwraps the local keyring's DEK into the session; OAuth setup unlock uses the same path
- `keystore.rs` — OS keychain via the `keyring` crate (Windows Credential Manager/DPAPI, macOS Keychain, Linux Secret Service): refresh token + optional "remember" wrapped DEK/KEK. In-memory key-session guard. `tauri-plugin-store` (JSON file) holds only non-secret preferences (API URL, theme).
- `db.rs` — rusqlite (WAL, FK pragma on): **local mirror of the vault layer only** — `vaults`, `records`, `user_keys` (the wrapped keyring, required for offline unlock), plus a `user_profile` subset (id, email, name, initialized, salt_cl, kdf_m/t/p, public_key) and `local_meta` (device_id, remember_device, sync_cursor NULL until slice 2). Server-side auth tables (`refresh_tokens`, `oauth_states`, `auth_codes`) and the server credential fields (`auth_verifier`, `auth_salt`) are **never stored locally** — the refresh token lives in the OS keychain. All values stored as the same encrypted envelopes used server-side → "encrypted at rest" without SQLCipher.
- `oauth.rs` — deep-link handler (`termvault://auth/callback`) via `tauri-plugin-deep-link`, hands the one-time code to the auth store.

### 8.2 Frontend (`client/src`)

- Replace `lib/crypto/crypto.ts` stub with command wrappers (same exported API shape where possible).
- `stores/auth/` — register/login/logout/refresh/recovery/setup flows, offline login path, "remember on this device" toggle, prelogin nonce handling, auto-refresh (existing 401 → refresh → retry flow in `lib/api/`).
- `pages/auth/` — add social buttons, setup-password screen (post-OAuth), recovery-code reveal (post-register) + kit download, recovery-code restore screen.
- `lib/api/auth.ts` — wire to the new endpoints + error envelope parsing (`extractError`).

## 9. Error codes (server, stable strings)

`VALIDATION_FAILED`, `EMAIL_TAKEN`, `AUTH_INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `TOKEN_REUSED`, `SESSION_REVOKED`, `RATE_LIMITED`, `PROVIDER_UNSUPPORTED`, `OAUTH_STATE_MISMATCH`, `ACCOUNT_PROVIDER_CONFLICT`, `SETUP_TOKEN_INVALID`, `ALREADY_INITIALIZED`, `INTERNAL_ERROR`.

## 10. Testing strategy

- Server (Go, `go test`): unit — verifier/HMAC constant-time compare, refresh rotation + reuse detection, one-time code expiry/use, password change session revocation; handler tests — full status-code matrix per endpoint; integration — register → prelogin → login → refresh → logout; OAuth flow with `httptest` mock provider (canned discovery/token/userinfo); GORM schema migration test on SQLite in-memory.
- Client (Rust): envelope roundtrip, KDF determinism, recovery unwrap, challenge sign/verify, keystore lock/unlock, DB mirror CRUD.
- Client (TS, vitest): crypto wrapper mocks, auth store flows (login, offline login, refresh chain, setup gate).
- Manual smoke: register → recovery kit download → logout → login → password change → logout → recovery restore; Google/GitHub happy path + first-login setup; offline open + unlock; `pnpm build` + `cargo check` + `go vet` green.

## 11. Environment variables (additions)

| Variable | Default | Purpose |
|---|---|---|
| `OAUTH_GOOGLE_CLIENT_ID` / `OAUTH_GOOGLE_CLIENT_SECRET` | empty | Google OAuth |
| `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` | empty | GitHub OAuth |
| `OAUTH_REDIRECT_BASE` | `BASE_URL` | Callback base for provider redirects |
| `APP_SCHEME` | `termvault` | Deep-link scheme for OAuth callback |

## 12. Slice boundaries

- **This slice**: everything above.
- **Slice 2**: sync protocol (cursor pull + revision push, tombstones, LWW), `records` usage, SSE/WS live push.
- **Slice 3**: team vaults + team keyring (member public-key wrapping, owner MAC, revocation/re-key), RBAC (403 paths), account linking.
- **Later**: 2FA, passkeys, email verification, SRP (replacing prelogin/HMAC with SRP6a like Termius).
