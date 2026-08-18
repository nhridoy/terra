# Task 5: Server Login + Refresh + Logout + Me

**Files:**
- Modify: `server/internal/auth/handlers.go`

**Interfaces:**
- Produces: `auth.HandleLogin(db, cfg)`, `auth.HandleRefresh(db, cfg)`, `auth.HandleLogout(db, cfg)`, `auth.HandleMe(db)`

## Steps

1. Write login handler tests:
- Test: Login with correct proof → 200 {access_token, refresh_token, user, keyring}
- Test: Login with wrong proof → 401
- Test: Login with non-existent email → 401 (generic)
- Test: Rate limit → 429

2. Implement HandleLogin:
- Parse {email, proof, device_id, client_pubkey}
- Look up user by email
- Verify proof against stored verifier (HMAC-SHA256)
- Create refresh token
- Return access_token, refresh_token, user, encrypted_keyring_blob

3. Write refresh handler tests:
- Test: Refresh with valid token → 200 {new tokens}
- Test: Refresh with expired token → 401
- Test: Refresh with reused token → 401 + revoke all

4. Implement HandleRefresh:
- Parse {refresh_token}
- Verify token exists and is not revoked
- Create new token pair, revoke old refresh token (rotation)
- On reuse detection: revoke all user tokens

5. Write logout handler tests:
- Test: Logout → 204
- Test: Logout with invalid token → 401

6. Implement HandleLogout:
- Revoke current refresh token

7. Write /me handler tests:
- Test: GET /me with valid token → 200 {id, email, name, initialized, auth_provider, created_at}
- Test: GET /me without token → 401

8. Implement HandleMe:
- Return user info from context (set by JWT middleware)

9. Wire routes in main.go under protected group, run tests → PASS

10. Commit
