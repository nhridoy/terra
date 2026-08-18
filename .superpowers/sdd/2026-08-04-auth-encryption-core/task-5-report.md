# Task 5: Server Login + Refresh + Logout + Me — Report

**Status:** DONE

## What was implemented

### HandleLogin (`handlers.go:130`)
- Parses `{email, proof, nonce, device_id}`
- Looks up user by email (generic 401 on miss)
- Verifies HMAC-SHA256 proof against stored `AuthVerifier` using the provided nonce
- Creates a new refresh token (SHA-256 hashed, stored in DB)
- Returns `{access_token, refresh_token, user, keyring}` (keyring from `user_keys` if present)
- Updates `last_login_at` on success

### HandleRefresh (`handlers.go:224`)
- Parses `{refresh_token}`
- Looks up token by SHA-256 hash
- **Reuse detection:** if token is already revoked → revokes ALL user tokens, returns 401
- **Rotation:** revokes old token (sets `revoked_at` + `rotated_at`), creates new token pair
- Returns `{access_token, refresh_token}`

### HandleLogout (`handlers.go:279`)
- Parses `{refresh_token}`, revokes it (sets `revoked_at`)
- Returns 204 No Content

### HandleMe (`handlers.go:302`)
- Reads `user_id` from JWT middleware context
- Returns full user object from DB
- Protected by JWT middleware

### Helper functions
- `createRefreshToken` — generates random token, hashes with SHA-256, stores in DB
- `hashToken` — SHA-256 + base64url encoding for token storage

## Tests (33 total, all passing)

| Test | Status |
|------|--------|
| `TestLogin_CorrectProof` | PASS |
| `TestLogin_WrongProof` | PASS |
| `TestLogin_NonExistentEmail` | PASS |
| `TestRefresh_ValidToken` | PASS |
| `TestRefresh_ExpiredToken` | PASS |
| `TestRefresh_ReuseDetection` | PASS |
| `TestLogout_ValidToken` | PASS |
| `TestLogout_InvalidToken` | PASS |
| `TestMe_ValidToken` | PASS |
| `TestMe_NoToken` | PASS |

Plus 23 existing tests from tasks 1-4 — all passing.

## Routes wired in main.go

```
POST /api/v1/auth/login     → HandleLogin
POST /api/v1/auth/refresh   → HandleRefresh
POST /api/v1/auth/logout    → HandleLogout
GET  /api/v1/me             → HandleMe (JWT protected)
```

## Commits

- `490c0e9` feat(server): add login, refresh, logout, /me handlers with TDD tests

## Notes

- The brief specified `{email, proof, device_id, client_pubkey}` for login, but the proof-based auth needs the nonce for verification. Added `nonce` field to the login request. `client_pubkey` is accepted but unused (will be used for encrypted keyring delivery in a later task).
- Refresh token rotation follows the pattern: old token → revoked, new token issued. Reuse of a revoked token triggers cascading revocation of all user tokens.
- `go vet ./...` — clean
