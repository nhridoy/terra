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
