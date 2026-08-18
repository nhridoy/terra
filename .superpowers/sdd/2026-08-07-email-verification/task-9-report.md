# Task 9 Report: Wire routes in main.go with rate limiting

## Status: DONE

## Changes

Modified `server/cmd/termvault-server/main.go` — added two routes after the `/recovery/prefetch` line in the `apiAuth` group:

```go
apiAuth.POST("/verify-email", auth.RateLimit(cfg.RateLimitAuth), auth.HandleVerifyEmail(db, cfg))
apiAuth.POST("/resend-verification", auth.RateLimit(cfg.RateLimitAuth), auth.HandleResendVerification(db, cfg))
```

- `HandleVerifyEmail` / `HandleResendVerification` verified present in `server/internal/auth/handlers.go:744,817`
- `auth.RateLimit` verified present in `server/internal/auth/middleware.go:98`
- `cfg.RateLimitAuth` already wired in config (no config changes needed)

## Commands + Output

### `go vet ./... && go build ./...` (workdir: server)
Exit 0, no output.

### `go test ./... -count=1` (workdir: server)
```
?   	github.com/termvault/termvault/cmd/termvault-server	[no test files]
ok  	github.com/termvault/termvault/internal/auth	5.373s
ok  	github.com/termvault/termvault/internal/config	1.306s
ok  	github.com/termvault/termvault/internal/email	1.950s
ok  	github.com/termvault/termvault/internal/models	2.757s
```
All packages pass.

## Commit

- `e9aff1b` — `feat: register verify-email and resend-verification routes` (1 file changed, 2 insertions)

Note: only `server/cmd/termvault-server/main.go` was staged; the pre-existing uncommitted change to `docs/superpowers/specs/2026-08-07-email-verification-design.md` was left untouched.

## Concerns

None.
