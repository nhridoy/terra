# Task 3: Server Middleware

**Files:**
- Create: `server/internal/auth/middleware.go`

**Interfaces:**
- Produces: `auth.JWTMiddleware(cfg)`, `auth.RequestID()`, `auth.RateLimit(max)`, `auth.CORS()`

## Steps

1. Write `server/internal/auth/middleware_test.go`:
- Test: RequestID adds ID to context and sets X-Request-Id header
- Test: JWTMiddleware rejects missing Authorization header
- Test: JWTMiddleware rejects invalid/expired token
- Test: JWTMiddleware passes valid token and sets user_id in context

2. Implement `server/internal/auth/middleware.go`:
- `RequestID()` → middleware that generates UUID, sets in context + X-Request-Id header
- `JWTMiddleware(cfg)` → middleware that extracts Bearer token, verifies via auth.VerifyAccessToken, sets user_id in context
- `RateLimit(max)` → simple per-IP rate limiter (in-memory, sliding window)
- `CORS()` → middleware returning CORS headers (configurable origins)

3. Run all server tests → PASS

4. Commit
