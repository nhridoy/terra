# TermVault — Production Readiness Analysis

> Generated: 2026-07-20
> Verdict: **NOT production ready. Significant gaps remain.**

---

## Executive Summary

TermVault has a solid foundation — the UI is comprehensive, the encryption architecture is sound (Argon2id + ChaCha20Poly1305, zero-knowledge server), and the Rust/Go split is well-structured. However, the project has **critical missing features**, **architectural issues**, and **code quality problems** that prevent it from being a viable Termius alternative today.

**What works well:**
- UI/UX is polished with 30+ themes, drag-and-drop panes, split terminals
- End-to-end encryption with password + recovery kit
- Local-first architecture with sync
- SSH, SFTP, port forwarding all implemented
- Team/vault system with shared access

**Critical blockers:**
- No tests (zero unit/integration/e2e tests anywhere)
- Sync protocol has race conditions and data loss scenarios
- No proper token storage (access tokens in memory only — lost on restart)
- Server has no PostgreSQL/MySQL schema support beyond SQLite
- OAuth is a stub
- No mobile app
- No documentation

---

## 1. Feature Comparison with Termius

### ✅ Implemented (Partial or Full)

| Feature | Termius | TermVault | Status |
|---------|---------|-----------|--------|
| SSH terminal | Full | Full | ✅ Working |
| SFTP file browser | Full | Full | ✅ Working |
| Port forwarding (local) | Full | Full | ✅ Working |
| Host management | Full | Full | ✅ Working |
| Groups (nested) | Full | Full | ✅ Working |
| Vaults (Personal/Team) | Full | Full | ✅ Working |
| SSH key generation | Ed25519, RSA | Ed25519, RSA | ✅ Working |
| Snippets | Full | Full | ✅ Working |
| Workspaces | Full | Full | ✅ Working |
| Split panes | Full | Full | ✅ Working |
| Themes | 30+ | 30 | ✅ Working |
| End-to-end encryption | Full | Full | ✅ Working |
| Password + recovery | Full | Full | ✅ Working |
| Known hosts (TOFU) | Full | Basic | 🔶 Partial |
| Session logs | Full | Stub | 🔶 Partial |
| Team collaboration | Full | Basic | 🔶 Partial |

### ❌ Missing (Critical)

| Feature | Termius | Termius | Status |
|---------|---------|---------|--------|
| Jump host / Host chain | Supported | Missing | ❌ Not implemented |
| SOCKS/HTTP proxy | Supported | Missing | ❌ Not implemented |
| Telnet protocol | Supported | Missing | ❌ Not implemented |
| Mosh protocol | Supported | Missing | ❌ Not implemented |
| Local terminal | Supported | Missing | ❌ Not implemented |
| SSH certificates | Supported | Missing | ❌ Not implemented |
| Environment variables | Supported | Missing | ❌ Not implemented |
| FIDO2 / Hardware keys | Supported | Missing | ❌ Not implemented |
| SSH ID (biometric keys) | Supported | Missing | ❌ Not implemented |
| Real-time collaboration | Supported | Missing | ❌ Not implemented |
| Broadcast mode | Supported | Missing | ❌ Not implemented |
| AI autocomplete | Supported | Missing | ❌ Not implemented |
| Cloud sync across mobile | Supported | Desktop only | ❌ No mobile |
| SAML SSO | Supported | Missing | ❌ Not implemented |
| 2FA/MFA | Supported | Missing | ❌ Not implemented |
| SOC 2 compliance | Supported | N/A | ❌ Not applicable |
| Import/Export | Supported | Missing | ❌ Not implemented |
| Custom retention policies | Supported | Missing | ❌ Not implemented |
| Command history search | Supported | Missing | ❌ Not implemented |
| Snippet multi-execution | Supported | Missing | ❌ Not implemented |

### 🔶 Partially Implemented

| Feature | Issue |
|---------|-------|
| OAuth login | Stub only — no server implementation |
| Port forwarding | No SOCKS/HTTP proxy support |
| Known hosts | Basic TOFU only, no file import |
| Session logs | UI exists but no data collection |
| Teams | Basic CRUD, no real-time features |
| Shared vaults | Basic creation, no granular permissions |
| Settings sync | Only theme/font, not full settings |

---

## 2. Architecture Issues

### 2.1 Token Storage — CRITICAL

**Current state:** Access tokens are stored in Rust `AppState` memory (`Mutex<Option<String>>`). On app restart, tokens are lost. User must re-login every time.

**What Termius does:** Tokens stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service).

**What we need:**
- Use `tauri-plugin-store` with OS keychain backing (already a dependency)
- Store access_token, refresh_token, and token_expiry persistently
- Auto-refresh on app launch if refresh_token is valid
- Clear on explicit logout

### 2.2 Sync Protocol — CRITICAL

**Current state:** The sync protocol has several issues:

1. **Race conditions:** `syncPush` iterates tables in a fixed order (hosts → groups → vaults → ...) but doesn't handle the case where a user creates a host and vault simultaneously on two devices. The server may receive the host before the vault exists.

