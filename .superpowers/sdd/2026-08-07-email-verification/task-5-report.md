# Task 5 Report: Register gate — verification_required response, no tokens

**Status:** DONE

## What changed

### `server/internal/auth/handlers_test.go`
- Added `testConfigWithVerification()` helper — `testConfig()` with `RequireEmailVerification = true`.
- Added `registerRequestPayload(email, userID)` helper (verbatim from brief).
- Added `TestRegister_VerificationRequired_NoTokens` — asserts 201, `verification_required: true`, no `access_token`/`refresh_token` in response, user unverified in DB, exactly 1 `AuthCode` row with `email_verify` purpose.
- Added `TestRegister_VerificationOff_ReturnsTokens` — asserts 201 with access token and no `verification_required` flag.

### `server/internal/auth/handlers.go` (`HandleRegister`)
- Imports: added `"log/slog"` and `"github.com/termvault/termvault/internal/email"`.
- Idempotent branch (existing user by ID): when `cfg.RequireEmailVerification && existing.EmailVerifiedAt == nil`, issues OTP via `issueEmailVerifyCode`, sends via `email.New(...).SendOtp(...)` (send failure only logged, not fatal), returns 201 `{ verification_required: true, user }` with NO tokens. Otherwise falls through to original token path unchanged.
- Tail (after `models.SeedPersonalVault`): when `cfg.RequireEmailVerification`, same OTP flow for the new user, returns 201 `{ verification_required: true, user }` with NO tokens. Otherwise original token path unchanged.

## Test commands and actual output

Step 2 (fail first) — `go test ./internal/auth/ -run "TestRegister_Verification" -count=1`:

```
--- FAIL: TestRegister_VerificationRequired_NoTokens (0.02s)
    handlers_test.go:458: expected verification_required true
FAIL
FAIL	github.com/termvault/termvault/internal/auth	3.989s
```

(The `VerificationOff` test passed immediately since that path was already correct.)

Step 4 (pass) — same command:

```
ok  	github.com/termvault/termvault/internal/auth	5.039s
```

Full module — `go vet ./... && go test ./... -count=1` (run twice: once before gofmt, once after — both green):

```
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	5.714s
ok  	github.com/termvault/termvault/internal/config	1.330s
ok  	github.com/termvault/termvault/internal/email	2.042s
ok  	github.com/termvault/termvault/internal/models	2.851s
```

## Commit

`8c5a38f4c228754c31c10c1d94a905acbe0dc0a6` — `feat: gate register behind email verification when enabled` (2 files, +148/−14)

## Deviations from the brief

1. **gofmt fixes**: after editing, `gofmt -l` flagged both files. Ran `gofmt -w`, which also corrected two pre-existing alignment issues (the `registerRequest` struct field alignment in handlers.go and a `gin.H` map alignment in `TestRecovery_ReplacesKeyring`). No semantic changes.
2. **Indent style in `registerRequestPayload` keyring map**: used gofmt-normalized alignment; functionally identical to the brief's snippet.

## Notes

- `email.Sender.SendOtp` returns nil when SMTP is unconfigured (logs the code via slog instead), so tests exercise the full register gate without a live SMTP server.
- Unrelated modified file `docs/superpowers/specs/2026-08-07-email-verification-design.md` was left uncommitted (not part of this task).

---

# Fix round (reviewer findings)

## Finding 1 (important) — duplicated verification block → extracted helper

**Change** (`server/internal/auth/handlers.go`): added `respondVerificationRequired(c *gin.Context, db *gorm.DB, cfg *config.Config, user *models.User)` — takes the user struct (carries `.ID` and `.Email`), issues the OTP via `issueEmailVerifyCode(db, user.ID)`, 500s with the single-source error string `"failed to create verification code"`, builds the sender, `SendOtp`, logs failures, returns 201 `{ verification_required: true, user }`. Both call sites now collapse to one line:
- idempotent branch: `if cfg.RequireEmailVerification && existing.EmailVerifiedAt == nil { respondVerificationRequired(c, db, cfg, &existing); return }`
- tail: `if cfg.RequireEmailVerification { respondVerificationRequired(c, db, cfg, &user); return }`

Net: −26/+18 lines in handlers.go.

## Finding 2 (minor) — idempotent re-issue + verified-user paths now tested

**Change** (`server/internal/auth/handlers_test.go`), two new tests:
- `TestRegister_VerificationRequired_Reissue` — register with gate on, re-POST same `user_id` → still 201, `verification_required: true`, no tokens, exactly 1 `AuthCode` row (`issueEmailVerifyCode` deletes-then-inserts, so count stays 1).
- `TestRegister_VerifiedUser_ReturnsTokens` — pre-seeded user with `EmailVerifiedAt` set, gate on, register with same `user_id` → 200 with non-empty access + refresh tokens, no `verification_required` flag (idempotent branch falls through to the token path).

## Finding 3 (minor) — refresh_token assertion added

**Change** (`server/internal/auth/handlers_test.go`): `TestRegister_VerificationOff_ReturnsTokens` response struct now includes `RefreshToken` and asserts it is non-empty.

## Commands run (actual output)

Covering tests:

```
ok  	github.com/termvault/termvault/internal/auth	4.033s
```

Full module:

```
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	5.802s
ok  	github.com/termvault/termvault/internal/config	0.705s
ok  	github.com/termvault/termvault/internal/email	2.195s
ok  	github.com/termvault/termvault/internal/models	3.247s
```

Verbose confirmation all four gate tests run and pass (the reviewer's `-run "TestRegister_Verification"` pattern doesn't match `TestRegister_VerifiedUser_ReturnsTokens`; ran `-run "TestRegister"`):

```
=== RUN   TestRegister_VerificationRequired_NoTokens   --- PASS
=== RUN   TestRegister_VerificationOff_ReturnsTokens   --- PASS
=== RUN   TestRegister_VerificationRequired_Reissue    --- PASS
=== RUN   TestRegister_VerifiedUser_ReturnsTokens      --- PASS
ok  	github.com/termvault/termvault/internal/auth	4.301s
```

`gofmt -l` clean on both files before running.

## Commits

- `1464de6376990672b791cc12901a1bf535f9a29d` — `refactor: extract register verification helper`
- `b9f78aedd2d96bb2947961261bfb0caefa9b7bb5` — `test: cover register verification re-issue and verified-user paths`

## Deviations

None. Committed as two commits (refactor, then tests) per the reviewer's suggested split. The unrelated modified design doc remains uncommitted.
