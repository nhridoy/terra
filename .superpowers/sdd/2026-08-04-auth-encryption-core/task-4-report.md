# Task 4: Server Prelogin + Register — Report

**Status:** DONE
**Commit:** `8fc0027` — feat(server): add prelogin + register handlers with TDD tests

## What I Implemented

### HandlePrelogin (`server/internal/auth/handlers.go:32`)
- Parses `email` from JSON body (returns 400 if missing)
- Looks up user by email
- **Known email:** returns user's stored `nonce`, `kdf` (m/t/p), `server_salt`, `salt_cl`
- **Unknown email:** returns random values of the same shape (anti-enumeration)

### HandleRegister (`server/internal/auth/handlers.go:74`)
- Parses `user_id`, `email`, `password_hash`, `kdf_m/t/p`, `server_salt`, `salt_cl` from body
- Validates `user_id` is a valid UUID
- **Idempotent:** if `user_id` already exists → 200 with fresh token pair
- **Conflict:** if `email` exists with different user_id → 409
- Creates user + seeds personal vault via `models.SeedPersonalVault`
- Generates JWT token pair via `auth.GenerateTokenPair`
- Returns `access_token`, `refresh_token`, `user` (201)

### Routes wired (`server/cmd/termvault-server/main.go`)
```go
apiAuth := r.Group("/api/v1/auth")
apiAuth.POST("/prelogin", auth.HandlePrelogin(db, cfg))
apiAuth.POST("/register", auth.HandleRegister(db, cfg))
```

## Test Results

```
PASS TestPrelogin_KnownEmail (0.02s)
PASS TestPrelogin_UnknownEmail (0.01s)
PASS TestPrelogin_EmptyBody (0.01s)
PASS TestRegister_NewUser (0.01s)
PASS TestRegister_ExistingEmail (0.01s)
PASS TestRegister_Idempotent (0.01s)
PASS TestRegister_InvalidBody (0.01s)
ok   github.com/termvault/termvault/internal/auth
```

All existing tests also pass (`go test ./...` clean, `go vet ./...` clean).

## TDD Evidence

- **RED:** Tests written first referencing `HandlePrelogin`/`HandleRegister` → build failed (undefined)
- **GREEN:** Handler implementation added → all 6 tests pass
- **REFACTOR:** Fixed `GenerateTokenPair` return value unpacking in idempotent and create paths

## Files Changed

| File | Action |
|------|--------|
| `server/internal/auth/handlers.go` | Created — 172 lines |
| `server/internal/auth/handlers_test.go` | Created — 185 lines |
| `server/cmd/termvault-server/main.go` | Modified — added auth import + route wiring |

## Self-Review

- **Completeness:** All 6 brief requirements implemented and tested
- **Quality:** Handler signatures match brief (`auth.HandlePrelogin(db, cfg)`, `auth.HandleRegister(db, cfg)`). Response format follows existing `Success()`/`Error()` helpers
- **Discipline:** No overbuilding — no refresh token DB persistence yet (that's a separate task), no encrypted DEK/privkey storage (UserKey records — separate task)
- **Edge cases:** Empty body (400), bad UUID (400), idempotent register (200), email conflict (409)

## Concerns

None.
