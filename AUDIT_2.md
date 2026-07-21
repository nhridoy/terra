# TermVault — 2nd Comprehensive Audit

## Verdict

| Metric | Value |
|--------|-------|
| Completion vs PLAN.md | **~80-85%** |
| Production-ready | **No** |
| Core features working | **Yes** |

---

## 1. What's DONE

- All Phase 1-4 items from AUDIT.md (security, core fixes, feature completion, quality infrastructure)
- SSH connections (direct client→remote, host key verification)
- SFTP (upload, download, browse, chmod)
- Vaults (encrypted CRUD, system vaults immutable, sync)
- Snippets, Workspaces, Keychain, Settings
- Sync (local-first, server relay, 30s polling)
- Port forwarding (UI connected to Rust backend)
- Teams + Shared Vaults (server models, 11 API endpoints, stores call real API)
- Encryption (Argon2id + ChaCha20Poly1305, OPS_LIMIT=3)
- Graceful shutdown, structured logging (slog JSON), API versioning (/api/v1/)
- DB transactions, WAL mode, 14 composite indexes
- Graceful error handling (zero .unwrap()/.expect() in Rust prod paths)

---

## 2. What's MISSING (blocks production readiness)

### High Severity

| Gap | Details |
|-----|---------|
| **OAuth (GitHub, Google)** | Server `OAuthRedirect`/`OAuthCallback` return 501. Client `OAuthLogin.tsx` is a stub. |
| **WebSocket real-time sync** | No WebSocket code exists. Only 30s polling sync. |
| **Tests** | Zero test files on server or client. No regression safety net. |

### Medium Severity

| Gap | Details |
|-----|---------|
| **SSH proxy (server-side)** | No `internal/ssh/` package. All SSH is direct client→remote. |
| **Search/filtering** | Only `vaultId` query param. No text search across hosts, snippets, keys. |
| **Audit logging** | No record of who changed what. |
| **Offline queue** | Local changes made offline get deleted on sync. |
| **Docker** | Go version mismatch (`golang:1.21-alpine` vs `go 1.25`), `CGO_ENABLED=0` breaks `go-sqlite3`. |
| **CORS config** | Hardcoded, not production-configurable. |

### Low Severity

| Gap | Details |
|-----|---------|
| **Prometheus metrics** | No observability. |
| **Mobile app** | React Native not started. |
| **Documentation** | `docs/` directory empty (architecture, API, encryption, deployment). |
| **CI/CD** | No GitHub Actions workflows. |
| **SRP full handshake** | Implemented in `srp.go` but never wired up; login uses simplified verify-only path. |

---

## 3. Remaining Security Items

| # | Issue | Severity |
|---|-------|----------|
| 1 | CSRF protection not implemented | MEDIUM |
| 2 | Updater pubkey is dev placeholder ("untrusted for development") | HIGH |
| 3 | Encryption key not zeroized from memory on `clear_auth` | MEDIUM |
| 4 | Plaintext password columns in client SQLite schema | MEDIUM |
| 5 | No HTTP/filesystem scope restriction in Tauri capabilities | MEDIUM |
| 6 | No input validation on password/privatekey/passphrase fields | MEDIUM |
| 7 | Rate limit key is `ClientIP()` — behind reverse proxy all users share one IP | LOW |

---

## 4. Code Quality Remnants

| # | Issue | Location |
|---|-------|----------|
| 1 | GORM `Updates()` with struct skips zero-value fields (fixed with `Save()` but fragile) | `data.go` |
| 2 | `mapToStruct` is fragile manual field copy | `sync.go` |
| 3 | Rate limit key is `ClientIP()` — behind reverse proxy all users share one IP | `ratelimit.go` |
| 4 | In-memory cross-session SFTP copy loads entire file into memory | `ssh.rs` |
| 5 | Port forwarding uses polling with `set_read_timeout` + sleep | `ssh.rs` |
| 6 | Inconsistent parameter naming (`ws`/`workspace`, `tg`/`tab_group`) | `crud.rs` |

---

## 5. Recommended Priority Order

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Add tests (server + client) | High | Regression safety, enables confident iteration |
| 2 | Fix Docker (Go version, CGO) | Low | Enables production deployment |
| 3 | Add search/filtering | Medium | Usability for large host lists |
| 4 | Implement OAuth | Medium | Alternative login, required by many users |
| 5 | WebSocket real-time sync | High | Better UX than polling |
| 6 | Add documentation | Medium | Enables community contribution |
| 7 | CI/CD pipelines | Medium | Automated testing + releases |
