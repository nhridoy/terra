# Email Verification for Password Signups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate new email/password signups behind a 6-digit OTP emailed to the user, toggleable via one env var (off by default), with no tokens ever minted for unverified accounts.

**Architecture:** Server-side only gating — `users.email_verified_at` column, one-time 6-digit OTPs stored hashed in the existing `auth_codes` table (`Purpose="email_verify"`, delete+insert on re-issue), delivered via a new stdlib `net/smtp` package with console-log fallback when SMTP is unconfigured. Client shows an OTP entry panel (auth store `pendingVerificationEmail`) reached from register (verification_required) or login (403 VERIFICATION_REQUIRED). OAuth users are auto-verified.

**Tech Stack:** Go (gin, GORM, stdlib net/smtp), React + Zustand (client), Vitest, Biome, Tauri.

**Spec:** `docs/superpowers/specs/2026-08-07-email-verification-design.md`

## Global Constraints

- `REQUIRE_EMAIL_VERIFICATION` env: strict bool — accepted `true`, `1`, `yes` (case-insensitive); unset/anything else = **off**.
- Verification applies ONLY to `AuthProvider = "password"` users. OAuth users are exempt (verified at creation).
- Unverified password accounts must NEVER receive access/refresh tokens from any handler.
- OTP: 6 decimal digits, 15-minute expiry, sha256-hashed at rest, constant-time compare, max 5 attempts (5th failure deletes the row), one live `email_verify` row per user (re-issue = delete old row + insert fresh).
- Resend cooldown: 60s per user (live row `CreatedAt` within 60s → 429). Resend/verify endpoints ride `RATE_LIMIT_AUTH`.
- Client: `pnpm biome check .` (double quotes, no semicolons), `pnpm vitest`, `tsc`. Server: `go vet ./... && go test ./... -count=1`. Tauri: `cargo check`, `cargo test`.
- No new Go module dependencies (`net/smtp` only).

---

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

### Task 2: Models — `email_verified_at` + `Attempts`

**Files:**
- Modify: `server/internal/models/user.go:9-27`
- Modify: `server/internal/models/auth_code.go:9-18`
- Test: `server/internal/models/models_test.go`

**Interfaces:**
- Produces: `models.User.EmailVerifiedAt *time.Time` (json `email_verified_at,omitempty`); `models.AuthCode.Attempts int` (json `-`).

- [ ] **Step 1: Write the failing test**

```go
// in models_test.go, new test func
func TestEmailVerificationColumns(t *testing.T) {
    db := setupDB(t) // reuse existing helper from models_test.go
    if !db.Migrator().HasColumn("users", "email_verified_at") {
        t.Errorf("users.email_verified_at column missing after AutoMigrate")
    }
    if !db.Migrator().HasColumn("auth_codes", "attempts") {
        t.Errorf("auth_codes.attempts column missing after AutoMigrate")
    }
}
```

(Check the existing helper name in `models_test.go` — if it differs, use that name.)

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/models/ -run TestEmailVerificationColumns -count=1`
Expected: FAIL — columns missing.

- [ ] **Step 3: Implement**

In `user.go`:

```go
EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
```

(Add after `LastLoginAt`.)

In `auth_code.go`:

```go
Attempts   int        `gorm:"not null;default:0" json:"-"`
```

(Add after `ExpiresAt`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/models/ -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/models/user.go server/internal/models/auth_code.go server/internal/models/models_test.go
git commit -m "feat: add email_verified_at and auth_codes attempts columns"
```

---

### Task 3: Email package — SMTP sender with console fallback

**Files:**
- Create: `server/internal/email/sender.go`
- Create: `server/internal/email/sender_test.go`

**Interfaces:**
- Produces:
  - `type Sender struct { Host string; Port int; Username, Password, From string }`
  - `func New(host string, port int, username, password, from string) *Sender`
  - `func (s *Sender) Enabled() bool` — true iff `Host != ""`.
  - `func (s *Sender) SendOtp(to, code string) error` — disabled: logs `slog.Info("verification otp", "email", to, "code", code)` and returns nil; enabled: `net/smtp.SendMail` with `smtp.PlainAuth` (only when Username set), plain-text + minimal HTML body "Your TermVault verification code is: <code>".

- [ ] **Step 1: Write the failing tests**

```go
package email

import "testing"

func TestSendOtp_DisabledLogsAndSucceeds(t *testing.T) {
    s := New("", 587, "", "", "")
    if s.Enabled() {
        t.Fatal("expected disabled sender when host empty")
    }
    if err := s.SendOtp("user@example.com", "123456"); err != nil {
        t.Fatalf("disabled sender should not error: %v", err)
    }
}

func TestNew_DefaultPort(t *testing.T) {
    s := New("smtp.example.com", 587, "u", "p", "no-reply@example.com")
    if !s.Enabled() {
        t.Fatal("expected enabled sender when host set")
    }
    if s.Port != 587 || s.Username != "u" || s.From != "no-reply@example.com" {
        t.Fatalf("sender fields not preserved: %+v", s)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/email/ -count=1`
Expected: FAIL — package `email` does not exist / functions undefined.

- [ ] **Step 3: Implement**

```go
package email

import (
    "fmt"
    "log/slog"
    "net/smtp"
)

type Sender struct {
    Host     string
    Port     int
    Username string
    Password string
    From     string
}

func New(host string, port int, username, password, from string) *Sender {
    return &Sender{Host: host, Port: port, Username: username, Password: password, From: from}
}

func (s *Sender) Enabled() bool {
    return s.Host != ""
}

func (s *Sender) SendOtp(to, code string) error {
    subject := "Your TermVault verification code"
    plain := fmt.Sprintf("Your TermVault verification code is: %s\n\nIt expires in 15 minutes.", code)
    html := fmt.Sprintf("<p>Your TermVault verification code is:</p><p style=\"font-size:24px;font-weight:bold\">%s</p><p>It expires in 15 minutes.</p>", code)

    if !s.Enabled() {
        slog.Info("verification otp", "email", to, "code", code)
        return nil
    }

    msg := []byte("From: " + s.From + "\r\n" +
        "To: " + to + "\r\n" +
        "Subject: " + subject + "\r\n" +
        "MIME-Version: 1.0\r\n" +
        "Content-Type: text/html; charset=UTF-8\r\n" +
        "\r\n" +
        html)

    addr := fmt.Sprintf("%s:%d", s.Host, s.Port)
    var auth smtp.Auth
    if s.Username != "" {
        auth = smtp.PlainAuth("", s.Username, s.Password, s.Host)
    }
    if err := smtp.SendMail(addr, auth, s.From, []string{to}, msg); err != nil {
        return fmt.Errorf("send verification email: %w", err)
    }
    return nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/email/ -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/email/
git commit -m "feat: smtp email sender with console fallback"
```

---

### Task 4: OTP issue/lookup helpers

