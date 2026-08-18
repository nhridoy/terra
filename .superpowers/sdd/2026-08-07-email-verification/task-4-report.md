# Task 4 Report: OTP issue/lookup helpers

**Status:** DONE
**Commit:** `9881b8a` — "feat: otp issue and lookup helpers"
**Date:** 2026-08-07

## What changed

Created two files in `server/internal/auth/`:

1. **`email_verify_test.go`** — test file verbatim from the brief (Step 1):
   - `setupVerifyDB` helper (local replica of the `setupTestDB` pattern, as the brief requires — not reused from `handlers_test.go` to avoid cross-file coupling)
   - `TestGenerateOtp_IsSixDigits` — 50 iterations of 6-digit, all-digit OTPs
   - `TestIssueEmailVerifyCode_ReplacesOldRow` — re-issue deletes the old row (exactly 1 row remains) and the stored `CodeHash` is not plaintext
   - `TestFindEmailVerifyCode_None` — no row → `gorm.ErrRecordNotFound`

2. **`email_verify.go`** — implementation verbatim from the brief (Step 3):
   - `const emailVerifyPurpose = "email_verify"`
   - `const otpTTL = 15 * time.Minute`
   - `const maxOtpAttempts = 5`
   - `generateOtp()` — 6 decimal digits via `crypto/rand.Int`, zero-padded with `%06d`
   - `issueEmailVerifyCode(db, userID)` — deletes all prior `email_verify` rows for the user, inserts a fresh row with `sha256.Sum256` + `base64.RawStdEncoding` hash, `ExpiresAt = now + otpTTL`, returns plaintext OTP
   - `findEmailVerifyCode(db, userID)` — most recent `email_verify` row (no expiry filter; caller decides), returns `gorm.ErrRecordNotFound` when absent

## Test commands and actual output

### Step 2 — failing tests (before implementation)

```
> go test ./internal/auth/ -run "TestGenerateOtp|TestIssueEmailVerifyCode|TestFindEmailVerifyCode" -count=1
# github.com/termvault/termvault/internal/auth [github.com/termvault/termvault/internal/auth.test]
internal\auth\email_verify_test.go:26:15: undefined: generateOtp
internal\auth\email_verify_test.go:44:16: undefined: issueEmailVerifyCode
internal\auth\email_verify_test.go:48:17: undefined: issueEmailVerifyCode
internal\auth\email_verify_test.go:56:76: undefined: emailVerifyPurpose
internal\auth\email_verify_test.go:60:15: undefined: findEmailVerifyCode
internal\auth\email_verify_test.go:71:12: undefined: findEmailVerifyCode
FAIL	github.com/termvault/termvault/internal/auth [build failed]
FAIL
```

Failed as expected (compile error — functions undefined).

### Step 4 — passing tests (after implementation)

```
> go test ./internal/auth/ -run "TestGenerateOtp|TestIssueEmailVerifyCode|TestFindEmailVerifyCode" -count=1
ok  	github.com/termvault/termvault/internal/auth	5.553s
```

### Full module verification

```
> go vet ./... && go test ./... -count=1
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	5.305s
ok  	github.com/termvault/termvault/internal/config	0.648s
ok  	github.com/termvault/termvault/internal/email	1.123s
ok  	github.com/termvault/termvault/internal/models	2.814s
```

`go vet` clean; all packages pass.

## Commit

```
9881b8a feat: otp issue and lookup helpers
 2 files changed, 135 insertions(+)
 create mode 100644 server/internal/auth/email_verify.go
 create mode 100644 server/internal/auth/email_verify_test.go
```

Only the two intended files were staged. A pre-existing unstaged modification to `docs/superpowers/specs/2026-08-07-email-verification-design.md` was left untouched.

## Deviations from the brief

- **None in substance.** Code is verbatim from the brief.
- Cosmetic only: brief code samples use 4-space indentation; files were written with Go standard tabs (gofmt style), which is semantically identical. The code block was also given a trailing period/newline difference (none — files match byte-for-byte semantics).
- The brief's note that `hashToken` exists in `handlers.go` but the implementation uses inline `sha256.Sum256` — followed the brief verbatim (inline hash), per instructions.

## Concerns

- `issueEmailVerifyCode` uses `sha256.Sum256` inline rather than the existing `hashToken` helper in `handlers.go` — brief explicitly specified this; potential dedup opportunity noted for a future task.
- `maxOtpAttempts` and `otpTTL` are declared but not yet consumed by any code in this task (they'll be used by the verify handler in a later task). No unused-code issue since package-level constants don't trigger compile errors.
