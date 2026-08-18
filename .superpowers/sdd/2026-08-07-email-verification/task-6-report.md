# Task 6 Report: Login gate — 403 VERIFICATION_REQUIRED

## Status: DONE

## What changed

### `server/internal/auth/handlers.go` — `HandleLogin`
Inserted the verification gate immediately after the `ConstantTimeCompare` proof-success check and before `now := time.Now()` (the `last_login_at` update):

```go
if cfg.RequireEmailVerification && user.EmailVerifiedAt == nil {
    c.JSON(http.StatusForbidden, gin.H{"error": gin.H{
        "code":       "VERIFICATION_REQUIRED",
        "message":    "verify your email",
        "email":      user.Email,
        "request_id": c.GetString("request_id"),
    }})
    return
}
```

The gate returns before `last_login_at` is updated and before `createRefreshToken` is called, so neither side effect occurs for unverified users. The email sits inside the `error` object per the global constraint (client's apiFetch surfaces `json.error`). Uses `c.JSON` directly (not the `Error` helper) to match the brief's exact body; includes `request_id` consistent with the helper-style payloads used elsewhere.

### `server/internal/auth/handlers_test.go`
Appended two tests verbatim from the brief:

- `TestLogin_Unverified_ReturnsVerificationRequired` — seeds unverified user `gate@example.com`, valid proof, expects 403 with `error.code == VERIFICATION_REQUIRED`, `error.email == gate@example.com`, `last_login_at` still nil, and zero `models.RefreshToken` rows for the user.
- `TestLogin_Verified_Succeeds` — seeds user `ok@example.com`, sets `email_verified_at`, expects 200.

No name collisions with existing `TestLogin_CorrectProof` / `TestLogin_WrongProof` / `TestLogin_NonExistentEmail`.

## Test commands and actual output

### Step 2 — confirm new tests fail (before implementation)
Command: `go test ./internal/auth/ -run "TestLogin_Unverified|TestLogin_Verified" -count=1 -v`

```
=== RUN   TestLogin_Unverified_ReturnsVerificationRequired
    handlers_test.go:1495: expected 403, got 200: {"data":{"access_token":"eyJ...","keyring":null,"refresh_token":"na2bb/...","user":{...}},"meta":{"request_id":""}}
--- FAIL: TestLogin_Unverified_ReturnsVerificationRequired (0.02s)
=== RUN   TestLogin_Verified_Succeeds
--- PASS: TestLogin_Verified_Succeeds (0.01s)
FAIL
FAIL	github.com/termvault/termvault/internal/auth	4.131s
```

As expected: unverified login returned 200, verified login passed trivially.

### Step 4 — confirm tests pass (after implementation)
Command: `go test ./internal/auth/ -run "TestLogin_Unverified|TestLogin_Verified" -count=1 -v`

```
=== RUN   TestLogin_Unverified_ReturnsVerificationRequired
--- PASS: TestLogin_Unverified_ReturnsVerificationRequired (0.02s)
=== RUN   TestLogin_Verified_Succeeds
--- PASS: TestLogin_Verified_Succeeds (0.01s)
PASS
ok  	github.com/termvault/termvault/internal/auth	5.038s
```

### Full module — `go vet ./... && go test ./... -count=1`

```
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	5.399s
ok  	github.com/termvault/termvault/internal/config	0.647s
ok  	github.com/termvault/termvault/internal/email	0.957s
ok  	github.com/termvault/termvault/internal/models	2.803s
```

Vet clean, all packages pass.

## Commit

```
e1a9918 feat: block login for unverified accounts with 403 VERIFICATION_REQUIRED
```

Only `server/internal/auth/handlers.go` and `server/internal/auth/handlers_test.go` were staged (85 insertions, 2 files), exactly as the brief's commit command specifies. The pre-existing unstaged change to `docs/superpowers/specs/2026-08-07-email-verification-design.md` was left untouched.

## Deviations from the brief

None. Code, tests, test commands, and commit message all match the brief verbatim. (Windows-only note: git printed LF→CRLF warnings on stage; harmless, line endings unchanged.)
