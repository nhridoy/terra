# Task 10 Report: OAuth users auto-verified

## Status: DONE

## Changes

**`server/internal/auth/oauth.go`** — the OAuth callback create/link block was extracted into a `linkOrCreateOAuthUser(db, provider, ui)` helper (same lookup order, same DB ops, same three redirect reasons preserved via sentinel errors `errOAuthLinkFailed` / `errOAuthUserCreateFailed` / `errOAuthVaultSeedFailed` and an `errors.Is` switch in the handler). Within the helper, both paths now set `EmailVerifiedAt`:

- Email-link branch: `user.EmailVerifiedAt = &now` (`now := time.Now()` introduced before the struct mutation).
- New-user creation struct: `EmailVerifiedAt: &now` added; `CreatedAt`/`UpdatedAt` now reuse the same `now`.

**`server/internal/auth/oauth_test.go`** — two new tests using the file's existing `setupTestDB` helper:

- `TestOAuthCallback_CreatesVerifiedUser` — create path: user row has `EmailVerifiedAt != nil` (asserted on the returned struct and on a fresh DB reload).
- `TestOAuthCallback_LinksExistingEmailVerified` — link path: pre-existing email account linked to a provider gets `EmailVerifiedAt` set (returned struct + DB reload).

## Deviation from brief (rationale)

The brief's Step 1 assumed a callback-level harness that creates users. None exists: every existing `TestOAuthCallback_*` test stops at error paths (missing/used/expired state, missing code) before the user-creation code. Reaching creation requires `oauthCfg.Exchange()` → provider token endpoint and `fetchGoogleUserInfo`/`fetchGitHubUserInfo` → provider userinfo endpoint, with hardcoded URLs (no injection seam). Mocking those external provider HTTP calls is explicitly forbidden by the task instructions ("DO NOT create a test that requires mocking external provider HTTP calls unless the existing file already does that" — it doesn't).

Therefore the create/link logic was extracted into `linkOrCreateOAuthUser` so it can be exercised directly with the file's existing `setupTestDB` helper (the task description's "write a focused test using the same setup helpers" option). Handler behavior is byte-for-byte equivalent: same provider_sub/email lookup order, same `link_failed`/`create_user_failed`/`vault_seed_failed` redirect messages, same `SeedPersonalVault` call, `user` still flows into the `Initialized`/token branches below.

TDD sequence honored: (1) behavior-identical extraction committed-to-working-tree, existing tests green; (2) new tests written, ran → FAIL on `EmailVerifiedAt == nil` (both create and link); (3) added the two `EmailVerifiedAt` lines; (4) `TestOAuth` run → PASS.

## Commands + Output

### `go vet ./internal/auth/ && go test ./internal/auth/ -count=1` (refactor-only step)
Exit 0: `ok github.com/termvault/termvault/internal/auth 5.716s`

### `go test ./internal/auth/ -run "TestOAuthCallback_CreatesVerifiedUser|TestOAuthCallback_LinksExistingEmailVerified" -count=1` (pre-implementation)
Expected FAIL, confirmed:
```
oauth_test.go:377: new OAuth user should be email-verified at creation
oauth_test.go:385: created user row should have email_verified_at set
--- FAIL: TestOAuthCallback_CreatesVerifiedUser (0.02s)
oauth_test.go:410: email-linked OAuth user should be email-verified at link time
oauth_test.go:418: linked user row should have email_verified_at set
--- FAIL: TestOAuthCallback_LinksExistingEmailVerified (0.01s)
FAIL
```

### `go test ./internal/auth/ -run "TestOAuth" -count=1` (post-implementation)
```
ok github.com/termvault/termvault/internal/auth 5.665s
```

### `go vet ./... && go test ./... -count=1` (full module)
Exit 0:
```
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	5.420s
ok  	github.com/termvault/termvault/internal/config	1.323s
ok  	github.com/termvault/termvault/internal/email	1.941s
ok  	github.com/termvault/termvault/internal/models	3.047s
```

## Commit

- `6f71bcb` — `feat: oauth users auto-verified` (2 files changed, 129 insertions, 45 deletions)

Only `server/internal/auth/oauth.go` and `server/internal/auth/oauth_test.go` were staged. The pre-existing uncommitted change to `docs/superpowers/specs/2026-08-07-email-verification-design.md` (noted since Task 6) was left untouched.

## Concerns

- gofmt realigned `oauthSetupRequest` field names and the `salt_cl` line in `HandleKeyring` (whitespace-only noise, same class as Task 2's deferred minor).
- Link-branch `now` is captured before `db.Save`; fine since GORM omits `UpdatedAt` only when set — `user.EmailVerifiedAt = &now` is persisted because `db.Save` writes all fields.
- No `TestOAuthCallback_*`-style coverage of the three failure redirects (link/create/vault-seed) — pre-existing gap, unchanged by this task.