**Files:**
- Create: `server/internal/auth/email_verify.go`
- Test: `server/internal/auth/email_verify_test.go`

**Interfaces:**
- Consumes: `models.AuthCode` (with `Attempts`), `models.AutoMigrate`, `setupTestDB` pattern from `handlers_test.go` (replicate locally in this test file).
- Produces (package `auth`):
  - `const emailVerifyPurpose = "email_verify"`
  - `const otpTTL = 15 * time.Minute`
  - `const maxOtpAttempts = 5`
  - `func generateOtp() (string, error)` — 6 decimal digits via `crypto/rand.Int`
  - `func issueEmailVerifyCode(db *gorm.DB, userID uuid.UUID) (string, error)` — `DELETE` all `email_verify` rows for user, insert fresh hashed row (hash = `hashToken(otp)`), returns plaintext OTP
  - `func findEmailVerifyCode(db *gorm.DB, userID uuid.UUID) (*models.AuthCode, error)` — most recent `email_verify` row for user (no expiry filter — caller decides), `ErrNotFound` style: return `gorm.ErrRecordNotFound` from `db.First`

- [ ] **Step 1: Write the failing tests**

```go
package auth

import (
    "testing"

    gormsqlite "github.com/glebarez/sqlite"
    "github.com/google/uuid"
    "github.com/termvault/termvault/internal/models"
    "gorm.io/gorm"
)

func setupVerifyDB(t *testing.T) *gorm.DB {
    t.Helper()
    db, err := gorm.Open(gormsqlite.Open(":memory:"), &gorm.Config{})
    if err != nil {
        t.Fatalf("open test db: %v", err)
    }
    if err := models.AutoMigrate(db); err != nil {
        t.Fatalf("migrate: %v", err)
    }
    return db
}

func TestGenerateOtp_IsSixDigits(t *testing.T) {
    for i := 0; i < 50; i++ {
        otp, err := generateOtp()
        if err != nil {
            t.Fatal(err)
        }
        if len(otp) != 6 {
            t.Fatalf("expected 6 digits, got %q", otp)
        }
        for _, ch := range otp {
            if ch < '0' || ch > '9' {
                t.Fatalf("non-digit in otp %q", otp)
            }
        }
    }
}

func TestIssueEmailVerifyCode_ReplacesOldRow(t *testing.T) {
    db := setupVerifyDB(t)
    userID := uuid.New()
    first, err := issueEmailVerifyCode(db, userID)
    if err != nil {
        t.Fatal(err)
    }
    second, err := issueEmailVerifyCode(db, userID)
    if err != nil {
        t.Fatal(err)
    }
    if first == second {
        t.Fatal("expected different otps")
    }
    var count int64
    db.Model(&models.AuthCode{}).Where("user_id = ? AND purpose = ?", userID, emailVerifyPurpose).Count(&count)
    if count != 1 {
        t.Fatalf("expected exactly 1 row after re-issue, got %d", count)
    }
    code, err := findEmailVerifyCode(db, userID)
    if err != nil {
        t.Fatal(err)
    }
    if code.CodeHash == second {
        t.Fatal("expected hashed code, got plaintext")
    }
}

func TestFindEmailVerifyCode_None(t *testing.T) {
    db := setupVerifyDB(t)
    _, err := findEmailVerifyCode(db, uuid.New())
    if err != gorm.ErrRecordNotFound {
        t.Fatalf("expected ErrRecordNotFound, got %v", err)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/auth/ -run "TestGenerateOtp|TestIssueEmailVerifyCode|TestFindEmailVerifyCode" -count=1`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Implement**

```go
package auth

import (
    "crypto/rand"
    "crypto/sha256"
    "encoding/base64"
    "fmt"
    "math/big"
    "time"

    "github.com/google/uuid"
    "github.com/termvault/termvault/internal/models"
    "gorm.io/gorm"
)

const emailVerifyPurpose = "email_verify"
const otpTTL = 15 * time.Minute
const maxOtpAttempts = 5

func generateOtp() (string, error) {
    n, err := rand.Int(rand.Reader, big.NewInt(1000000))
    if err != nil {
        return "", fmt.Errorf("generate otp: %w", err)
    }
    return fmt.Sprintf("%06d", n.Int64()), nil
}

func issueEmailVerifyCode(db *gorm.DB, userID uuid.UUID) (string, error) {
    if err := db.Where("user_id = ? AND purpose = ?", userID, emailVerifyPurpose).
        Delete(&models.AuthCode{}).Error; err != nil {
        return "", fmt.Errorf("clear old verification codes: %w", err)
    }

    otp, err := generateOtp()
    if err != nil {
        return "", err
    }
    hash := sha256.Sum256([]byte(otp))
    code := models.AuthCode{
        CodeHash:  base64.RawStdEncoding.EncodeToString(hash[:]),
        Purpose:   emailVerifyPurpose,
        UserID:    userID,
        DeviceID:  "",
        ExpiresAt: time.Now().Add(otpTTL),
    }
    if err := db.Create(&code).Error; err != nil {
        return "", fmt.Errorf("store verification code: %w", err)
    }
    return otp, nil
}

func findEmailVerifyCode(db *gorm.DB, userID uuid.UUID) (*models.AuthCode, error) {
    var code models.AuthCode
    err := db.Where("user_id = ? AND purpose = ?", userID, emailVerifyPurpose).
        Order("created_at DESC").First(&code).Error
    if err != nil {
        return nil, err
    }
    return &code, nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/auth/ -run "TestGenerateOtp|TestIssueEmailVerifyCode|TestFindEmailVerifyCode" -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/auth/email_verify.go server/internal/auth/email_verify_test.go
git commit -m "feat: otp issue and lookup helpers"
```

---

### Task 5: Register gate — verification_required response, no tokens

**Files:**
- Modify: `server/internal/auth/handlers.go` (`HandleRegister`, lines 89-198)
- Modify: `server/internal/auth/oauth.go` is NOT touched here (Task 10)
- Test: `server/internal/auth/handlers_test.go`

**Interfaces:**
- Consumes: `emailVerifyPurpose`, `issueEmailVerifyCode`, `email.New`, `config.Config.RequireEmailVerification`
- Produces: register response variant `{ verification_required: true, user: User }` (201, no token fields) when gate on.

- [ ] **Step 1: Write the failing tests**

In `handlers_test.go`, add a helper + tests. Note `testConfig()` needs `RequireEmailVerification` settable — build config locally in the test:

