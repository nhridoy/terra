# Task 8 Report: Resend handler — 60s cooldown, replace code

**Status:** DONE

**Commit:** `7366b15` — "feat: resend verification otp with 60s cooldown"

## What changed

### `server/internal/auth/handlers.go`
- Added `HandleResendVerification(db *gorm.DB, cfg *config.Config) gin.HandlerFunc`, placed directly after `HandleVerifyEmail` (next to the verify handler as the brief specifies).
- Behavior (verbatim from brief):
  1. Bind `{email}`; missing → 400 `VALIDATION_ERROR`.
  2. Unknown email / `AuthProvider != "password"` / already verified (`EmailVerifiedAt != nil`) → uniform 200 `{verification_required: true}` (no user enumeration).
  3. Cooldown: if a live `email_verify` row exists (`findEmailVerifyCode` succeeds) and `time.Since(existing.CreatedAt) < time.Minute` → 429 `TOO_MANY_REQUESTS`.
  4. Otherwise `issueEmailVerifyCode` (which deletes the old row and inserts a fresh OTP — replacement semantics) and `email.New(...).SendOtp(user.Email, otp)`; delivery failure is logged via `slog.Error` only, request still succeeds.
  5. 200 `{verification_required: true}`.
- No import changes needed: `log/slog`, `internal/email`, `time`, `models`, `gorm`, `config`, `gin`, `net/http` were all already imported (added by prior tasks).

### `server/internal/auth/handlers_test.go`
- Registered the route in `setupHandlerRouter` after `/verify-email`:
  ```go
  auth.POST("/resend-verification", HandleResendVerification(db, cfg))
  ```
- Added the three tests verbatim from the brief:
  - `TestResendVerification_ReplacesCode` — backdates the existing row past the cooldown, resends, asserts old OTP hash is gone, exactly 1 row remains.
  - `TestResendVerification_Cooldown` — fresh row → 429.
  - `TestResendVerification_UnknownEmail_Uniform` — unknown email → 200.

## Commands run and actual output

### Step 2 — failing tests (before implementation)
```
go test ./internal/auth/ -run "TestResendVerification" -count=1
```
```
--- FAIL: TestResendVerification_ReplacesCode (0.01s)
    handlers_test.go:1715: expected 200, got 404: 404 page not found
--- FAIL: TestResendVerification_Cooldown (0.01s)
    handlers_test.go:1745: expected 429, got 404: 404 page not found
--- FAIL: TestResendVerification_UnknownEmail_Uniform (0.01s)
    handlers_test.go:1760: expected 200 (no enumeration), got 404
FAIL
FAIL	github.com/termvault/termvault/internal/auth	4.011s
```
Matches expected: FAIL — route 404.

### Step 4 — passing tests (after implementation)
```
go test ./internal/auth/ -run "TestResendVerification" -count=1 -v
```
```
=== RUN   TestResendVerification_ReplacesCode
--- PASS: TestResendVerification_ReplacesCode (0.02s)
=== RUN   TestResendVerification_Cooldown
--- PASS: TestResendVerification_Cooldown (0.01s)
=== RUN   TestResendVerification_UnknownEmail_Uniform
--- PASS: TestResendVerification_UnknownEmail_Uniform (0.01s)
PASS
ok  	github.com/termvault/termvault/internal/auth	3.901s
```

### Full module check
```
go vet ./... && go test ./... -count=1
```
```
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	4.889s
ok  	github.com/termvault/termvault/internal/config	0.632s
ok  	github.com/termvault/termvault/internal/email	0.933s
ok  	github.com/termvault/termvault/internal/models	2.457s
```
vet clean, zero failures.

## Deviations from the brief

None. Handler code, tests, route registration, and commit message are exactly as specified in the brief. The route is registered only in the test router (`setupHandlerRouter`), per the brief's Step 3 — production routing is presumably wired by a later task.

## Notes

- `docs/superpowers/specs/2026-08-07-email-verification-design.md` had unrelated uncommitted modifications before this task; it was intentionally left unstaged (only the two brief-specified files were committed).
