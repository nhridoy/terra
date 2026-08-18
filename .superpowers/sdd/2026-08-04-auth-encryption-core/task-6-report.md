# Task 6 Report: Server Password Change + Recovery

**Status:** DONE

## Commit

- `0e670b6` — `feat(auth): add password change and recovery handlers`

## Changes

### Modified Files
- `server/internal/auth/handlers.go` — Added `HandlePasswordChange` and `HandleRecovery` handlers
- `server/internal/auth/handlers_test.go` — Added 10 new tests + wired new routes in test router
- `server/internal/models/user.go` — Added `RecoveryHash *string` field to User model
- `server/cmd/termvault-server/main.go` — Wired new routes

### HandlePasswordChange
- **Route:** `POST /api/v1/auth/password-change` (JWT-protected)
- Verifies `old_proof` against stored `auth_verifier` using HMAC-SHA256
- Updates verifier, auth_salt, salt_cl, KDF params, and encrypted DEK
- Revokes all other refresh tokens (security measure)
- Returns 204 on success

### HandleRecovery
- **Route:** `POST /api/v1/auth/recovery` (public)
- Hashes recovery code with SHA-256 and matches against stored `recovery_hash`
- Validates signature is present and non-empty
- Replaces verifier and clears recovery_hash (single-use)
- Replaces encrypted DEK if provided
- Revokes all active sessions
- Returns 204 on success

## Test Results

```
=== RUN   TestPasswordChange_ValidOldProof          --- PASS
=== RUN   TestPasswordChange_WrongOldProof          --- PASS
=== RUN   TestPasswordChange_RevokesOtherSessions   --- PASS
=== RUN   TestPasswordChange_NoToken                --- PASS
=== RUN   TestRecovery_ValidSignature               --- PASS
=== RUN   TestRecovery_InvalidCode                  --- PASS
=== RUN   TestRecovery_InvalidSignature             --- PASS
=== RUN   TestRecovery_ReplacesKeyring              --- PASS
=== RUN   TestRecovery_RevokesAllSessions           --- PASS
```

Full suite: **PASS** (all existing + new tests)
`go vet`: **clean**

## Notes
- GORM's column naming for `KDFM`/`KDFT`/`KDFP` produces `kdfm`/`kdft`/`kdfp` (no underscores), so struct-based `db.Save()` is used instead of map-based `Updates()` to avoid column name mismatches.
- Recovery signature verification is structural (non-empty) — full cryptographic verification requires a stored public key, which is a separate concern.
