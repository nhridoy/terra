# Task 2 Report — Models: `email_verified_at` + `Attempts`

**Status:** DONE
**Commit:** `a616b360049dfe44b0afae0f0f854c455ffbe62c` (`feat: add email_verified_at and auth_codes attempts columns`)

## What changed

- `server/internal/models/user.go` — added field after `LastLoginAt`:
  ```go
  EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
  ```
  (gofmt re-aligned the struct's column spacing; semantics unchanged.)
- `server/internal/models/auth_code.go` — added field after `ExpiresAt`:
  ```go
  Attempts  int        `gorm:"not null;default:0" json:"-"`
  ```
  (`time` was already imported; no import changes needed.)
- `server/internal/models/models_test.go` — added `TestEmailVerificationColumns` which checks both columns exist after AutoMigrate.

## Test commands and actual output

**Step 2 — failing test** (`go test ./internal/models/ -run TestEmailVerificationColumns -count=1 -v`):
```
=== RUN   TestEmailVerificationColumns
    models_test.go:26: users.email_verified_at column missing after AutoMigrate
    models_test.go:29: auth_codes.attempts column missing after AutoMigrate
--- FAIL: TestEmailVerificationColumns (0.02s)
FAIL
FAIL	github.com/termvault/termvault/internal/models	1.752s
```

**Step 4 — passing test** (`go test ./internal/models/ -count=1 -v`):
```
=== RUN   TestEmailVerificationColumns
--- PASS: TestEmailVerificationColumns (0.02s)
=== RUN   TestAutoMigrate
    models_test.go:44: tables created: [users user_keys sqlite_sequence refresh_tokens oauth_states auth_codes vaults records]
--- PASS: TestAutoMigrate (0.01s)
=== RUN   TestSeedPersonalVault
--- PASS: TestSeedPersonalVault (0.01s)
=== RUN   TestUserModel
--- PASS: TestUserModel (0.01s)
PASS
ok  	github.com/termvault/termvault/internal/models	2.631s
```

**Full module** (`go vet ./... && go test ./... -count=1`):
```
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	5.088s
ok  	github.com/termvault/termvault/internal/config	0.604s
ok  	github.com/termvault/termvault/internal/models	1.450s
```

## Commit

- Message: `feat: add email_verified_at and auth_codes attempts columns`
- Files: `server/internal/models/user.go`, `server/internal/models/auth_code.go`, `server/internal/models/models_test.go` (exactly per brief)
- Hash: `a616b360049dfe44b0afae0f0f854c455ffbe62c`

## Deviations from brief

1. **Helper name:** brief's snippet said `setupDB(t)`, but the existing helper is `setupTestDB(t)` (models_test.go:11). Used `setupTestDB` per the brief's own instruction ("reuse existing helper ... if it differs, use that name").
2. **Added `AutoMigrate(db)` call inside the new test.** The brief's verbatim snippet never migrates, so on the fresh `:memory:` DB no tables would exist and the test would fail even after implementation. All existing tests in the file call `AutoMigrate` after `setupTestDB`, so this matches file convention and makes the test actually validate the implementation.
3. **Ran `gofmt -w`** on `user.go` and `models_test.go` (struct field alignment). Note: `internal/models/refresh_token.go` was already unformatted before this task (untouched by me).

## Notes

- An unrelated working-tree modification exists (`docs/superpowers/specs/2026-08-07-email-verification-design.md`) — not committed, per brief's explicit `git add` list.
- Fields match the plan interfaces exactly: `models.User.EmailVerifiedAt *time.Time` (json `email_verified_at,omitempty`); `models.AuthCode.Attempts int` (json `-`).