```go
func testConfigWithVerification() *config.Config {
    cfg := testConfig()
    cfg.RequireEmailVerification = true
    return cfg
}

func registerRequestPayload(email, userID string) map[string]interface{} {
    return map[string]interface{}{
        "user_id":      userID,
        "email":        email,
        "full_name":    email,
        "password_hash": base64.RawStdEncoding.EncodeToString([]byte("verifier-bytes")),
        "keyring": map[string]string{
            "dek_wrapped_by_kek":        "kek",
            "dek_wrapped_by_recovery":   "rec",
            "private_key_wrapped_by_dek": "pk",
        },
        "kdf":         map[string]int{"m": 32768, "t": 2, "p": 1},
        "server_salt": "server-salt",
        "salt_cl":     "salt-cl",
    }
}

func TestRegister_VerificationRequired_NoTokens(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())

    body := registerRequestPayload("verify@example.com", uuid.New().String())
    raw, _ := json.Marshal(body)
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(raw))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)

    if w.Code != http.StatusCreated {
        t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
    }
    var resp struct {
        Data struct {
            VerificationRequired bool `json:"verification_required"`
            AccessToken          string `json:"access_token"`
            RefreshToken         string `json:"refresh_token"`
        } `json:"data"`
    }
    if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
        t.Fatal(err)
    }
    if !resp.Data.VerificationRequired {
        t.Fatal("expected verification_required true")
    }
    if resp.Data.AccessToken != "" || resp.Data.RefreshToken != "" {
        t.Fatal("expected no tokens in register response")
    }

    var user models.User
    if err := db.Where("email = ?", "verify@example.com").First(&user).Error; err != nil {
        t.Fatal(err)
    }
    if user.EmailVerifiedAt != nil {
        t.Fatal("expected user unverified")
    }
    var codeCount int64
    db.Model(&models.AuthCode{}).Where("user_id = ? AND purpose = ?", user.ID, emailVerifyPurpose).Count(&codeCount)
    if codeCount != 1 {
        t.Fatalf("expected 1 verification code, got %d", codeCount)
    }
}

func TestRegister_VerificationOff_ReturnsTokens(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfig())

    body := registerRequestPayload("plain@example.com", uuid.New().String())
    raw, _ := json.Marshal(body)
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(raw))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)

    if w.Code != http.StatusCreated {
        t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
    }
    var resp struct {
        Data struct {
            VerificationRequired bool   `json:"verification_required"`
            AccessToken          string `json:"access_token"`
        } `json:"data"`
    }
    if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
        t.Fatal(err)
    }
    if resp.Data.AccessToken == "" {
        t.Fatal("expected access token when verification off")
    }
    if resp.Data.VerificationRequired {
        t.Fatal("expected no verification_required flag")
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/auth/ -run "TestRegister_Verification" -count=1`
Expected: FAIL — both register paths currently return tokens.

- [ ] **Step 3: Implement**

In `handlers.go` top imports add:

```go
"github.com/termvault/termvault/internal/email"
```

In `HandleRegister`, replace the idempotent branch (existing-user early return at lines 103-121):

```go
if db.Where("id = ?", userID).First(&existing).Error == nil {
    if cfg.RequireEmailVerification && existing.EmailVerifiedAt == nil {
        otp, err := issueEmailVerifyCode(db, userID)
        if err != nil {
            Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create verification code")
            return
        }
        sender := email.New(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPFrom)
        if err := sender.SendOtp(existing.Email, otp); err != nil {
            slog.Error("failed to send verification otp", "email", existing.Email, "error", err)
        }
        Success(c, http.StatusCreated, gin.H{
            "verification_required": true,
            "user":                  existing,
        })
        return
    }
    rt, err := createRefreshToken(db, userID, "", cfg)
    // ... existing code unchanged from here ...
```

Add `"log/slog"` to imports.

Then replace the tail of `HandleRegister` (after `models.SeedPersonalVault`, currently lines 180-196):

```go
if cfg.RequireEmailVerification {
    otp, err := issueEmailVerifyCode(db, userID)
    if err != nil {
        Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create verification code")
        return
    }
    sender := email.New(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPFrom)
    if err := sender.SendOtp(user.Email, otp); err != nil {
        slog.Error("failed to send verification otp", "email", user.Email, "error", err)
    }
    Success(c, http.StatusCreated, gin.H{
        "verification_required": true,
        "user":                  user,
    })
    return
}

rt, err := createRefreshToken(db, userID, "", cfg)
if err != nil {
    Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create refresh token")
    return
}

at, _, err := GenerateTokenPair(userID, "", cfg)
if err != nil {
    Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to generate tokens")
    return
}

Success(c, http.StatusCreated, gin.H{
    "access_token":  at,
    "refresh_token": rt,
    "user":          user,
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/auth/ -run "TestRegister_Verification" -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/auth/handlers.go server/internal/auth/handlers_test.go
git commit -m "feat: gate register behind email verification when enabled"
```

---

### Task 6: Login gate — 403 VERIFICATION_REQUIRED

**Files:**
- Modify: `server/internal/auth/handlers.go` (`HandleLogin`, after proof check ~line 247)
- Test: `server/internal/auth/handlers_test.go`

**Interfaces:**
- Produces: 403 response `{ "error": { "code": "VERIFICATION_REQUIRED", "message": "verify your email", "email": "<email>" } }`.

- [ ] **Step 1: Write the failing tests**

```go
func TestLogin_Unverified_ReturnsVerificationRequired(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())

    userID, verifier := seedUserWithVerifier(t, db, "gate@example.com")
    var user models.User
    db.First(&user, "id = ?", userID)

    nonce := []byte("nonce-bytes")
    nonceB64 := base64.RawStdEncoding.EncodeToString(nonce)
    proof := base64.RawStdEncoding.EncodeToString(GenerateProof(verifier, nonce))

    raw, _ := json.Marshal(map[string]string{
        "email": "gate@example.com", "proof": proof, "nonce": nonceB64,
    })
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(raw))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)

    if w.Code != http.StatusForbidden {
        t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
    }
    var resp struct {
        Error struct {
            Code  string `json:"code"`
            Email string `json:"email"`
        } `json:"error"`
    }
    if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
        t.Fatal(err)
    }
    if resp.Error.Code != "VERIFICATION_REQUIRED" {
        t.Fatalf("expected VERIFICATION_REQUIRED, got %s", resp.Error.Code)
    }
    if resp.Error.Email != "gate@example.com" {
        t.Fatalf("expected email in error payload, got %s", resp.Error.Email)
    }

    db.First(&user, "id = ?", userID)
    if user.LastLoginAt != nil {
        t.Fatal("last_login_at must not be updated for unverified user")
    }
    var rtCount int64
    db.Model(&models.RefreshToken{}).Where("user_id = ?", userID).Count(&rtCount)
    if rtCount != 0 {
        t.Fatalf("no refresh token should be created, got %d", rtCount)
    }
}

func TestLogin_Verified_Succeeds(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())

    userID, verifier := seedUserWithVerifier(t, db, "ok@example.com")
    now := time.Now()
    db.Model(&models.User{}).Where("id = ?", userID).Update("email_verified_at", &now)

    nonce := []byte("nonce-bytes")
    proof := base64.RawStdEncoding.EncodeToString(GenerateProof(verifier, nonce))
    raw, _ := json.Marshal(map[string]string{
        "email": "ok@example.com",
        "proof": proof,
        "nonce": base64.RawStdEncoding.EncodeToString(nonce),
    })
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(raw))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/auth/ -run "TestLogin_Unverified|TestLogin_Verified" -count=1`
Expected: FAIL — `TestLogin_Unverified` gets 200, `TestLogin_Verified` passes trivially.

