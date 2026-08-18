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
