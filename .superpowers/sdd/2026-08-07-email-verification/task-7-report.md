# Task 7 Report — Verify handler: OTP validation + token issuance

**Status: DONE_WITH_CONCERNS**
**Commit: `7a35664` (feat: verify email otp endpoint with attempts cap)**

## What changed

### `server/internal/auth/handlers.go`
- Added `verifyEmailRequest` struct (`email` required, `otp` required, `device_id`) next to the other request structs.
- Added `HandleVerifyEmail(db *gorm.DB, cfg *config.Config) gin.HandlerFunc` before `hashToken`. Flow:
  1. Bind JSON → 400 `VALIDATION_ERROR` on failure.
  2. Look up user by email → 401 `UNAUTHORIZED` if unknown (does not reveal account existence).
  3. 400 `ALREADY_VERIFIED` if `email_verified_at` is set.
  4. `findEmailVerifyCode` → 400 `INVALID_VERIFICATION_CODE` if missing/expired.
  5. Constant-time SHA-256 comparison of the submitted OTP against the stored hash; on mismatch increments `Attempts`; on the 5th failure (`>= maxOtpAttempts`) deletes the code row and returns 400.
  6. On success: updates `email_verified_at` + `last_login_at`, deletes the code row, mints refresh token (with `req.DeviceID`) + access token pair, returns 200 `{ access_token, refresh_token, user, keyring }` via `fetchKeyring(db, user.ID)`.

### `server/internal/auth/handlers_test.go`
- Added helpers `seedUnverifiedUser` and `makeVerifyEmailRequest` (brief's `verifyEmailRequest` — renamed, see deviations) near the other test helpers.
- Added 5 tests: `TestVerifyEmail_Success`, `TestVerifyEmail_WrongCode_ExhaustsAttempts`, `TestVerifyEmail_ExpiredCode`, `TestVerifyEmail_UnknownEmail`, `TestVerifyEmail_AlreadyVerified`.
- Registered `auth.POST("/verify-email", HandleVerifyEmail(db, cfg))` in `setupHandlerRouter` after `/register`.

Global constraint honored: tokens are only minted in the same successful call that marks the account verified.

## Commands run + actual output

**Step 2 (fail first), after tests-only added:**
```
> go test ./internal/auth/ -run "TestVerifyEmail" -count=1
internal\auth\handlers_test.go:122:54: undefined: httptest.Request      <- brief typo (helper return type)
```
After fixing the return type (see deviations):
```
--- FAIL: TestVerifyEmail_Success (0.02s)
    handlers_test.go:590: expected 200, got 404: 404 page not found
--- FAIL: TestVerifyEmail_WrongCode_ExhaustsAttempts ... got 404
--- FAIL: TestVerifyEmail_ExpiredCode ... got 404
--- FAIL: TestVerifyEmail_UnknownEmail ... got 404
--- FAIL: TestVerifyEmail_AlreadyVerified ... got 404
FAIL
```
(All 404 — route not yet registered / handler undefined, as the brief predicted.)

**Step 4 (pass) final run:**
```
> go test ./internal/auth/ -run "TestVerifyEmail" -count=1
ok  	github.com/termvault/termvault/internal/auth	3.921s
```

**Full module verification:**
```
> go vet ./... && go test ./... -count=1
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	5.388s
ok  	github.com/termvault/termvault/internal/config	0.710s
ok  	github.com/termvault/termvault/internal/email	1.826s
ok  	github.com/termvault/termvault/internal/models	2.756s
```
Also ran `gofmt -l` (one file was flagged, fixed, see deviations) and `gofmt -w`; both files now clean.

## Deviations from the brief (all required for the tests to compile/pass)

1. **Test helper return type** — brief: `func verifyEmailRequest(email, otp string) *httptest.Request`. `httptest.NewRequest` returns `*http.Request`; `*httptest.Request` does not exist → build failure `undefined: httptest.Request`. Changed return type to `*http.Request`.

2. **Name collision** — the brief defines both the request struct `verifyEmailRequest` (handlers.go) and a test helper function `verifyEmailRequest` (handlers_test.go) in the same package → `verifyEmailRequest redeclared in this block`. Renamed the test helper to `makeVerifyEmailRequest` (definition + 6 call sites). All test call sites otherwise verbatim.

3. **OTP comparison encoding bug** — brief: `ConstantTimeCompare(hash[:], []byte(code.CodeHash))` compares raw SHA-256 bytes against the *base64-encoded* hash stored by `issueEmailVerifyCode` (email_verify.go:40, `base64.RawStdEncoding.EncodeToString(hash[:])`). Raw bytes vs base64 chars can never match → even the correct OTP returned `INVALID_VERIFICATION_CODE` (observed in the failing run: `TestVerifyEmail_Success ... expected 200, got 400`). Fixed by base64-encoding the computed hash before the constant-time comparison:
   ```go
   hash := sha256.Sum256([]byte(req.Otp))
   hashB64 := base64.RawStdEncoding.EncodeToString(hash[:])
   if !ConstantTimeCompare([]byte(hashB64), []byte(code.CodeHash)) {
   ```
   `ConstantTimeCompare` signature verified in verifier.go — `(a []byte, b []byte)`; the comparison remains constant-time on equal-length base64 strings.

4. **`seedUnverifiedUser` keyring seeding** — the brief's helper creates no `UserKey` rows, but `TestVerifyEmail_Success` asserts `resp.Data.Keyring != nil`; `fetchKeyring` returns `nil` for an empty keyring → test failed with `expected keyring in verify response`. In production this state is unreachable (`HandleRegister` stores the keyring via `seedKeyring` before issuing the verification code), so the helper was augmented to seed the 3 keyring rows (`dek_wrapped_by_kek`, `dek_wrapped_by_recovery`, `private_key_wrapped_by_dek`), matching the real register-with-verification precondition. Handler and test assertions kept verbatim.

5. **gofmt formatting** — the brief's inline anonymous struct in `TestVerifyEmail_AlreadyVerified` (`Error struct{ Code string ... }`) was reformatted by `gofmt -w` (expanded to multi-line), as required for the repo's Go formatting hygiene. Cosmetic only.

## Concerns
- Deviations 3 and 4 indicate the brief's verification code and test helper were not written against the actual storage format (`issueEmailVerifyCode` base64-encodes) and the actual `fetchKeyring` nil behavior. The final behavior matches the brief's intent (constant-time OTP check, 5-attempt cap with row deletion, tokens only on successful verification) and the design's production flow; all tests pass.
- Pre-existing uncommitted change `docs/superpowers/specs/2026-08-07-email-verification-design.md` was left untouched (not part of this task's commit).