- [ ] **Step 3: Implement**

In `HandleLogin`, immediately after the `ConstantTimeCompare` success check and before `now := time.Now()`:

```go
if cfg.RequireEmailVerification && user.EmailVerifiedAt == nil {
    c.JSON(http.StatusForbidden, gin.H{"error": gin.H{
        "code":       "VERIFICATION_REQUIRED",
        "message":    "verify your email",
        "email":      user.Email,
        "request_id": c.GetString("request_id"),
    }})
    return
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/auth/ -run "TestLogin_Unverified|TestLogin_Verified" -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/auth/handlers.go server/internal/auth/handlers_test.go
git commit -m "feat: block login for unverified accounts with 403 VERIFICATION_REQUIRED"
```

---

### Task 7: Verify handler — OTP validation + token issuance

**Files:**
- Modify: `server/internal/auth/handlers.go`
- Test: `server/internal/auth/handlers_test.go`

**Interfaces:**
- Consumes: `findEmailVerifyCode`, `maxOtpAttempts`, `hashToken` (exists, handlers.go:701)
- Produces:
  - `type verifyEmailRequest struct { Email string \`json:"email" binding:"required"\`; Otp string \`json:"otp" binding:"required"\`; DeviceID string \`json:"device_id"\` }`
  - `HandleVerifyEmail(db *gorm.DB, cfg *config.Config) gin.HandlerFunc`
  - Response 200: `{ access_token, refresh_token, user, keyring }` (keyring via existing `fetchKeyring(db, user.ID)`)
  - Failures: 400 `INVALID_VERIFICATION_CODE` (bad/invalid/expired code, attempts exhausted), 400 `ALREADY_VERIFIED` (user already verified), 401 `UNAUTHORIZED` (unknown email — do not reveal)

- [ ] **Step 1: Write the failing tests**

Add a test helper:

```go
func seedUnverifiedUser(t *testing.T, db *gorm.DB, email string) (uuid.UUID, string) {
    t.Helper()
    userID, _ := seedUserWithVerifier(t, db, email)
    otp, err := issueEmailVerifyCode(db, userID)
    if err != nil {
        t.Fatal(err)
    }
    return userID, otp
}
```

```go
func verifyEmailRequest(email, otp string) *httptest.Request {
    raw, _ := json.Marshal(map[string]string{"email": email, "otp": otp, "device_id": "dev-1"})
    req := httptest.NewRequest("POST", "/api/v1/auth/verify-email", bytes.NewReader(raw))
    req.Header.Set("Content-Type", "application/json")
    return req
}

func TestVerifyEmail_Success(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())
    userID, otp := seedUnverifiedUser(t, db, "verify-ok@example.com")

    w := httptest.NewRecorder()
    r.ServeHTTP(w, verifyEmailRequest("verify-ok@example.com", otp))

    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
    }
    var resp struct {
        Data struct {
            AccessToken  string `json:"access_token"`
            RefreshToken string `json:"refresh_token"`
            Keyring      map[string]string `json:"keyring"`
        } `json:"data"`
    }
    if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
        t.Fatal(err)
    }
    if resp.Data.AccessToken == "" || resp.Data.RefreshToken == "" {
        t.Fatal("expected tokens after verification")
    }
    if resp.Data.Keyring == nil {
        t.Fatal("expected keyring in verify response")
    }

    var user models.User
    db.First(&user, "id = ?", userID)
    if user.EmailVerifiedAt == nil {
        t.Fatal("expected user verified")
    }
    var codeCount int64
    db.Model(&models.AuthCode{}).Where("user_id = ? AND purpose = ?", userID, emailVerifyPurpose).Count(&codeCount)
    if codeCount != 0 {
        t.Fatalf("expected code row deleted after verification, got %d", codeCount)
    }

    // refresh token must be usable
    var rt models.RefreshToken
    if err := db.Where("user_id = ?", userID).First(&rt).Error; err != nil {
        t.Fatalf("expected refresh token row: %v", err)
    }
}

func TestVerifyEmail_WrongCode_ExhaustsAttempts(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())
    userID, otp := seedUnverifiedUser(t, db, "brute@example.com")

    for i := 1; i <= maxOtpAttempts; i++ {
        w := httptest.NewRecorder()
        r.ServeHTTP(w, verifyEmailRequest("brute@example.com", "000000"))
        if w.Code != http.StatusBadRequest {
            t.Fatalf("attempt %d: expected 400, got %d", i, w.Code)
        }
        if otp == "000000" {
            t.Fatal("test otp collided with wrong code")
        }
    }

    // after 5 failures the row is gone; next attempt still 400
    w := httptest.NewRecorder()
    r.ServeHTTP(w, verifyEmailRequest("brute@example.com", otp))
    if w.Code != http.StatusBadRequest {
        t.Fatalf("expected 400 after attempts exhausted, got %d", w.Code)
    }
    var user models.User
    db.First(&user, "id = ?", userID)
    if user.EmailVerifiedAt != nil {
        t.Fatal("user must not be verified after exhausted attempts")
    }
    var codeCount int64
    db.Model(&models.AuthCode{}).Where("user_id = ? AND purpose = ?", userID, emailVerifyPurpose).Count(&codeCount)
    if codeCount != 0 {
        t.Fatalf("expected code row deleted after 5 attempts, got %d", codeCount)
    }
}

func TestVerifyEmail_ExpiredCode(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())
    userID, otp := seedUnverifiedUser(t, db, "expired@example.com")

    db.Model(&models.AuthCode{}).Where("user_id = ? AND purpose = ?", userID, emailVerifyPurpose).
        Update("expires_at", time.Now().Add(-time.Hour))

    w := httptest.NewRecorder()
    r.ServeHTTP(w, verifyEmailRequest("expired@example.com", otp))
    if w.Code != http.StatusBadRequest {
        t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
    }
}

func TestVerifyEmail_UnknownEmail(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())

    w := httptest.NewRecorder()
    r.ServeHTTP(w, verifyEmailRequest("nobody@example.com", "123456"))
    if w.Code != http.StatusUnauthorized {
        t.Fatalf("expected 401, got %d", w.Code)
    }
}

func TestVerifyEmail_AlreadyVerified(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())
    userID, _ := seedUnverifiedUser(t, db, "already@example.com")
    now := time.Now()
    db.Model(&models.User{}).Where("id = ?", userID).Update("email_verified_at", &now)

    w := httptest.NewRecorder()
    r.ServeHTTP(w, verifyEmailRequest("already@example.com", "123456"))
    if w.Code != http.StatusBadRequest {
        t.Fatalf("expected 400, got %d", w.Code)
    }
    var resp struct {
        Error struct{ Code string `json:"code"` } `json:"error"`
    }
    json.Unmarshal(w.Body.Bytes(), &resp)
    if resp.Error.Code != "ALREADY_VERIFIED" {
        t.Fatalf("expected ALREADY_VERIFIED, got %s", resp.Error.Code)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/auth/ -run "TestVerifyEmail" -count=1`
