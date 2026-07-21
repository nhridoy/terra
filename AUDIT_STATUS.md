# TermVault — Audit Status Tracker

> Consolidated from AUDIT.md + AUDIT_2.md. Generated 2026-07-20.

## Summary

| Metric | Value |
|--------|-------|
| Total items tracked | 73 |
| Done / Fixed | 57 |
| Partially fixed | 2 |
| Not applicable | 2 |
| Still broken / Not done | 12 |

---

## 1. STILL BROKEN / NOT DONE

### 1a. Server — Missing Features

| # | Status | Item | Description | Solution |
|---|--------|------|-------------|----------|
| 1 | ⬜ | OAuth (GitHub, Google) | Server `OAuthRedirect`/`OAuthCallback` return 501. Client `OAuthLogin.tsx` is a UI stub that shows "not yet available". No OAuth provider integration exists anywhere. | Implement OAuth2 Authorization Code flow. Server needs provider configs (client ID/secret), redirect handlers, callback token exchange. Client needs to open system browser via `tauri-plugin-shell` and capture the callback URL. |
| 2 | ⬜ | WebSocket real-time sync | Only 30s polling sync exists. No WebSocket code anywhere in server or client. Polling wastes bandwidth and adds latency. | Add `gorilla/websocket` upgrade on server. Client connects after auth. Server broadcasts record changes to all connected clients for the same user. Add reconnection + exponential backoff. |
| 3 | ⬜ | SSH proxy (server-side) | No `server/internal/ssh/` package. All SSH is direct client→remote via Tauri Rust backend. Server never proxies SSH traffic. | Add `x/crypto/ssh` server in `internal/ssh/`. Client connects to server, server connects to target host. Enables browser-based SSH, audit logging, and credential vaulting server-side. |
| 4 | ⬜ | Search/filtering | Only `vaultId` query param on list endpoints. No text search across hosts, snippets, keys. Users with many records can't find anything quickly. | Add `q` query param to list endpoints. Server: `WHERE name LIKE ? OR address LIKE ?` with GORM. Client: debounced search input in sidebar/list views. Consider SQLite FTS5 for full-text search. |
| 5 | ⬜ | Audit logging | No record of who changed what. Can't trace data modifications or detect unauthorized access. | Add `audit_logs` table (user_id, action, table, record_id, old_value, new_value, timestamp). Hook into sync upsert/delete paths. Add GET `/api/v1/audit-logs` endpoint. |
| 6 | ⬜ | SRP challenge-response wiring | Full SRP6a implementation exists in `srp.go` with Termius-compatible protocol types. But login uses simplified verify-only path. The handshake is never actually used. | Wire `CreateServerChallenge` into login flow. Client sends `SRPClientHello`, server responds with `SRPServerHello`, client computes `M1`, server validates and responds with `M2`. Replace current password-only login with SRP. |
| 7 | ⬜ | Prometheus metrics | No observability. Can't monitor request rates, error rates, latency, or resource usage. | Add `prometheus/client_golang`. Instrument request count, duration, error count per endpoint. Add `/metrics` endpoint behind auth. |
| 8 | ⬜ | Documentation | No `docs/` directory. Architecture, API reference, encryption docs, deployment guide all missing. Blocks community contribution. | Create `docs/` with: `architecture.md`, `api.md`, `encryption.md`, `deployment.md`, `contributing.md`. Document the sync protocol, Argon2id + ChaCha20 flow, and Tauri ↔ server communication. |
| 9 | ⬜ | Mobile app (React Native) | Not started. No React Native code or configuration exists. | Create `mobile/` directory with React Native + Expo. Reuse server API. Implement SSH client via `react-native-ssh` or similar. |
| 10 | ⬜ | Server tests | Zero `*_test.go` files. No unit or integration tests. No regression safety net. | Add tests for: auth flow (register/login/refresh/revoke), sync push/pull, conflict resolution, rate limiting, input validation. Use `httptest` for API tests, `go-sqlmock` or real SQLite for DB tests. |
| 11 | ⬜ | Client tests | Zero `*.test.*` or `*.spec.*` files. No React component or store tests. | Add Vitest tests for stores (hostStore, vaultStore, authStore), components (HostForm, KeyList), and lib functions (vaultCrypto, validate). |

