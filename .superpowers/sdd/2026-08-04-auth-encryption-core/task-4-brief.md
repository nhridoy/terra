# Task 4: Server Prelogin + Register

**Files:**
- Create: `server/internal/auth/handlers.go`
- Modify: `server/cmd/termvault-server/main.go` (wire routes)

**Interfaces:**
- Produces: `auth.HandlePrelogin(db, cfg)`, `auth.HandleRegister(db, cfg)`

## Steps

1. Write `server/internal/auth/handlers_test.go` for prelogin:
- Test: Prelogin with known email → 200 {nonce, kdf, server_salt, salt_cl}
- Test: Prelogin with unknown email → 200 with random values
- Test: Prelogin with empty body → 400

2. Implement HandlePrelogin in `server/internal/auth/handlers.go`:
- Parse email from body
- Look up user by email
- If found: return user's stored nonce/kdf/server_salt/salt_cl
- If not found: generate random values (anti-enumeration)

3. Write register handler tests:
- Test: Register new user → 201 {access_token, refresh_token, user}
- Test: Register with existing email → 409
- Test: Register with same user_id (idempotent) → 200
- Test: Register with invalid body → 400/422

4. Implement HandleRegister in `server/internal/auth/handlers.go`:
- Parse body (user_id, email, password_hash, encrypted_dek, encrypted_privkey, nonce/kdf/server_salt/salt_cl)
- Check if user_id exists (idempotent) or email exists (conflict)
- Create user + personal vault via SeedPersonalVault
- Generate token pair via auth.GenerateTokenPair
- Return access_token, refresh_token, user

5. Wire routes in main.go:
```go
auth := r.Group("/api/v1/auth")
auth.POST("/prelogin", handlers.HandlePrelogin(db, cfg))
auth.POST("/register", handlers.HandleRegister(db, cfg))
```

6. Run all server tests → PASS

7. Commit