2. **Full download on every pull:** `SyncFull` returns ALL records across ALL tables. No incremental sync. For users with thousands of records, this is slow.

3. **Conflict resolution is server-wins:** `upsertWithTimestampCheck` uses `!incomingTime.After(existingTime)` which means equal timestamps = conflict (server wins). This can lose data.

4. **No merge for settings:** Settings is a single record per user. If two devices change settings simultaneously, one wins silently.

5. **Soft delete sync issues:** When device A deletes a record and device B updates it, the delete wins because `merge_records` checks `is_deleted` first.

### 2.3 Database Schema Mismatch

**Current state:** Client SQLite and server GORM models are "mirrored" but not identical:

- Client has `auth_type` and `key_id` columns on hosts (for local key reference)
- Server doesn't have these columns
- Server has `is_system` on vaults, client doesn't
- Server has `fingerprint` on keychain, client doesn't
- The `updated_at` format differs (ISO string vs GORM auto-time)

### 2.4 Single DB Connection

**Current state:** One `Mutex<Option<Connection>>` shared across all threads. WAL mode helps but doesn't eliminate contention.

**Impact:** Under heavy sync load, UI can freeze waiting for DB lock.

### 2.5 No Connection Pooling (Server)

**Current state:** Server uses GORM's default connection pool. For SQLite, this is fine. For PostgreSQL/MySQL in production, the pool settings are not configured.

---

## 3. Security Issues

### 3.1 SRP Implementation

**Current state:** Server has SRP-6a implementation. Client uses `libsodium-wrappers` for SRP.

**Issues:**
- SRP is not commonly used in modern apps. Most use bcrypt/scrypt + TLS.
- The SRP implementation on server side is custom — potential for subtle bugs.
- No rate limiting on SRP-specific operations (though general auth rate limiting exists).

### 3.2 JWT Security

**Current state:**
- HS256 signing (symmetric) — acceptable for single-server
- Access token expiry: 24h (too long — should be 15-60min)
- Refresh token expiry: 30 days
- No token rotation on refresh (old refresh token still works)
- In-memory revocation map (lost on server restart)

**Recommendations:**
- Use RS256 (asymmetric) if planning multi-server
- Reduce access token expiry to 15 minutes
- Implement refresh token rotation (invalidate old token on use)
- Store revoked tokens in database, not memory

### 3.3 Encryption Key Management

**Current state:** Master key is derived via Argon2id and held in memory. `clear_auth` zeros it.

**Issues:**
- Key is derived on every unlock (correct)
- But the derived key is stored in `AppState.encryption_key` as a string — not zeroized automatically
- Recovery kit is an encrypted file — good, but no way to rotate the key

### 3.4 Server Environment

**Current state:**
- `JWT_SECRET` is `change-me-in-production` in `.env`
- No HTTPS enforcement
- No HSTS headers
- CORS allows `tauri://localhost` (correct for desktop)

### 3.5 No Input Sanitization on Server

**Current state:** Server uses Gin binding tags for validation but doesn't sanitize inputs for SQL injection (GORM handles this) or XSS (not relevant for API-only server).

---

## 4. Code Quality Issues

### 4.1 Zero Tests

**Client:** No test files exist. `vitest` is configured but unused.
**Server:** No `*_test.go` files. No API tests, no sync tests, no auth tests.
**Rust:** No Rust tests.

### 4.2 Dead Code