### 1b. Server — Code Quality

| # | Status | Item | Description | Solution |
|---|--------|------|-------------|----------|
| 12 | ⬜ | Unused `email` param in SRP | `GenerateVerifier(email, password, salt)` and `VerifyPassword(email, password, ...)` accept `email` but never use it in the function body. Dead parameter. | Remove `email` parameter from both functions. Update callers in `auth.go` to not pass email. |
| 13 | ✅ | Vault vestigial fields | `Vault` model had `EncryptedData`, `IV`, `Salt` fields with `json:"-"` tags. These were never used — the sync protocol doesn't send them. GORM AutoMigrate creates the columns anyway. | Removed the three fields from `db/models.go`. Removed `encryptedData`, `iv`, `salt` from client `VaultItem` interface. Cleaned up dead `encryptedData` check in `switchVault`. |
| 14 | ✅ | Settings creation error ignored | In `auth.go` Register handler, `db.GetDB().Create(&settings)` was discarding the error. If settings creation failed, user was created without settings and no log entry existed. | Added error check with `slog.Error` logging. Registration still succeeds (client auto-creates default settings on first read), but failures are now visible in structured logs. |
| 15 | ➖ | No foreign key constraints | No `gorm:"foreignKey:..."` tags on any model. GORM AutoMigrate doesn't create FK constraints. Orphaned records possible if cascade logic has bugs. | **Not applicable — sync protocol conflicts.** The client pushes `hosts` before `vaults`, but `hosts.vault_id` references `vaults.id`. FK constraints would fail on every sync with new records. Soft deletes (`is_deleted`) don't trigger FK cascades anyway. The app already handles referential integrity manually via `delete_vault` cascade and `verifyOwnership`. |
| 16 | ⬜ | Docker Go version mismatch | Dockerfile uses `golang:1.23-alpine` but `go.mod` says `go 1.25`. May cause build failures with newer Go features. | Update Dockerfile to `golang:1.25-alpine` or pin go.mod to `go 1.23`. |
| 17 | ⬜ | Docker health check no DB probe | Health check is `wget http://localhost:8080/health`. Returns `{"status":"ok"}` without checking DB connectivity. | Add DB ping to health endpoint: `db.GetDB().Raw("SELECT 1").Error`. Return 503 if DB is down. |

### 1c. Client Rust

