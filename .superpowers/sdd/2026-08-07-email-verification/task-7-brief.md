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
            Error(c, http.StatusBadRequest, "INVALID_VERIFICATION_CODE", "verification code expired or missing")
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
