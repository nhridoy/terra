# Task 3: Server Middleware — Report

## Status: DONE

## What Was Implemented

All four middleware functions in `server/internal/auth/middleware.go`:

1. **`RequestID()`** — Generates UUID, sets in gin context (`request_id`) and response header (`X-Request-Id`)
2. **`JWTMiddleware(cfg)`** — Extracts `Bearer` token from `Authorization` header, verifies via `auth.VerifyAccessToken`, sets `user_id` (uuid.UUID) in context. Returns 401 with appropriate error codes for missing/malformed/expired tokens.
3. **`RateLimit(max)`** — Per-IP sliding window rate limiter (1-minute window). In-memory with mutex-protected map. Returns 429 `RATE_LIMITED` when exceeded.
4. **`CORS()`** — Sets standard CORS headers (`Access-Control-Allow-Origin`, `-Methods`, `-Headers`, `-Expose-Headers`, `-Max-Age`). Handles OPTIONS preflight with 204 No Content.

## Tests

15 middleware tests in `server/internal/auth/middleware_test.go`:

| Test | Description |
|------|-------------|
| `TestRequestID_AddsToContextAndHeader` | Verifies UUID in context and X-Request-Id header |
| `TestRequestID_UniquePerRequest` | Verifies unique IDs across requests |
| `TestJWTMiddleware_MissingAuthorization` | 401 when no Authorization header |
| `TestJWTMiddleware_InvalidToken` | 401 for garbage token |
| `TestJWTMiddleware_ExpiredToken` | 401 for expired token |
| `TestJWTMiddleware_ValidToken` | 200 + user_id in context for valid token |
| `TestJWTMiddleware_MalformedHeader` | 401 for non-Bearer scheme |
| `TestRateLimit_AllowsWithinLimit` | 200 for requests under limit |
| `TestRateLimit_RejectsOverLimit` | 429 when limit exceeded |
| `TestRateLimit_DifferentIPsIndependent` | Separate IPs have separate limits |
| `TestCORS_SetsHeaders` | Verifies CORS headers present |
| `TestCORS_PreflightRequest` | OPTIONS returns 204 with CORS headers |

All 21 auth package tests pass (including jwt, responses, verifier tests). `go vet` clean.

## Files

- `server/internal/auth/middleware.go` — 153 lines (4 middleware functions)
- `server/internal/auth/middleware_test.go` — 299 lines (15 tests)

## Self-Review

- All 4 middleware from task brief implemented
- All 4 required test cases covered (plus extras for malformed header, unique IDs, independent IPs, preflight)
- Follows existing patterns: gin.HandlerFunc, gin.H error responses matching `auth.Error()` envelope
- Uses existing `VerifyAccessToken` and `config.Config`
- `go vet` passes, no warnings
- No concerns — implementation is clean and complete
