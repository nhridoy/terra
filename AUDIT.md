# TermVault — Codebase Audit Report

## Overall Status

| Area | Status |
|------|--------|
| Completion vs PLAN.md | ~80-85% |
| Production-ready | No (missing OAuth, WebSocket, tests) |
| Core features working | Yes (SSH, SFTP, vaults, snippets, workspaces, sync, port forwarding, teams) |

---

## 1. CRITICAL SECURITY VULNERABILITIES

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | **SyncPush IDOR** — Client can overwrite any record by UUID, including other users' records | `server/internal/api/sync.go:95` | **CRITICAL** |
| 2 | **Plaintext credentials in DB** — Host passwords, SSH keys, passphrases stored unencrypted server-side | `server/internal/db/models.go:49-51` | **CRITICAL** |
| 3 | **CSP disabled** (`"security": {"csp": null}`) — App can load any script from any origin | `client/src-tauri/tauri.conf.json` | **CRITICAL** |

---

## 2. SERVER ISSUES

### 2a. Security

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | No access token revocation — logout only deletes refresh tokens; access token stays valid until expiry | `server/internal/api/auth.go:294-303` | HIGH |
| 2 | No rate limiting on `/api/auth/refresh`, `/api/sync/push` | `server/cmd/termvault-server/main.go` | HIGH |
| 3 | Rate limiter memory leak — unbounded map growth, no cleanup | `server/internal/auth/ratelimit.go:33-40` | MEDIUM |
| 4 | No CSRF protection | `server/cmd/termvault-server/main.go` | MEDIUM |
| 5 | SyncPush errors silently ignored — no error checking on individual `Save()` calls | `server/internal/api/sync.go:93-123` | HIGH |
| 6 | No request body size limits — SyncPush can accept arbitrarily large payloads | `server/internal/api/sync.go` | MEDIUM |
| 7 | No input validation on password/privatekey/passphrase fields | `server/internal/api/data.go:14-25` | MEDIUM |

### 2b. Missing Features

| # | Feature | Notes |
|---|---------|-------|
| 1 | OAuth | Both `OAuthRedirect` and `OAuthCallback` return 501 Not Implemented |
| 2 | WebSocket real-time sync | No WebSocket code exists anywhere |
| 3 | SSH proxy | No `internal/ssh/` package exists |
| 4 | ~~Account deletion endpoint~~ | ✅ Done: `DELETE /api/auth/account` |
| 5 | ~~Password complexity rules~~ | ✅ Done: requires uppercase, lowercase, digit |
| 6 | SRP challenge-response flow | Full handshake implemented in `srp.go` but never wired up; login uses simplified verify-only path |
| 7 | ~~Pagination~~ | ✅ Done: `limit`/`offset` on all list endpoints |
| 8 | Search/filtering | Only `vaultId` query param; no text search |
| 9 | Audit logging | No record of who changed what |

### 2c. Code Quality

| # | Issue | Location |
|---|-------|----------|
| 1 | GORM `Updates()` with struct skips zero-value fields — `{"port": 0}` won't update | `data.go:89,178,372,455,537,619,682` |
| 2 | Redundant post-update SELECT — extra round-trip after every update | `data.go:102,184,280,379,461,543,625,689` |
| 3 | `mapToStruct` is fragile manual field copy | `sync.go:132-193` |
| 4 | JWT refresh token from `GenerateTokenPair` is never used (dead code) | `jwt.go:55-77` |
| 5 | Email parameter in SRP functions is unused | `srp.go:72,78` |
| 6 | `GenerateSalt()` defined but never called | `srp.go:56-60` |
| 7 | `Vault` model has unused `EncryptedData`/`IV`/`Salt` fields | `models.go:32-34` |
| 8 | Settings creation error silently ignored in Register | `auth.go:169` |
| 9 | `ValidateClientProof` claims constant-time but early-returns on length | `srp.go:182` |
| 10 | No foreign key constraints at DB level | `models.go` |
| 11 | ~~No database transactions — vault deletion leaves orphans~~ ✅ Done: `db.InTransaction()` wraps multi-record ops | `data.go:299-305` |
| 12 | Rate limit key is `ClientIP()` — behind reverse proxy all users share one IP | `ratelimit.go` |

