# Task 7: Server OAuth

**Files:**
- Create: `server/internal/auth/oauth.go`
- Modify: `server/internal/auth/handlers.go`

**Interfaces:**
- Produces: `auth.HandleOAuthStart(db, cfg)`, `auth.HandleOAuthCallback(db, cfg)`, `auth.HandleOAuthExchange(db, cfg)`, `auth.HandleOAuthSetup(db, cfg)`

## Steps

1. Write OAuth start handler tests:
- Test: Start with valid provider → 302 to provider
- Test: Start with unknown provider → 400

2. Implement HandleOAuthStart (Google + GitHub):
- Generate state, store in oauth_states table with expiry
- Redirect to provider's authorize URL with PKCE code_challenge

3. Write callback handler tests:
- Test: Callback with valid code+state → 302 to termvault://
- Test: Callback with invalid state → 302 to termvault://auth/error
- Test: Callback with new user → creates user + setup_token

4. Implement HandleOAuthCallback:
- Exchange code for tokens with provider
- Get user info (email, name, avatar)
- If user exists: generate token pair, redirect to termvault://auth/success
- If new user: create user + setup_token, redirect to termvault://auth/setup

5. Write exchange handler tests:
- Test: Exchange with valid code → 200 {tokens, user, initialized}
- Test: Exchange with expired code → 401
- Test: Exchange with used code → 401

6. Implement HandleOAuthExchange:
- Exchange setup_code for tokens (for first-time social login)

7. Write setup handler tests:
- Test: Setup with valid setup_token → 200 {tokens}
- Test: Setup with expired token → 401
- Test: Setup when already initialized → 409

8. Implement HandleOAuthSetup:
- Accept encrypted_dek, encrypted_privkey from client
- Update user, mark initialized
- Return token pair

9. Wire routes in main.go, run tests → PASS

10. Commit