Expected: FAIL — route 404, handler undefined.

- [ ] **Step 3: Implement**

Add the request type near the other request structs in `handlers.go`:

```go
type verifyEmailRequest struct {
    Email    string `json:"email" binding:"required"`
    Otp      string `json:"otp" binding:"required"`
    DeviceID string `json:"device_id"`
}
```

Add the handler at the end of `handlers.go` (before `hashToken`):

```go
func HandleVerifyEmail(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req verifyEmailRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            Error(c, http.StatusBadRequest, "VALIDATION_ERROR", "email and otp are required")
            return
        }

        var user models.User
        if db.Where("email = ?", req.Email).First(&user).Error != nil {
            Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid email")
            return
        }
        if user.EmailVerifiedAt != nil {
            Error(c, http.StatusBadRequest, "ALREADY_VERIFIED", "email already verified")
            return
        }

        code, err := findEmailVerifyCode(db, user.ID)
        if err != nil || code.ExpiresAt.Before(time.Now()) {
            Error(c, http.StatusBadRequest, "INVALID_VERIFICATION_CODE", "verification code expired or invalid")
            return
        }

        hash := sha256.Sum256([]byte(req.Otp))
        if !ConstantTimeCompare(hash[:], []byte(code.CodeHash)) {
            code.Attempts++
            if code.Attempts >= maxOtpAttempts {
                db.Delete(&code)
                Error(c, http.StatusBadRequest, "INVALID_VERIFICATION_CODE", "too many failed attempts, request a new code")
                return
            }
            db.Save(&code)
            Error(c, http.StatusBadRequest, "INVALID_VERIFICATION_CODE", "invalid verification code")
            return
        }

        now := time.Now()
        if err := db.Model(&user).Updates(map[string]interface{}{
            "email_verified_at": &now,
            "last_login_at":     &now,
        }).Error; err != nil {
            Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to verify email")
            return
        }
        user.EmailVerifiedAt = &now

        if err := db.Delete(&code).Error; err != nil {
            Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to consume verification code")
            return
        }

        rt, err := createRefreshToken(db, user.ID, req.DeviceID, cfg)
        if err != nil {
            Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create refresh token")
            return
        }
        at, _, err := GenerateTokenPair(user.ID, req.DeviceID, cfg)
        if err != nil {
            Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to generate tokens")
            return
        }

        Success(c, http.StatusOK, gin.H{
            "access_token":  at,
            "refresh_token": rt,
            "user":          user,
            "keyring":       fetchKeyring(db, user.ID),
        })
    }
}
```

Register the route in the test router (`setupHandlerRouter` in `handlers_test.go`) after `/register`:

```go
auth.POST("/verify-email", HandleVerifyEmail(db, cfg))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/auth/ -run "TestVerifyEmail" -count=1`
Expected: PASS. (Note: `ConstantTimeCompare` takes `[]byte` — the second arg is `[]byte(code.CodeHash)`, adjust the call accordingly.)

- [ ] **Step 5: Commit**

```bash
git add server/internal/auth/handlers.go server/internal/auth/handlers_test.go
git commit -m "feat: verify email otp endpoint with attempts cap"
```

---

### Task 8: Resend handler — 60s cooldown, replace code

**Files:**
- Modify: `server/internal/auth/handlers.go`
- Test: `server/internal/auth/handlers_test.go`

**Interfaces:**
- Produces: `HandleResendVerification(db *gorm.DB, cfg *config.Config) gin.HandlerFunc` — 200 `{ verification_required: true }`; 429 `TOO_MANY_REQUESTS` within 60s cooldown.

- [ ] **Step 1: Write the failing tests**

```go
func TestResendVerification_ReplacesCode(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())
    userID, otp := seedUnverifiedUser(t, db, "resend@example.com")

    // wait out cooldown: backdate the existing row
    db.Model(&models.AuthCode{}).Where("user_id = ? AND purpose = ?", userID, emailVerifyPurpose).
        Update("created_at", time.Now().Add(-time.Minute))

    raw, _ := json.Marshal(map[string]string{"email": "resend@example.com"})
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/v1/auth/resend-verification", bytes.NewReader(raw))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
    }

    code, err := findEmailVerifyCode(db, userID)
    if err != nil {
        t.Fatal(err)
    }
    hash := sha256.Sum256([]byte(otp))
    if string(code.CodeHash) == string(hash[:]) {
        t.Fatal("expected old otp to be replaced")
    }
    var count int64
    db.Model(&models.AuthCode{}).Where("user_id = ? AND purpose = ?", userID, emailVerifyPurpose).Count(&count)
    if count != 1 {
        t.Fatalf("expected exactly 1 row, got %d", count)
    }
}

func TestResendVerification_Cooldown(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())
    seedUnverifiedUser(t, db, "cooldown@example.com")

    raw, _ := json.Marshal(map[string]string{"email": "cooldown@example.com"})
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/v1/auth/resend-verification", bytes.NewReader(raw))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)

    if w.Code != http.StatusTooManyRequests {
        t.Fatalf("expected 429, got %d: %s", w.Code, w.Body.String())
    }
}

func TestResendVerification_UnknownEmail_Uniform(t *testing.T) {
    db := setupTestDB(t)
    r := setupHandlerRouter(db, testConfigWithVerification())

    raw, _ := json.Marshal(map[string]string{"email": "ghost@example.com"})
    w := httptest.NewRecorder()
    req := httptest.NewRequest("POST", "/api/v1/auth/resend-verification", bytes.NewReader(raw))
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Fatalf("expected 200 (no enumeration), got %d", w.Code)
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/auth/ -run "TestResendVerification" -count=1`
Expected: FAIL — route 404.

- [ ] **Step 3: Implement**

Add handler at the end of `handlers.go` (next to `HandleVerifyEmail`):

