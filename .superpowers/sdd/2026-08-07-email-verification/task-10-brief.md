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
