### Task 9: Wire routes in main.go with rate limiting

**Files:**
- Modify: `server/cmd/termvault-server/main.go:47-58`

- [ ] **Step 1: Add the routes**

```go
apiAuth.POST("/verify-email", auth.RateLimit(cfg.RateLimitAuth), auth.HandleVerifyEmail(db, cfg))
apiAuth.POST("/resend-verification", auth.RateLimit(cfg.RateLimitAuth), auth.HandleResendVerification(db, cfg))
```

(Place after the `/recovery/prefetch` line.)

- [ ] **Step 2: Verify build**

Run: `go vet ./... && go build ./...`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/cmd/termvault-server/main.go
git commit -m "feat: register verify-email and resend-verification routes"
```

---
