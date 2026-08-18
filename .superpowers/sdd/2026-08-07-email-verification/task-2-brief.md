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