```go
func HandleResendVerification(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req struct {
            Email string `json:"email" binding:"required"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
            Error(c, http.StatusBadRequest, "VALIDATION_ERROR", "email is required")
            return
        }

        var user models.User
        if db.Where("email = ?", req.Email).First(&user).Error != nil ||
            user.AuthProvider != "password" || user.EmailVerifiedAt != nil {
            Success(c, http.StatusOK, gin.H{"verification_required": true})
            return
        }

        existing, err := findEmailVerifyCode(db, user.ID)
        if err == nil && time.Since(existing.CreatedAt) < time.Minute {
            Error(c, http.StatusTooManyRequests, "TOO_MANY_REQUESTS", "wait before requesting a new code")
            return
        }

        otp, err := issueEmailVerifyCode(db, user.ID)
        if err != nil {
            Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create verification code")
            return
        }
        sender := email.New(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPFrom)
        if err := sender.SendOtp(user.Email, otp); err != nil {
            slog.Error("failed to send verification otp", "email", user.Email, "error", err)
        }

        Success(c, http.StatusOK, gin.H{"verification_required": true})
    }
}
```

Register in test router after `/verify-email`:

```go
auth.POST("/resend-verification", HandleResendVerification(db, cfg))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/auth/ -run "TestResendVerification" -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/auth/handlers.go server/internal/auth/handlers_test.go
git commit -m "feat: resend verification otp with 60s cooldown"
```

---

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

### Task 10: OAuth users auto-verified

**Files:**
- Modify: `server/internal/auth/oauth.go:352-361` (user creation) and `:344-350` (email-link branch)
- Test: `server/internal/auth/oauth_test.go`

**Interfaces:**
- Produces: users created via OAuth callback get `EmailVerifiedAt` set at creation; pre-existing email-linked users get it set at link time.

- [ ] **Step 1: Write the failing test**

Check `oauth_test.go` for the existing user-creation test (search for `models.User{` in the test file) and add:

```go
func TestOAuthCallback_CreatesVerifiedUser(t *testing.T) {
    // follow the existing OAuth callback test setup in this file
    // (mock provider userinfo, router, etc.) and assert:
    // after the flow completes, db user has EmailVerifiedAt != nil
}
```

If no callback-level harness exists, test at the model layer instead — add to the callback test the assertion that the created user row has `EmailVerifiedAt != nil`.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/auth/ -run TestOAuthCallback_CreatesVerifiedUser -count=1`
Expected: FAIL — `EmailVerifiedAt` nil.

- [ ] **Step 3: Implement**

In `oauth.go`, new-user creation (line ~352):

```go
user = models.User{
    ID:              uuid.New(),
    Email:           ui.Email,
    FullName:        ui.Name,
    AuthProvider:    provider,
    ProviderSub:     &providerSub,
    EmailVerifiedAt: &now,
    Initialized:     false,
    CreatedAt:       time.Now(),
    UpdatedAt:       time.Now(),
}
```

(`now` = the `time.Now()` already available in that scope; if not, create `now := time.Now()` before the struct.)

In the email-link branch (line ~344):

```go
user.AuthProvider = provider
user.ProviderSub = &providerSub
user.EmailVerifiedAt = &now
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/auth/ -run "TestOAuth" -count=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/internal/auth/oauth.go server/internal/auth/oauth_test.go
git commit -m "feat: oauth users auto-verified"
```

---

### Task 11: Run full server suite

- [ ] **Step 1: Run everything**

Run: `go vet ./... && go test ./... -count=1`
Expected: all PASS (existing suite + new tests).

- [ ] **Step 2: Commit any stragglers**

```bash
git status --short && git add -A && git commit -m "chore: server test fixes" || true
```

---

### Task 12: Client API layer

**Files:**
- Modify: `client/src/lib/api/auth.ts` (types at 137-198, `authApi` at 200-316)

**Interfaces:**
- Produces:
  - `interface RegisterResponse extends Partial<TokenPair> { user: User; verification_required?: boolean }`
  - `interface VerifyEmailResponse extends TokenPair { user: User; keyring?: KeyringRows }`
  - `authApi.verifyEmail(params: { email: string; otp: string; device_id: string }): Promise<VerifyEmailResponse>`
  - `authApi.resendVerification(email: string): Promise<{ verification_required: boolean }>`

- [ ] **Step 1: Update the types**

```ts
export interface RegisterResponse extends Partial<TokenPair> {
  user: User;
  verification_required?: boolean;
}

export interface VerifyEmailResponse extends TokenPair {
  user: User;
  keyring?: KeyringRows;
}
```

- [ ] **Step 2: Add the methods**

```ts
async verifyEmail(params: {
  email: string;
  otp: string;
  device_id: string;
}): Promise<VerifyEmailResponse> {
  return apiFetch("POST", "/api/v1/auth/verify-email", params);
},

async resendVerification(email: string): Promise<{
  verification_required: boolean;
}> {
  return apiFetch("POST", "/api/v1/auth/resend-verification", { email });
},
```

(Add inside `authApi` after `register`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (in `client/`)
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/api/auth.ts
git commit -m "feat: client api for verify-email and resend"
```

---

### Task 13: authStore — pendingVerificationEmail state + verify/resend actions

**Files:**
- Modify: `client/src/stores/auth/authStore.ts` (state interface 51-92, register 180-234, login 236-284, catch helpers)

**Interfaces:**
- Consumes: `authApi.verifyEmail`, `authApi.resendVerification`, `AuthApiError` (from `../../lib/api/auth`), `getDeviceId`
- Produces:
  - State: `pendingVerificationEmail: string | null`
  - `verifyEmail: (email: string, otp: string) => Promise<void>` — on success: same state transitions as `login()` (user, tokens, isAuthenticated, isUnlocked, persistTokens, savePassword when `!alwaysAsk`, clear `pendingVerificationEmail`)
  - `resendVerification: (email: string) => Promise<void>`
  - `clearPendingVerification: () => void`

- [ ] **Step 1: Add state + actions to the interface**

In the `AuthState` interface add after `pendingOAuth`:

```ts
pendingVerificationEmail: string | null;
```

Add after `oauthSetup`:

```ts
verifyEmail: (email: string, otp: string, password?: string) => Promise<void>;
resendVerification: (email: string) => Promise<void>;
clearPendingVerification: () => void;
```

> `password` is optional: the OTP panel lives on the same page as the login/register form, so the page can pass the just-typed password through. When provided (and `!alwaysAsk`), the keychain entry is armed after verification; otherwise auto-unlock simply isn't armed.

- [ ] **Step 2: Register — branch on verification_required**

In `register()` (after `authApi.register` call, before `set({...})`):

```ts
if (res.verification_required) {
  set({ pendingVerificationEmail: email, isLoading: false });
  return;
}
```

- [ ] **Step 3: Login — catch VERIFICATION_REQUIRED**

Import `AuthApiError` in the `authApi` import block:

```ts
import {
  authApi,
  loadApiUrl,
  setRefreshTokenGetter,
  setRefreshTokenSetter,
  type AuthApiError,
  type TokenPair,
  type User,
} from "../../lib/api/auth";
```

In `login()`'s catch, before the generic message assignment:

```ts
} catch (err) {
  if (
    err instanceof AuthApiError &&
    err.apiError.code === "VERIFICATION_REQUIRED"
  ) {
    set({
      pendingVerificationEmail: err.apiError.email ?? email,
      isLoading: false,
    });
    return;
  }
  const message = ...
```

- [ ] **Step 4: Add verifyEmail / resendVerification / clearPendingVerification actions**

Add after `register` in the store body:

```ts
verifyEmail: async (email: string, otp: string) => {
  set({ isLoading: true, error: null });
  try {
    const res = await authApi.verifyEmail({
      email,
      otp,
      device_id: await getDeviceId(),
    });

    if (res.keyring) {
      await unwrapDek(res.keyring.dek_wrapped_by_kek);
    }

    const newTokens = {
      access_token: res.access_token,
      refresh_token: res.refresh_token,
    };
    set({
      user: res.user,
      tokens: newTokens,
      isAuthenticated: true,
      isUnlocked: true,
      pendingVerificationEmail: null,
      isLoading: false,
    });
    await persistTokens(newTokens);
    if (password && !get().alwaysAsk) {
      await savePassword(password);
    }
  } catch (err) {
    const message =
      typeof err === "string"
        ? err
        : err instanceof Error
          ? err.message
          : "Verification failed";
    set({ error: message, isLoading: false });
    throw err;
  }
},

resendVerification: async (email: string) => {
  set({ isLoading: true, error: null });
  try {
    await authApi.resendVerification(email);
    set({ isLoading: false });
  } catch (err) {
    const message =
      typeof err === "string"
        ? err
        : err instanceof Error
          ? err.message
          : "Resend failed";
    set({ error: message, isLoading: false });
    throw err;
  }
},

clearPendingVerification: () => set({ pendingVerificationEmail: null }),
```

> NOTE on `savePassword`: `savePassword` is called with the raw password in `login()`/`register()`; in `verifyEmail` the caller must pass the password through. **Signature change**: change `verifyEmail: (email: string, otp: string) => Promise<void>` to `verifyEmail: (email: string, otp: string, password?: string) => Promise<void>` and call `savePassword(password)` only when `password` is provided. Update the interface and Task 14 accordingly — the OTP panel can't know the password unless the login/register form passes it through.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` then `pnpm biome check src/stores/auth/authStore.ts`
Expected: exit 0 both.

- [ ] **Step 6: Commit**

```bash
git add client/src/stores/auth/authStore.ts
git commit -m "feat: pending verification state and verify/resend actions"
```

---

### Task 14: OTP panel component + page integration

**Files:**
- Create: `client/src/components/auth/forms/EmailVerification.tsx`
- Modify: `client/src/pages/auth/LoginPage.tsx:17-31`
- Modify: `client/src/pages/auth/RegisterPage.tsx:17-27`

**Interfaces:**
- Consumes: `useAuthStore().pendingVerificationEmail`, `verifyEmail(email, otp, password?)`, `resendVerification(email)`, `clearPendingVerification`, `isLoading`, `error`, `clearError`
- Produces: `EmailVerification` component — shows email, 6-digit input, Resend button (60s countdown), "Back to sign in" link (calls `clearPendingVerification`).

- [ ] **Step 1: Create the component**

```tsx
import { useState } from "react";
import { useAuthStore } from "@/stores/auth/authStore";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/forms/FormInput";

export default function EmailVerification({
  onBackToLogin,
  password,
}: {
  onBackToLogin: () => void;
  password?: string;
}) {
  const {
    pendingVerificationEmail,
    verifyEmail,
    resendVerification,
    isLoading,
    error,
    clearError,
  } = useAuthStore();
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const email = pendingVerificationEmail ?? "";

  const handleResend = async () => {
    clearError();
    setCooldown(60);
    const timer = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    await resendVerification(email);
  };

  const handleVerify = async () => {
    clearError();
    await verifyEmail(email, otp.trim(), password);
  };

  return (
    <div className="bg-dark-900 rounded-xl p-6 shadow-xl">
      <h2 className="text-xl font-semibold text-white mb-2">
        Verify your email
      </h2>
      <p className="text-dark-400 text-sm mb-6">
        Enter the 6-digit code sent to <span className="text-white">{email}</span>
      </p>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <FormInput
          control={undefined}
          name="otp"
          label="Verification code"
          placeholder="123456"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />

        <Button
          type="button"
          disabled={isLoading || otp.length !== 6}
          variant="default"
          size="sm"
          className="w-full"
          onClick={handleVerify}
        >
          {isLoading ? "Verifying..." : "Verify"}
        </Button>

        <Button
          type="button"
          disabled={cooldown > 0}
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleResend}
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </Button>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full text-center text-primary-500 hover:text-primary-400 text-sm"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}
```

> NOTE: `FormInput` is react-hook-form controlled (`control` prop). Check `client/src/components/ui/forms/FormInput.tsx` — if it requires `control`, either (a) use a plain `<input>` with existing input classes for this component, or (b) wrap in a small `useForm` instance. Prefer the plain input if FormInput is controller-bound. Adjust accordingly and run biome.

- [ ] **Step 2: Integrate into LoginPage**

```tsx
const { login, isLoading, error, clearError, pendingVerificationEmail } =
  useAuthStore();
```

At the top of the card (after the `<div className="bg-dark-900 ...">` opening tag):

```tsx
{pendingVerificationEmail && (
  <EmailVerification onBackToLogin={clearPendingVerification} />
)}
{!pendingVerificationEmail && (
  // wrap the existing card content (heading, error, OAuthLogin, form, links, ServerConfig) in this fragment
)}
```

(Extract the existing card content into a `{!pendingVerificationEmail && (...)}` fragment so the OTP panel replaces it. `clearPendingVerification` comes from the store.)

- [ ] **Step 3: Integrate into RegisterPage** — same pattern as LoginPage.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` then `pnpm biome check .`
Expected: exit 0.

**LoginPage password pass-through:** keep `const [password, setPassword] = useState("")` in LoginPage; on form submit `setPassword(data.password)` before calling `login`; render `<EmailVerification onBackToLogin={clearPendingVerification} password={password} />`. In the component, call `verifyEmail(email, otp, password)`. Same on RegisterPage with its form's `password` field.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/auth/forms/EmailVerification.tsx client/src/pages/auth/LoginPage.tsx client/src/pages/auth/RegisterPage.tsx
git commit -m "feat: otp entry panel on login and register pages"
```

---

### Task 15: Client tests (vitest)

**Files:**
- Create: `client/src/stores/auth/authStore.test.ts`

**Interfaces:**
- Consumes: mocked `../../lib/api/auth`, mocked tauri store/keychain/db/crypto modules.

- [ ] **Step 1: Write the tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setRefreshToken, getRefreshToken } = vi.hoisted(() => ({
  setRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(() => null),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
  })),
}));

