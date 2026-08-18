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
