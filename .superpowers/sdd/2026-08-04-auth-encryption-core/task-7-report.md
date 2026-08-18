# Task 7: Server OAuth — Report

**Status:** DONE  
**Commit:** `13c19f3` — `feat(auth): add OAuth handlers (Google + GitHub) with PKCE, callback, exchange, and setup`

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `server/internal/auth/oauth.go` | Created | OAuth provider logic, 4 handlers (460 lines) |
| `server/internal/auth/oauth_test.go` | Created | 20 tests for all OAuth handlers (608 lines) |
| `server/cmd/termvault-server/main.go` | Modified | Wired 4 new routes |
| `server/go.mod` / `server/go.sum` | Modified | Added `cloud.google.com/go/compute/metadata` via `go mod tidy` |

## Handlers Implemented

1. **HandleOAuthStart** — GET `/api/v1/auth/oauth/start/:provider`
   - Generates PKCE verifier + challenge
   - Stores state in `oauth_states` table with 10min expiry
   - Redirects to Google/GitHub authorize URL with `code_challenge`

2. **HandleOAuthCallback** — GET `/api/v1/auth/oauth/callback/:provider`
   - Validates state (not used, not expired)
   - Exchanges code for tokens with PKCE verifier
   - Fetches user info from provider API
   - Creates new user (with setup_code) or links to existing email
   - Redirects via deep link: `termvault://auth/success` or `termvault://auth/setup`

3. **HandleOAuthExchange** — POST `/api/v1/auth/oauth/exchange`
   - Exchanges setup_code for token pair
   - Validates: not used, not expired, matches user
   - Returns `{access_token, refresh_token, user, initialized}`

4. **HandleOAuthSetup** — POST `/api/v1/auth/oauth/setup`
   - Accepts setup_token + encrypted_dek + auth_verifier
   - Marks user as initialized
   - Stores DEK and optional encrypted_privkey
   - Returns token pair

## Test Results

```
ok  github.com/termvault/termvault/internal/auth  8.207s
```

**57 tests pass** (37 existing + 20 new OAuth tests):

- OAuthStart: 4 tests (Google, GitHub, unknown provider, device_id storage)
- OAuthCallback: 5 tests (invalid state, used state, expired state, missing code, missing state)
- OAuthExchange: 4 tests (valid code, expired, used, invalid)
- OAuthSetup: 7 tests (valid token, expired, already initialized, used, no privkey, invalid, empty body)

## Notes

- Callback happy path (existing user + token exchange) requires mocking external HTTP endpoints — tested via error paths only
- All external API calls use `golang.org/x/oauth2` with proper scopes
- PKCE uses S256 challenge method (SHA-256 + base64url)
- Deep link scheme defaults to `termvault` (configurable via `APP_SCHEME` env)