vi.mock("../../lib/api/auth", () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    prelogin: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  },
  loadApiUrl: vi.fn(async () => {}),
  setRefreshTokenGetter: vi.fn(),
  setRefreshTokenSetter: vi.fn(),
  AuthApiError: class AuthApiError extends Error {
    constructor(
      public status: number,
      public apiError: { code: string; message: string; email?: string },
    ) {
      super(apiError.message);
    }
  },
}));

vi.mock("../../lib/crypto/crypto", () => ({
  generateAccountMaterial: vi.fn(async () => ({
    recovery_code: "rc",
    public_key: "pk",
    salt_cl: "sc",
  })),
  deriveKek: vi.fn(async () => {}),
  buildKeyringRows: vi.fn(async () => ({
    dek_wrapped_by_kek: "kek",
    dek_wrapped_by_recovery: "rec",
    private_key_wrapped_by_dek: "pk",
  })),
  computeLoginProof: vi.fn(async () => ({
    proof: "proof",
    verifier: "verifier",
  })),
  unwrapDek: vi.fn(async () => {}),
  lockSession: vi.fn(async () => {}),
  clearKeychain: vi.fn(async () => {}),
  setRefreshToken,
  getRefreshToken,
  saveRefreshToken: vi.fn(async () => {}),
  loadRefreshToken: vi.fn(async () => null),
  signChallenge: vi.fn(async () => "sig"),
}));