### 2d. Docker

| # | Issue | Location |
|---|-------|----------|
| 1 | Go version mismatch — Dockerfile uses `golang:1.21-alpine` but `go.mod` says `go 1.25` | `Dockerfile:2` |
| 2 | `CGO_ENABLED=0` but `mattn/go-sqlite3` requires CGO — Docker build will fail | `Dockerfile:17` |
| 3 | `-X main.version=1.0.0` but no `var version string` in `main.go` | `Dockerfile:18` |
| 4 | No `.dockerignore` — `COPY . .` copies `.env` with secrets | `Dockerfile:15` |
| 5 | Health check path hardcoded, no DB connectivity probe | `Dockerfile:50` |

### 2e. Missing Infrastructure

| # | Item |
|---|------|
| 1 | Zero test files |
| 2 | ~~No graceful shutdown~~ ✅ Done: `srv.Shutdown()` on SIGINT/SIGTERM |
| 3 | ~~No structured logging~~ ✅ Done: `log/slog` JSON handler |
| 4 | No metrics/observability (Prometheus, etc.) |
| 5 | ~~No API versioning~~ ✅ Done: all routes under `/api/v1/` |
| 6 | No CORS config mechanism for production domains (hardcoded) |

---

## 3. CLIENT RUST ISSUES

### 3a. Security

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | No SSH host key verification — MITM vulnerability | `ssh.rs:connect()` | HIGH |
| 2 | No OS keychain persistence — tokens lost on app restart | Missing `keychain.rs` entirely | HIGH |
| 3 | Updater pubkey is dev placeholder ("untrusted for development") | `tauri.conf.json` | HIGH |
| 4 | Encryption key not zeroized from memory on `clear_auth` | `lib.rs:clear_auth` | MEDIUM |
| 5 | Argon2 `OPS_LIMIT=2` (OWASP recommends ≥3 for master passwords) | `vault.rs:11` | MEDIUM |
| 6 | Plaintext password/key columns in SQLite schema | `db.rs` schema | MEDIUM |
| 7 | No `store:default` capability permission | `capabilities/default.json` | MEDIUM |
| 8 | No HTTP scope restriction | `capabilities/default.json` | MEDIUM |
| 9 | No filesystem scope restriction | `capabilities/default.json` | MEDIUM |

### 3b. Bugs

| # | Issue | Location |
|---|-------|----------|
| 1 | `sftp_chmod` is a complete no-op stub | `ssh.rs:368` |
| 2 | `update_key` command missing — can create/delete but not update | `crud.rs` |
| 3 | `delete_vault` cascade broken — tries to delete by vault ID instead of vault_id | `crud.rs:382-389` |
| 4 | `update_vault` boolean parsing bug — `isDefault`/`isSystem` parsed as string then i64 | `crud.rs:366-367` |
| 5 | `greet` command is dead code | `lib.rs:23` |

### 3c. Code Quality

| # | Issue | Location |
|---|-------|----------|
| 1 | Dead dependencies: `anyhow`, `log`, `env_logger` — never imported/used | `Cargo.toml` |
| 2 | `tokio` with `full` features — app uses `std::thread::spawn`, not tokio tasks | `Cargo.toml` |
| 3 | All list functions do full table scan + Rust-side filtering | `crud.rs`, `db.rs` |
| 4 | No SQLite WAL mode | `db.rs` |
| 5 | No database indexes beyond primary keys | `db.rs` |
| 6 | Single global DB connection with Mutex | `db.rs` |
| 7 | No `VACUUM` or `ANALYZE` after deletions | `db.rs` |
| 8 | Inconsistent parameter naming (`ws`/`workspace`, `tg`/`tab_group`) | `crud.rs` |
| 9 | In-memory cross-session SFTP copy loads entire file into memory | `ssh.rs:sftp_cross_copy` |
| 10 | Port forwarding uses polling with `set_read_timeout` + sleep | `ssh.rs` |

---

## 4. CLIENT REACT ISSUES