- REST CRUD endpoints in `data.go` are no-ops (parse request but don't copy fields)
- `SRP` functions in `srp.go` are implemented but never called from auth flow
- `encrypt_field`, `decrypt_field`, `is_encrypted_field` in vault.rs are unused
- `clear_all` in db.rs is unused
- Multiple unused imports flagged by linter

### 4.3 Inconsistent Patterns

- Some Tauri commands use `String` for IDs, others use `Option<String>`
- Error handling mixes `Result<T, String>` with `Result<T, anyhow::Error>`
- Some functions use `map_err(|e| e.to_string())` everywhere, others use `?`

### 4.4 No Error Boundaries

- React error boundaries not implemented
- Tauri IPC errors silently caught in some places
- Server panics on some edge cases (though recovery middleware exists)

---

## 5. Missing Production Infrastructure

### 5.1 No CI/CD

- No GitHub Actions / GitLab CI configuration
- No automated builds, tests, or releases
- No code signing for macOS/Windows

### 5.2 No Documentation

- No README with setup instructions
- No API documentation
- No architecture docs
- No contributing guide
- No changelog

### 5.3 No Logging (Client)

- Server has structured logging (slog)
- Client has `console.log` only — no telemetry, no crash reporting

### 5.4 No Error Tracking

- No Sentry / Bugsnag / similar
- No crash reports
- No analytics

### 5.5 No Migration Strategy

- Server uses GORM AutoMigrate (runs on startup)
- No versioned migrations
- No rollback capability
- Schema changes can break production

---

## 6. Termius Feature Gap Analysis

To be a true Termius alternative, TermVault needs these features prioritized:

### P0 — Must Have (Core SSH Client)
1. ✅ SSH terminal with PTY
2. ✅ SFTP file browser
3. ✅ Port forwarding
4. ✅ Host management with groups
5. ✅ SSH key generation (Ed25519, RSA)
6. ✅ Snippets
7. ✅ Workspaces / split panes
8. ✅ End-to-end encryption
9. ✅ Cloud sync
10. ❌ **Jump host / ProxyJump support**
11. ❌ **Local terminal (non-SSH)**
12. ❌ **Import/Export (hosts, keys, settings)**

### P1 — Should Have (Productivity)
13. ❌ **Command history with search**
14. ❌ **Snippet multi-execution (run on multiple hosts)**
15. ❌ **Broadcast mode (type in all panes simultaneously)**
16. ❌ **SSH certificates support**
17. ❌ **Environment variables per host**
18. ❌ **Persistent token storage (auto-login)**
19. ❌ **Incremental sync (not full download every time)**
20. ❌ **2FA / TOTP support**

### P2 — Nice to Have (Advanced)
21. ❌ **Mosh protocol (mobile-friendly)**
22. ❌ **Telnet protocol**
23. ❌ **FIDO2 / Hardware key support**
24. ❌ **AI autocomplete**
25. ❌ **Real-time collaboration (multiplayer sessions)**
26. ❌ **Session recording and playback**
27. ❌ **Custom themes (user-created)**
28. ❌ **Mobile app (React Native)**

### P3 — Enterprise
29. ❌ **SAML SSO**
30. ❌ **SOC 2 compliance**
31. ❌ **Audit logs**
32. ❌ **Custom retention policies**
33. ❌ **Team management console**
34. ❌ **Consolidated billing**

---

## 7. Recommended Next Steps

### Phase 1: Fix Critical Issues (1-2 weeks)
1. **Persistent token storage** — Use `tauri-plugin-store` with OS keychain
2. **Auto-refresh on launch** — Check refresh token validity on app start
3. **Fix sync race conditions** — Add vector clocks or last-writer-wins with device ID
4. **Incremental sync** — Only pull records updated since last sync timestamp
5. **Add tests** — At minimum: auth flow, sync protocol, CRUD operations

### Phase 2: Core Features (2-4 weeks)
6. **Jump host support** — ProxyJump / ProxyCommand in SSH config
7. **Local terminal** — Spawn local shell without SSH
8. **Import/Export** — JSON/CSV import of hosts, keys, settings
9. **Command history** — Log all commands, store locally + sync
10. **Snippet multi-execution** — Run snippet on selected hosts

### Phase 3: Production Hardening (2-4 weeks)
11. **CI/CD pipeline** — GitHub Actions for build, test, release
12. **Code signing** — macOS notarization, Windows signing
13. **Error tracking** — Sentry or similar
14. **Documentation** — README, API docs, architecture
15. **Database migrations** — Replace AutoMigrate with versioned migrations

### Phase 4: Termius Parity (4-8 weeks)
16. **Broadcast mode**
17. **SSH certificates**
18. **2FA / TOTP**
19. **Environment variables**
20. **Mobile app (React Native)**

---

## 8. Verdict

| Dimension | Score | Notes |
|-----------|-------|-------|
| UI/UX | 8/10 | Polished, modern, feature-rich |
| Security | 7/10 | E2E encryption is solid, but token storage and SRP are concerns |
| Architecture | 6/10 | Good separation, but sync protocol needs rework |
| Code Quality | 5/10 | No tests, dead code, inconsistent patterns |
| Feature Parity | 4/10 | Missing jump host, local terminal, import/export, broadcast |
| Production Readiness | 3/10 | No CI/CD, no docs, no error tracking, no migrations |
| **Overall** | **5/10** | **Not production ready. Needs 2-3 months of focused work.** |

---

## 9. What's Actually Good

Despite the gaps, TermVault has genuine strengths:

1. **Encryption architecture** — Argon2id + ChaCha20Poly1305 with zero-knowledge server is industry-leading
2. **UI polish** — 30 themes, drag-and-drop panes, split terminals — matches Termius UX
3. **Local-first** — Works offline, syncs when connected — better than Termius cloud-only
4. **Self-hosted option** — Major differentiator from Termius
5. **Rust + Go backend** — Performance and safety where it matters
6. **Tauri v2** — Modern desktop framework with small binary size

---

## 10. Recommendation

**Do not ship yet.** Focus on:
1. Fix token persistence (users shouldn't need to re-login every restart)
2. Fix sync protocol (data loss is unacceptable)
3. Add jump host support (essential for DevOps workflows)
4. Write tests (at least 80% coverage on critical paths)
5. Add import/export (users need to migrate from Termius)

Estimated time to production-ready: **8-12 weeks** with 1-2 developers.
