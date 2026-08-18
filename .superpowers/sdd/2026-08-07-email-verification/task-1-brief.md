### Task 1: Config — verification toggle + SMTP settings

**Files:**
- Modify: `server/internal/config/config.go:12-30` (Config struct), `:38-66` (Load)
- Test: `server/internal/config/config_test.go`

**Interfaces:**
- Produces: `Config.RequireEmailVerification bool`, `Config.SMTPHost string`, `Config.SMTPPort int`, `Config.SMTPUsername string`, `Config.SMTPPassword string`, `Config.SMTPFrom string`; helper `parseBoolEnv(key string, fallback bool) bool` in package `config`.

- [ ] **Step 1: Write the failing tests**

```go
// in TestLoadDefaults, after existing assertions:
if cfg.RequireEmailVerification {
    t.Errorf("expected email verification off by default")
}
if cfg.SMTPPort != 587 {
    t.Errorf("expected default SMTP port 587, got %d", cfg.SMTPPort)
}

// new test func
func TestLoadEmailVerificationToggle(t *testing.T) {
    cases := []struct {
        val  string
        want bool
    }{
        {"true", true}, {"TRUE", true}, {"1", true}, {"yes", true},
        {"false", false}, {"0", false}, {"", false}, {"banana", false},
    }
    for _, c := range cases {
        os.Setenv("REQUIRE_EMAIL_VERIFICATION", c.val)
        cfg := Load()
        if cfg.RequireEmailVerification != c.want {
            t.Errorf("REQUIRE_EMAIL_VERIFICATION=%q: got %v want %v", c.val, cfg.RequireEmailVerification, c.want)
        }
    }
    os.Unsetenv("REQUIRE_EMAIL_VERIFICATION")
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/config/ -run "TestLoadDefaults|TestLoadEmailVerificationToggle" -count=1`
Expected: FAIL — `RequireEmailVerification` and `SMTPPort` don't exist yet.

- [ ] **Step 3: Implement**

In `config.go`, add to struct:

```go
RequireEmailVerification bool
SMTPHost                string
SMTPPort                int
SMTPUsername            string
SMTPPassword            string
SMTPFrom                string
```

In `Load()`, after the existing `getEnv` defaults:

```go
cfg.RequireEmailVerification = parseBoolEnv("REQUIRE_EMAIL_VERIFICATION", false)
cfg.SMTPHost = os.Getenv("SMTP_HOST")
cfg.SMTPPort = 587
if v := os.Getenv("SMTP_PORT"); v != "" {
    if n, err := parseIntSafe(v, 587); err == nil {
        cfg.SMTPPort = n
    }
}
cfg.SMTPUsername = os.Getenv("SMTP_USERNAME")
cfg.SMTPPassword = os.Getenv("SMTP_PASSWORD")
cfg.SMTPFrom = os.Getenv("SMTP_FROM")
```

Add at the bottom of the file:

```go
func parseBoolEnv(key string, fallback bool) bool {
    v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
    switch v {
    case "true", "1", "yes":
        return true
    case "false", "0", "no":
        return false
    }
    return fallback
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/config/ -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/config/config.go server/internal/config/config_test.go
git commit -m "feat: parse REQUIRE_EMAIL_VERIFICATION and SMTP settings"
```

---