### 4a. Stubbed / UI-Only Features

| Feature | Status | Details |
|---------|--------|---------|
| Port Forwarding | ✅ Done | Connected to Rust `port_forward_start`/`_stop`/`_list` |
| Teams | ✅ Done | Server models + 11 API endpoints + `teamStore` calls real API |
| Shared Vaults | ✅ Done | Server model + API endpoints + `sharedVaultStore` calls real API |
| SFTP Upload/Download | ✅ Done | `FileBrowser` calls `sftp_write`/`sftp_read` via Rust backend |
| OAuth Login | ❌ Stubbed | `OAuthLogin.tsx` always returns "not yet available" |

### 4b. Bugs

| # | Issue | Location |
|---|-------|----------|
| 1 | ~~`sessionStore.userId` hardcoded to `''`~~ — Fixed: reads from authStore | `sessionStore.ts` |
| 2 | No offline queue — local changes made offline get deleted on sync | `sync.ts` |

### 4c. Stores with Real Backend Integration (16/17)

✅ `authStore`, `hostStore`, `vaultStore`, `terminalStore`, `keyStore`, `snippetStore`, `settingsStore`, `sessionStore`, `workspaceStore`, `tabGroupStore`, `themeStore`, `updateStore`, `dragStore`, `teamStore`, `sharedVaultStore`, `sftpStore` (partial)

❌ `portForwardingStore` (missing — uses Rust invoke directly)

---

## 5. WHAT NEEDS TO BE DONE FOR PRODUCTION READINESS

### Phase 1: Security Fixes (Critical) ✅ DONE
- [x] Fix SyncPush IDOR — verify record ownership before upsert
- [x] Encrypt credentials at rest on server (client encrypts before sync, server stores encrypted blobs)
- [x] Enable strict CSP in tauri.conf.json
- [x] Implement SSH host key verification (SHA256 fingerprint emitted to frontend)
- [x] Implement OS keychain token persistence (store:default capability added)
- [x] Add access token revocation on logout
- [x] Increase Argon2 OPS_LIMIT to ≥3
- [x] Add rate limiting to /refresh and /sync/push
- [x] Add input validation on all endpoints (batch size limit on sync)
- [x] Add .dockerignore

### Phase 2: Core Fixes ✅ DONE
- [x] Fix Docker build (Go version 1.23, CGO_ENABLED=1 for go-sqlite3, removed stale ldflags)
- [x] Fix `delete_vault` cascade (client: delete by vault_id via `db::delete_by_column`)
- [x] Fix GORM zero-value skipping (replaced `Updates()` with `Save()` on all 8 entities)
- [x] Fix rate limiter memory leak (background cleanup goroutine)
- [x] Add `store:default` capability permission
- [x] Remove dead code (`greet` command, unused JWT refresh token generation, `GenerateSalt`)
- [x] Remove dead Cargo dependencies (`anyhow`, `log`, `env_logger`)
- [x] Implement `sftp_chmod` (uses `sftp.stat()` + `sftp.setstat()`)
- [x] Implement `update_key` (new Tauri command + registered in lib.rs)
- [x] Fix `update_vault` boolean parsing (handles bool, number, and string types)

### Phase 3: Feature Completion
- [ ] Implement OAuth (GitHub, Google)
- [ ] Implement WebSocket real-time sync
- [x] Implement port forwarding UI (connect to Rust backend)
- [x] Implement teams and shared vaults
- [x] Implement SFTP upload/download
- [x] Add pagination to list endpoints
- [x] Add account deletion endpoint
- [x] Add password complexity rules
- [x] Fix session logging (remove hardcoded userId)

### Phase 4: Quality & Infrastructure
- [ ] Add server tests (unit + integration)
- [ ] Add client tests
- [x] Add graceful shutdown
- [x] Add structured logging
- [x] Add API versioning (`/v1/`)
- [x] Add database transactions for multi-record operations
- [x] Enable SQLite WAL mode
- [x] Add database indexes
- [ ] Add Prometheus metrics
- [x] Add graceful error handling (no `.unwrap()` / `.expect()` in production paths)