vi.mock("../../lib/db/db", () => ({
  wipeLocalData: vi.fn(async () => {}),
}));

vi.mock("../../lib/keychain/keychain", () => ({
  deletePassword: vi.fn(async () => {}),
  loadPassword: vi.fn(async () => null),
  savePassword: vi.fn(async () => {}),
}));

vi.mock("../../lib/common/device", () => ({
  getDeviceId: vi.fn(async () => "dev-1"),
}));

import { authApi, AuthApiError } from "../../lib/api/auth";
import { useAuthStore } from "./authStore";

describe("authStore email verification", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isUnlocked: false,
      pendingVerificationEmail: null,
      error: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it("register with verification_required sets pending email and no tokens", async () => {
    vi.mocked(authApi.prelogin).mockResolvedValue({
      nonce: "n",
      kdf: { m: 32768, t: 2, p: 1 },
      server_salt: "ss",
      salt_cl: "sc",
    });
    vi.mocked(authApi.register).mockResolvedValue({
      user: {
        id: "u1",
        email: "new@example.com",
        initialized: true,
        auth_provider: "password",
        created_at: "2026-01-01",
      },
      verification_required: true,
    } as never);

    await useAuthStore.getState().register("new@example.com", "New User", "pw");

    const s = useAuthStore.getState();
    expect(s.pendingVerificationEmail).toBe("new@example.com");
    expect(s.isAuthenticated).toBe(false);
    expect(s.tokens).toBeNull();
  });

  it("login with VERIFICATION_REQUIRED sets pending email", async () => {
    vi.mocked(authApi.prelogin).mockResolvedValue({
      nonce: "n",
      kdf: { m: 32768, t: 2, p: 1 },
      server_salt: "ss",
      salt_cl: "sc",
    });
    vi.mocked(authApi.login).mockRejectedValue(
      new AuthApiError(403, {
        code: "VERIFICATION_REQUIRED",
        message: "verify your email",
        email: "gate@example.com",
      }),
    );

    await useAuthStore.getState().login("gate@example.com", "pw");

    const s = useAuthStore.getState();
    expect(s.pendingVerificationEmail).toBe("gate@example.com");
    expect(s.isAuthenticated).toBe(false);
  });

  it("verifyEmail succeeds and authenticates", async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      user: {
        id: "u1",
        email: "new@example.com",
        initialized: true,
        auth_provider: "password",
        created_at: "2026-01-01",
      },
      keyring: {
        dek_wrapped_by_kek: "kek",
        dek_wrapped_by_recovery: "rec",
        private_key_wrapped_by_dek: "pk",
      },
    } as never);

    await useAuthStore
      .getState()
      .verifyEmail("new@example.com", "123456", "pw");

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.isUnlocked).toBe(true);
    expect(s.pendingVerificationEmail).toBeNull();
    expect(s.tokens).toEqual({
      access_token: "at",
      refresh_token: "rt",
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm vitest run src/stores/auth/authStore.test.ts`
Expected: PASS. (If `setRefreshToken` hoist mocks cause type friction, cast with `as never` / `as unknown as` on mockResolvedValue arguments.)

- [ ] **Step 3: Run the full client suite**

Run: `pnpm vitest run && npx tsc --noEmit && pnpm biome check .`
Expected: all PASS / exit 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/stores/auth/authStore.test.ts
git commit -m "test: authStore email verification flows"
```

---

### Task 16: Docs — env table + .env

**Files:**
- Modify: `AGENTS.md` (env tables)
- Modify: `server/.env` (new section)
- Modify: `client/.env` (no change expected — verify)

- [ ] **Step 1: Update AGENTS.md server env table**

Add rows after `TERMVAULT_OAUTH_REDIRECT_URIS`:

```markdown
| `REQUIRE_EMAIL_VERIFICATION` | Require OTP email verification for password signups (`true`/`1`/`yes`) | `false` (off) |
| `SMTP_HOST` | SMTP server hostname for verification emails (empty = OTP logged to console) | empty |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` | SMTP auth username | empty |
| `SMTP_PASSWORD` | SMTP auth password | empty |
| `SMTP_FROM` | From address for verification emails | empty |
```

- [ ] **Step 2: Update server/.env**

Add before the Redis section:

```bash
# ── Email verification (optional) ────────────────────────────────────────────

# Require new email/password signups to verify their email with a 6-digit OTP.
# Accepted values: true / 1 / yes. Off by default.
REQUIRE_EMAIL_VERIFICATION=false

# SMTP server for sending verification emails. If SMTP_HOST is empty, the OTP
# is logged to the server console instead (dev mode).
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=
```

- [ ] **Step 3: Run full verification**

Run (server): `go vet ./... && go test ./... -count=1`
Run (client): `pnpm vitest run && npx tsc --noEmit && pnpm biome check .`
Run (tauri): `cd client/src-tauri && cargo check`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md server/.env
git commit -m "docs: email verification env vars"
```

---

## Self-review notes

- Spec coverage: toggle (T1), model (T2), delivery (T3), OTP lifecycle (T4), register gate (T5), login gate (T6), verify (T7), resend (T8), routes+rate limit (T9), OAuth exempt (T10), no-token invariant enforced across T5/T6/T7 (register/login never mint for unverified; only verify transitions state), client API (T12), store (T13), UI (T14), tests (T15), docs (T16).
- `ConstantTimeCompare` takes `[]byte, []byte` — verify handler passes `[]byte(code.CodeHash)`.
- `verifyEmail(email, otp, password?)`: pages hold the last-typed password and pass it through to arm the keychain entry (`savePassword`) only when provided; otherwise auto-unlock isn't armed and the user unlocks manually next launch.