| # | Status | Item | Description | Solution |
|---|--------|------|-------------|----------|
| 18 | ⬜ | Updater pubkey placeholder | `tauri.conf.json` pubkey is `dW50cnVzdGVkIGZvciBkZXZlbG9wbWVudCwgbm90IHByb2R1Y3Rpb24=` which decodes to "untrusted for development, not production". App won't auto-update securely. | Generate a real Ed25519 keypair. Store private key securely (CI/CD secrets). Put public key in `tauri.conf.json`. Use `tauri-plugin-updater` sign functionality. |
| 19 | ✅ | No SQLite WAL mode | `db.rs` didn't enable WAL mode. Default journal mode was DELETE which is slower for concurrent reads. | Added `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;` after connection open. Matches server-side SQLite config. |
| 20 | ✅ | No database indexes | No `CREATE INDEX` statements beyond primary keys. Queries filter on `user_id`, `vault_id`, `synced`, `is_deleted` without indexes. Full table scans on every query. | Added `(user_id, synced)` composite index on all 8 tables for sync queries. Added `vault_id` index on 6 tables for cascade deletes. Note: `list_*` functions still do full table scans (see #21). |
| 21 | ✅ | Full table scan + Rust filtering | All list functions (`list_hosts`, `list_groups`, etc.) call `db::fetch_all()` which loads ALL rows, then filter in Rust with `.filter()`. Slow for large datasets. | Move filtering to SQL: `SELECT * FROM hosts WHERE user_id = ? AND vault_id = ? AND is_deleted = 0`. Add `fetch_filtered(table, column, value)` helper in `db.rs`. |
| 22 | ✅ | No VACUUM/ANALYZE | After deletions and updates, SQLite doesn't reclaim space or update query planner statistics. DB file grows unbounded over time. | `PRAGMA optimize;` runs on startup to update statistics. Background `VACUUM` runs on startup in a separate thread during splash screen to reclaim space from deleted rows. |
| 23 | ➖ | Single global DB connection | One Mutex-wrapped connection shared across all threads. Blocks concurrent access. | **Accepted for v1.** WAL mode already provides concurrent readers. Mutex is only held during writes. Desktop app doesn't have high concurrency needs. A connection pool would add complexity without meaningful benefit for this use case. |

### 1d. Client Rust — Partially Fixed

| # | Status | Item | Description | Solution |
|---|--------|------|-------------|----------|
| 24 | ✅ | SSH host key verification | SHA-256 fingerprint is emitted to frontend via event. But there's no `known_hosts` file, no trust-on-first-use persistence, and no rejection of changed keys. Information-only, not verification. | Implemented TOFU: first connection trusts and saves fingerprint to `~/.termvault/known_hosts`. Subsequent connections verify against saved fingerprint. If key changed, shows warning dialog with old/new fingerprints. User can accept (update known_hosts) or reject (abort connection). |
| 25 | 🔶 | Docker Go version | Updated from `golang:1.21-alpine` to `golang:1.23-alpine`. Still mismatched with `go 1.25` in go.mod. | Either update Dockerfile to `golang:1.25-alpine` or downgrade go.mod to `go 1.23`. |
| 26 | 🔶 | REST update endpoints | All 8 update endpoints in `data.go` parse the request but never copy fields to the model. `Save()` re-saves the unchanged DB record. No-ops by design comment. | Either implement proper field copying (each endpoint copies `req` fields to model) or remove the endpoints entirely since the client uses sync. Document decision. |

### 1e. Client React

| # | Status | Item | Description | Solution |
|---|--------|------|-------------|----------|
| 27 | ⬜ | OAuthLogin stub | `OAuthLogin.tsx` is a UI shell with two buttons. `handleOAuthLogin` does nothing except show "not yet available" error. Server endpoints return 501. | Depends on server OAuth implementation (item #1). Once server is ready, implement OAuth2 PKCE flow: open system browser, capture callback, exchange code for tokens. |
| 28 | ✅ | portForwardingStore missing | No React store for port forwarding. State is managed entirely on Rust side (`SSHState.port_forwards`). No UI for listing/managing port forwards. | Created `portForwardingStore.ts` with Zustand. Updated `PortForwarding.tsx` component to use store. Added port forwarding button in terminal pane header that opens a slide-out panel. |

---

## 2. DONE / FIXED

### 2a. Critical Security (AUDIT.md Section 1)

| # | Status | Item | Details |
|---|--------|------|---------|
| 1 | ✅ | SyncPush IDOR | `verifyOwnership` checks record ownership before every upsert and delete in `sync.go`. |
| 2 | ✅ | Plaintext credentials server-side | Client encrypts all sensitive data before sync. Server stores encrypted blobs only (zero-knowledge). |
| 3 | ✅ | CSP disabled | Strict CSP enabled: `default-src 'self'`, restrictive `connect-src`, no `unsafe-eval`. |

### 2b. Server Security (AUDIT.md Section 2a)

| # | Status | Item | Details |
|---|--------|------|---------|
| 4 | ✅ | Access token revocation | `RevokeAllTokensForUser` adds user to in-memory revocation map. `AuthMiddleware` checks map and rejects tokens. |
| 5 | ✅ | Rate limiting on refresh/push | Both `/auth/refresh` and `/sync/push` use `RateLimitByKeyMiddleware` with UserID key. |
| 6 | ✅ | Rate limiter memory leak | Background cleanup goroutine runs every 5 minutes, deletes expired entries. |
| 7 | ✅ | SyncPush errors silently ignored | Each record's error is captured and returned in the response with status "error" or "conflict". |
| 8 | ✅ | No request body size limits | Max 500 records per sync batch. Prevents abuse. |
| 9 | ✅ | No input validation | 3-layer validation: client UI (maxLength + `validate.ts`), Rust (`validate_credential_lengths`), server (`binding` tags + `validateRecordFields`). |

### 2c. Server Code Quality (AUDIT.md Section 2c)

| # | Status | Item | Details |
|---|--------|------|---------|
| 10 | ✅ | GORM `Updates()` zero-value skipping | All models use `Save()` which writes all fields including zero values. |
| 11 | ✅ | Redundant post-update SELECT | No redundant SELECTs in update endpoints. |
| 12 | ✅ | `mapToStruct` fragile manual copy | Now uses `mapstructure` library with `TagName: "json"`. Only 4 `json:"-"` fields need explicit handling. |
| 13 | ✅ | Dead code in `GenerateTokenPair` | Function is clean, no unused variables or dead branches. |
| 14 | ✅ | `GenerateSalt()` unused | Function removed entirely. |
| 15 | ✅ | `ValidateClientProof` early-return | Returns `false` on length mismatch (prevents panic in byte comparison). |

### 2d. Server Infrastructure (AUDIT.md Section 2e)

| # | Status | Item | Details |
|---|--------|------|---------|
| 16 | ✅ | Graceful shutdown | `srv.Shutdown()` on SIGINT/SIGTERM. |
| 17 | ✅ | Structured logging | `log/slog` JSON handler. |
| 18 | ✅ | API versioning | All routes under `/api/v1/`. |
| 19 | ✅ | Database transactions | `db.InTransaction()` wraps multi-record operations. |
| 20 | ✅ | CORS config | Configurable via `ALLOWED_ORIGINS` env var with sensible defaults. |

### 2e. Server Missing Features (AUDIT.md Section 2b)

| # | Status | Item | Details |
|---|--------|------|---------|
| 21 | ✅ | Account deletion | `DELETE /api/auth/account` endpoint exists. |
| 22 | ✅ | Password complexity | Requires uppercase, lowercase, digit. |
| 23 | ✅ | Pagination | `limit`/`offset` on all list endpoints. |

### 2f. Docker (AUDIT.md Section 2d)

| # | Status | Item | Details |
|---|--------|------|---------|
| 24 | ✅ | CGO_ENABLED=0 | Now `CGO_ENABLED=1` (required for go-sqlite3). |
| 25 | ✅ | Stale ldflags | `-X main.version=1.0.0` removed. |
| 26 | ✅ | No .dockerignore | `.dockerignore` exists, excludes `.env`, `.db`, `.git`, build artifacts. |

### 2g. Client Rust Security (AUDIT.md Section 3a + AUDIT_2.md Section 3)

| # | Status | Item | Details |
|---|--------|------|---------|
| 27 | ✅ | No OS keychain persistence | `store:default` capability added. Tokens stored via `tauri-plugin-store` with OS keychain backing. |
| 28 | ✅ | Encryption key not zeroized | `clear_auth` calls `zeroize()` on encryption_key, access_token, refresh_token via the `zeroize` crate. |
| 29 | ✅ | Argon2 OPS_LIMIT=2 | Increased to 3 (OWASP recommended). |
| 30 | ✅ | Plaintext password columns | Full encryption wiring: encrypt/decrypt on JS side, `migratePlaintextCredentials()` after unlock, all CRUD paths encrypt before invoke. |
| 31 | ✅ | No `store:default` capability | Added to `capabilities/default.json`. |
| 32 | ✅ | No HTTP scope restriction | Removed unused `http:default` permission and `tauri-plugin-http` dependency. |
| 33 | ✅ | CSRF protection | Not applicable — Tauri app uses Bearer tokens, not cookies. |
| 34 | ✅ | Encryption key zeroize on clear_auth | Done with `zeroize` crate. |
| 35 | ✅ | Input validation (client) | `validate.ts` with max-length validators + `looksLikePrivateKey()` heuristic. `HostForm.tsx` and `KeyList.tsx` enforce on submit. |
| 36 | ✅ | Input validation (server) | Gin `binding:"max=..."` tags on request structs + `validateRecordFields` in sync push path. |
| 37 | ✅ | Rate limit by IP behind proxy | `TrustedClientIPMiddleware` extracts real IP from `X-Forwarded-For`. Authenticated routes use UserID key via `RateLimitByKeyMiddleware`. |

### 2h. Client Rust Bugs (AUDIT.md Section 3b)

| # | Status | Item | Details |
|---|--------|------|---------|
| 38 | ✅ | `sftp_chmod` stub | Fully implemented: `sftp.stat()` + set `stat.perm` + `sftp.setstat()`. |
| 39 | ✅ | `update_key` missing | Full `#[tauri::command]` implementation with credential preservation. |
| 40 | ✅ | `delete_vault` cascade broken | Cascades by `vault_id` column correctly using `db::delete_by_column`. |
| 41 | ✅ | `update_vault` boolean parsing | Handles `bool`, `Number`, and defaults to `0`. |
| 42 | ✅ | `greet` command dead code | Removed from `lib.rs`. |

### 2i. Client Rust Code Quality (AUDIT.md Section 3c)

| # | Status | Item | Details |
|---|--------|------|---------|
| 43 | ✅ | Dead dependencies | `anyhow`, `log`, `env_logger` removed from `Cargo.toml`. |
| 44 | ✅ | Inconsistent parameter naming | Removed unused `workspace`/`tab_group` alternatives. Renamed all params to snake_case. |
| 45 | ✅ | SFTP loads entire file | Both `sftp_copy` and `sftp_cross_copy` use 64KB streaming buffer. |

### 2j. Client React (AUDIT.md Section 4)

| # | Status | Item | Details |
|---|--------|------|---------|
| 46 | ✅ | Port Forwarding | Connected to Rust `port_forward_start`/`_stop`/`_list`. |
| 47 | ✅ | Teams | Server models + 11 API endpoints + `teamStore` calls real API. |
| 48 | ✅ | Shared Vaults | Server model + API endpoints + `sharedVaultStore` calls real API. |
| 49 | ✅ | SFTP Upload/Download | `FileBrowser` calls `sftp_write`/`sftp_read` via Rust backend. |
| 50 | ✅ | sessionStore userId hardcoded | Reads from `authStore` via `useAuthStore.getState().user?.id`. |

### 2k. AUDIT_2.md — Offline Queue & Sync

| # | Status | Item | Details |
|---|--------|------|---------|
| 51 | ✅ | Offline queue (local changes deleted on sync) | Fixed with `is_deleted` column, soft delete, `synced=0` tracking, timestamp-based conflict resolution. |
| 52 | ✅ | Sync optimization | `get_unsynced_records` fetches only `synced=0` records. `startPeriodicSync` pushes only pending changes. |
| 53 | ✅ | Delete idempotency | Server returns nil if record already deleted. |
| 54 | ✅ | Retry logic | `syncPush` retries 2x with backoff on transient errors. |

### 2l. AUDIT_2.md — Code Quality

| # | Status | Item | Details |
|---|--------|------|---------|
| 55 | ✅ | `mapToStruct` fragile | Now uses `mapstructure` library. |
| 56 | ✅ | Rate limit key shared IP | Non-issue — authenticated routes use UserID key. |
| 57 | ✅ | SFTP cross-session memory | 64KB streaming buffer in both functions. |
| 58 | ✅ | Port forwarding polling | Accepted as-is for v1. 100ms poll interval works. |
| 59 | ✅ | Inconsistent parameter naming | Fixed — removed unused alternatives, renamed to snake_case. |

---

## 3. Pre-Release Blockers

These items MUST be resolved before any public release:

| # | Item | Why |
|---|------|-----|
| 1 | Updater pubkey placeholder (#18) | Auto-updates will use an untrusted key. Security risk. |
| 2 | SSH host key verification partial (#24) | MITM attacks possible. Must implement TOFU persistence. |
| 3 | Docker Go version mismatch (#25) | Build may fail with newer Go features. |
