# Auth + Encryption Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement user signup/login (email + Google/GitHub OAuth), end-to-end encryption (envelope keys, recovery code), encrypted local vault, and refresh-token sessions.

**Architecture:** Server (Go/Gin/GORM) handles auth only — never sees plaintext. Client Rust holds crypto in memory (DEK/KEK never cross IPC). Client TS orchestrates flows. Local DB mirrors vault layer only.

**Tech Stack:** Go 1.26, Gin, GORM, SQLite; Rust, Tauri v2, argon2/xchacha20poly1305/x25519-dalek/keyring crates; TypeScript, Zustand, Vitest.

## Global Constraints

- Password never leaves the client; server stores only Argon2id(KEK, serverSalt) verifier
- DEK and X25519 private key live in Rust memory, never cross IPC boundary
- `zeroize` crate for all key material in Rust
- OS keychain via `keyring` crate for refresh token + "remember" blob
- `tauri-plugin-store` (JSON) for non-secret preferences only
- Local DB mirrors `vaults`, `records`, `user_keys` + user profile subset — never `refresh_tokens`, `oauth_states`, `auth_codes`, `auth_verifier`, `auth_salt`
- All crypto: Argon2id13 (m=64MiB, t=3, p=1), XChaCha20-Poly1305, X25519, HMAC-SHA256, SHA-256
- JSON envelope: success `{data, meta:{request_id}}`, error `{error:{code, message, request_id}}`
- Status codes: 200/201/204/400/401/403/404/409/422/429/500
- Rate limit: 10/min auth, 30/min API (existing env vars)
- `pnpm` only for client, never npm
- Biome enforces single quotes, space indent
- GORM AutoMigrate on startup (existing behavior)
- Spec: `docs/superpowers/specs/2026-08-04-auth-encryption-core-design.md`

## File Structure

### Server (`server/`)

| File | Responsibility |
|---|---|
| `internal/config/config.go` | Load .env, expose Config struct (DB_URL, JWT_SECRET, JWT_EXPIRY, REFRESH_TOKEN_EXPIRY, OAUTH_*, RATE_LIMIT_*) |
| `internal/models/user.go` | User GORM model |
| `internal/models/user_key.go` | UserKey GORM model |
| `internal/models/refresh_token.go` | RefreshToken GORM model |
| `internal/models/oauth_state.go` | OAuthState GORM model |
| `internal/models/auth_code.go` | AuthCode GORM model |
| `internal/models/vault.go` | Vault GORM model |
| `internal/models/record.go` | Record GORM model |
| `internal/models/models.go` | AutoMigrate + seed Personal vault |
| `internal/auth/jwt.go` | JWT sign/verify, token pair generation |
| `internal/auth/verifier.go` | HMAC-SHA256 proof generation + constant-time verify |
| `internal/auth/middleware.go` | Gin middleware: JWT extraction, request ID, rate limit, CORS |
| `internal/auth/handlers.go` | All auth endpoint handlers |
| `internal/auth/oauth.go` | OAuth start/callback/exchange/setup handlers |
| `internal/auth/responses.go` | JSON envelope helpers (success/error) |
| `cmd/termvault-server/main.go` | Wire config → DB → router → handlers → run |

### Client Rust (`client/src-tauri/src/`)

| File | Responsibility |
|---|---|
| `crypto.rs` | Tauri commands: generate_account_material, derive_kek, compute_login_proof, build_keyring_rows, encrypt_secret, decrypt_secret, unwrap_dek, recovery_unwrap_dek, sign_challenge, lock, unlock |
| `keystore.rs` | OS keychain via `keyring` crate: save/load refresh token, save/load remember blob |
| `db.rs` | rusqlite: open, CRUD for vaults/records/user_keys/user_profile/local_meta |
| `oauth.rs` | Deep-link handler for `termvault://auth/callback` |

### Client TS (`client/src/`)

| File | Responsibility |
|---|---|
| `lib/crypto/crypto.ts` | Replace stub with Tauri invoke wrappers |
| `lib/api/auth.ts` | Auth API client (prelogin, register, login, refresh, logout, password, recovery, oauth, setup) |
| `stores/auth/authStore.ts` | Zustand store: auth state, flows, auto-refresh |
| `pages/auth/LoginPage.tsx` | Login form + social buttons |
| `pages/auth/RegisterPage.tsx` | Register form |
| `pages/auth/SetupPage.tsx` | Post-OAuth encryption password setup |
| `pages/auth/RecoveryPage.tsx` | Recovery code restore |
| `pages/auth/RecoveryRevealModal.tsx` | Post-register recovery code reveal + kit download |

---

## Task 1: Server Config + Models + Migration

**Files:**
- Create: `server/internal/config/config.go`
- Create: `server/internal/models/user.go`
- Create: `server/internal/models/user_key.go`
- Create: `server/internal/models/refresh_token.go`
- Create: `server/internal/models/oauth_state.go`
- Create: `server/internal/models/auth_code.go`
- Create: `server/internal/models/vault.go`
- Create: `server/internal/models/record.go`
- Create: `server/internal/models/models.go`
- Modify: `server/cmd/termvault-server/main.go`
- Modify: `server/go.mod`

**Interfaces:**
- Produces: `config.Cfg`, `models.AutoMigrate(db)`, `models.SeedPersonalVault(db, userID)`

- [ ] **Step 1: Add dependencies**

```bash
cd server && go get gorm.io/gorm gorm.io/driver/sqlite github.com/joho/godotenv github.com/google/uuid github.com/golang-jwt/jwt/v5 golang.org/x/crypto golang.org/x/oauth2
```

- [ ] **Step 2: Create config.go**

```go
package config

import (
	"os"
	"time"
	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	Host              string
	DatabaseURL       string
	JWTSecret         string
	JWTExpiry         time.Duration
	RefreshTokenExpiry time.Duration
	BaseURL           string
	OAuthGoogleID     string
	OAuthGoogleSecret string
	OAuthGitHubID     string
	OAuthGitHubSecret string
	OAuthRedirectBase string
	AppScheme         string
	RateLimitAuth     int
	RateLimitAPI      int
	TrustedProxies    []string
}

func Load() *Config {
	godotenv.Load()
	cfg := &Config{
		Port:              getEnv("TERMVAULT_PORT", "8080"),
		Host:              getEnv("TERMVAULT_HOST", "0.0.0.0"),
		DatabaseURL:       getEnv("DATABASE_URL", "sqlite://termvault.db"),
		JWTSecret:         os.Getenv("JWT_SECRET"),
		JWTExpiry:         parseDuration(getEnv("JWT_EXPIRY", "15m")),
		RefreshTokenExpiry: parseDuration(getEnv("REFRESH_TOKEN_EXPIRY", "720h")),
		BaseURL:           getEnv("BASE_URL", "http://localhost:8080"),
		OAuthGoogleID:     os.Getenv("OAUTH_GOOGLE_CLIENT_ID"),
		OAuthGoogleSecret: os.Getenv("OAUTH_GOOGLE_CLIENT_SECRET"),
		OAuthGitHubID:     os.Getenv("OAUTH_GITHUB_CLIENT_ID"),
		OAuthGitHubSecret: os.Getenv("OAUTH_GITHUB_CLIENT_SECRET"),
		OAuthRedirectBase: getEnv("OAUTH_REDIRECT_BASE", getEnv("BASE_URL", "http://localhost:8080")),
		AppScheme:         getEnv("APP_SCHEME", "termvault"),
		RateLimitAuth:     10,
		RateLimitAPI:      30,
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func parseDuration(s string) time.Duration {
	d, _ := time.ParseDuration(s)
	return d
}
```

- [ ] **Step 3: Create user.go**

```go
package models

import (
	"time"
	"github.com/google/uuid"
)

type User struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey"`
	Email         string     `gorm:"uniqueIndex;not null"`
	Name          string     `gorm:"not null"`
	AuthProvider  string     `gorm:"not null;default:'password'"`
	ProviderSub   *string    `gorm:"uniqueIndex"`
	AuthVerifier  *string
	AuthSalt      *string
	SaltCL        *string
	KDFM          int        `gorm:"not null;default:67108864"`
KDFT          int        `gorm:"not null;default:3"`
	KDFP          int        `gorm:"not null;default:1"`
	PublicKey     *string
	Initialized   bool       `gorm:"not null;default:false"`
	LastLoginAt   *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
```

- [ ] **Step 4: Create user_key.go**

```go
package models

import "time"

type UserKey struct {
	ID        uint      `gorm:"primaryKey;autoIncrement"`
	UserID    string    `gorm:"type:uuid;not null;index"`
	KeyType   string    `gorm:"not null"`
	Payload   string    `gorm:"not null"`
	CreatedAt time.Time
}
```

- [ ] **Step 5: Create remaining models**

Create `refresh_token.go`, `oauth_state.go`, `auth_code.go`, `vault.go`, `record.go` following the spec schema exactly (§7).

- [ ] **Step 6: Create models.go (AutoMigrate + seed)**

```go
package models

import "gorm.io/gorm"

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{}, &UserKey{}, &RefreshToken{},
		&OAuthState{}, &AuthCode{}, &Vault{}, &Record{},
	)
}
```

- [ ] **Step 7: Update main.go**

Replace hello-world with config → GORM → AutoMigrate → router skeleton.

- [ ] **Step 8: Run `go vet ./...` to verify**

- [ ] **Step 9: Commit**

---

## Task 2: Server Responses + JWT + Verifier

**Files:**
- Create: `server/internal/auth/responses.go`
- Create: `server/internal/auth/jwt.go`
- Create: `server/internal/auth/verifier.go`

**Interfaces:**
- Produces: `auth.Success(c, status, data)`, `auth.Error(c, status, code, msg)`, `auth.GenerateTokenPair(userID, deviceID, cfg)`, `auth.ConstantTimeCompare(a, b)`

- [ ] **Step 1: Write responses.go test**

```go
// internal/auth/responses_test.go
package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"github.com/gin-gonic/gin"
)

func TestSuccessResponse(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	Success(c, http.StatusOK, gin.H{"id": "123"})
	if w.Code != 200 { t.Fatalf("expected 200, got %d", w.Code) }
	// verify envelope structure
}
```

- [ ] **Step 2: Implement responses.go**

```go
package auth

import "github.com/gin-gonic/gin"

func Success(c *gin.Context, status int, data interface{}) {
	c.JSON(status, gin.H{"data": data, "meta": gin.H{"request_id": c.GetString("request_id")}})
}

func Error(c *gin.Context, status int, code string, message string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": message, "request_id": c.GetString("request_id")}})
}
```

- [ ] **Step 3: Run response tests → PASS**

- [ ] **Step 4: Write jwt.go test**

Test: GenerateTokenPair returns access + refresh; VerifyAccessToken returns claims; expired token fails.

- [ ] **Step 5: Implement jwt.go**

- [ ] **Step 6: Write verifier.go test**

Test: GenerateProof(V, nonce) == HMAC(V, nonce); ConstantTimeCompare works.

- [ ] **Step 7: Implement verifier.go**

- [ ] **Step 8: Run all server tests → PASS**

- [ ] **Step 9: Commit**

---

## Task 3: Server Middleware

**Files:**
- Create: `server/internal/auth/middleware.go`

**Interfaces:**
- Produces: `auth.JWTMiddleware(cfg)`, `auth.RequestID()`, `auth.RateLimit(max)`, `auth.CORS()`

- [ ] **Step 1: Write middleware test**

Test: RequestID adds ID to context; JWTMiddleware rejects missing/invalid token; RateLimit blocks over limit.

- [ ] **Step 2: Implement middleware.go**

- [ ] **Step 3: Run tests → PASS**

- [ ] **Step 4: Commit**

---

## Task 4: Server Prelogin + Register

**Files:**
- Create: `server/internal/auth/handlers.go`
- Modify: `server/cmd/termvault-server/main.go` (wire routes)

**Interfaces:**
- Produces: `auth.HandlePrelogin(db, cfg)`, `auth.HandleRegister(db, cfg)`

- [ ] **Step 1: Write prelogin handler test**

```go
// Prelogin with known email → 200 {nonce, kdf, server_salt, salt_cl}
// Prelogin with unknown email → 200 with random values
// Prelogin with empty body → 400
```

- [ ] **Step 2: Implement HandlePrelogin**

- [ ] **Step 3: Write register handler test**

```go
// Register new user → 201 {access_token, refresh_token, user}
// Register with existing email → 409
// Register with same user_id (idempotent) → 200
// Register with invalid body → 400/422
```

- [ ] **Step 4: Implement HandleRegister**

- [ ] **Step 5: Wire routes in main.go**

```go
auth := r.Group("/api/v1/auth")
auth.POST("/prelogin", handlers.HandlePrelogin(db, cfg))
auth.POST("/register", handlers.HandleRegister(db, cfg))
```

- [ ] **Step 6: Run tests → PASS**

- [ ] **Step 7: Manual smoke test: `go run ./cmd/termvault-server` → POST /api/v1/auth/prelogin → POST /api/v1/auth/register**

- [ ] **Step 8: Commit**

---

## Task 5: Server Login + Refresh + Logout + Me

**Files:**
- Modify: `server/internal/auth/handlers.go`

**Interfaces:**
- Produces: `auth.HandleLogin(db, cfg)`, `auth.HandleRefresh(db, cfg)`, `auth.HandleLogout(db, cfg)`, `auth.HandleMe(db)`

- [ ] **Step 1: Write login handler test**

```go
// Login with correct proof → 200 {access_token, refresh_token, user, keyring}
// Login with wrong proof → 401
// Login with non-existent email → 401 (generic)
// Rate limit → 429
```

- [ ] **Step 2: Implement HandleLogin**

- [ ] **Step 3: Write refresh handler test**

```go
// Refresh with valid token → 200 {new tokens}
// Refresh with expired token → 401
// Refresh with reused token → 401 + revoke all
```

- [ ] **Step 4: Implement HandleRefresh**

- [ ] **Step 5: Write logout handler test**

```go
// Logout → 204
// Logout with invalid token → 401
```

- [ ] **Step 6: Implement HandleLogout**

- [ ] **Step 7: Write /me handler test**

```go
// GET /me with valid token → 200 {id, email, name, initialized, auth_provider, created_at}
// GET /me without token → 401
```

- [ ] **Step 8: Implement HandleMe**

- [ ] **Step 9: Wire routes + run tests → PASS**

- [ ] **Step 8: Commit**

---

## Task 6: Server Password Change + Recovery

**Files:**
- Modify: `server/internal/auth/handlers.go`

**Interfaces:**
- Produces: `auth.HandlePasswordChange(db, cfg)`, `auth.HandleRecovery(db, cfg)`

- [ ] **Step 1: Write password change test**

```go
// Password change with valid old_proof → 204
// Password change with wrong old_proof → 401
// Password change → revokes all other sessions
```

- [ ] **Step 2: Implement HandlePasswordChange**

- [ ] **Step 3: Write recovery test**

```go
// Recovery with valid signature → 204
// Recovery with invalid signature → 401
// Recovery → replaces verifier + keyring
```

- [ ] **Step 4: Implement HandleRecovery**

- [ ] **Step 5: Wire routes + run tests → PASS**

- [ ] **Step 6: Commit**

---

## Task 7: Server OAuth

**Files:**
- Create: `server/internal/auth/oauth.go`
- Modify: `server/internal/auth/handlers.go`

**Interfaces:**
- Produces: `auth.HandleOAuthStart(db, cfg)`, `auth.HandleOAuthCallback(db, cfg)`, `auth.HandleOAuthExchange(db, cfg)`, `auth.HandleOAuthSetup(db, cfg)`

- [ ] **Step 1: Write OAuth start test**

```go
// Start with valid provider → 302 to provider
// Start with unknown provider → 400
```

- [ ] **Step 2: Implement HandleOAuthStart (Google + GitHub)**

- [ ] **Step 3: Write callback test**

```go
// Callback with valid code+state → 302 to termvault://
// Callback with invalid state → 302 to termvault://auth/error
// Callback with new user → creates user + setup_token
```

- [ ] **Step 4: Implement HandleOAuthCallback**

- [ ] **Step 5: Write exchange test**

```go
// Exchange with valid code → 200 {tokens, user, initialized}
// Exchange with expired code → 401
// Exchange with used code → 401
```

- [ ] **Step 6: Implement HandleOAuthExchange**

- [ ] **Step 7: Write setup test**

```go
// Setup with valid setup_token → 200 {tokens}
// Setup with expired token → 401
// Setup when already initialized → 409
```

- [ ] **Step 8: Implement HandleOAuthSetup**

- [ ] **Step 9: Wire routes + run tests → PASS**

- [ ] **Step 10: Commit**

---

## Task 8: Client Rust Crypto Commands

**Files:**
- Create: `client/src-tauri/src/crypto.rs`
- Modify: `client/src-tauri/src/lib.rs`
- Modify: `client/src-tauri/Cargo.toml`

**Interfaces:**
- Produces: Tauri commands matching spec §8.1 (generate_account_material, derive_kek, compute_login_proof, build_keyring_rows, encrypt_secret, decrypt_secret, unwrap_dek, recovery_unwrap_dek, sign_challenge, lock, unlock)

- [ ] **Step 1: Add Rust dependencies**

```toml
# client/src-tauri/Cargo.toml
argon2 = "0.5"
xchacha20poly1305 = "0.10"
x25519-dalek = { version = "2", features = ["static_secrets"] }
sha2 = "0.10"
hmac = "0.12"
zeroize = { version = "1", features = ["derive"] }
base64 = "0.22"
```

- [ ] **Step 2: Write crypto test (argon2 KDF roundtrip)**

```rust
// client/src-tauri/src/crypto.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_kek_deterministic() {
        let salt = [1u8; 16];
        let kek1 = derive_kek_bytes("password", &salt).unwrap();
        let kek2 = derive_kek_bytes("password", &salt).unwrap();
        assert_eq!(kek1, kek2);
    }
}
```

- [ ] **Step 3: Implement derive_kek_bytes (internal, not Tauri command)**

- [ ] **Step 4: Write encrypt/decrypt roundtrip test**

- [ ] **Step 5: Implement encrypt_secret / decrypt_secret**

- [ ] **Step 6: Write X25519 keypair + sign/verify test**

- [ ] **Step 7: Implement generate_account_material, sign_challenge**

- [ ] **Step 8: Write build_keyring_rows test**

- [ ] **Step 9: Implement build_keyring_rows, unwrap_dek, recovery_unwrap_dek**

- [ ] **Step 10: Implement lock / unlock (session state)**

- [ ] **Step 11: Register all Tauri commands in lib.rs**

- [ ] **Step 12: `cargo test` → PASS**

- [ ] **Step 13: `cargo check` → PASS (no warnings)**

- [ ] **Step 14: Commit**

---

## Task 9: Client Rust Keystore + DB

**Files:**
- Create: `client/src-tauri/src/keystore.rs`
- Create: `client/src-tauri/src/db.rs`
- Modify: `client/src-tauri/src/lib.rs`
- Modify: `client/src-tauri/Cargo.toml`

**Interfaces:**
- Produces: `keystore::save_refresh_token`, `keystore::load_refresh_token`, `keystore::save_remember_blob`, `keystore::load_remember_blob`, `keystore::clear`, `db::open`, `db::upsert_user_profile`, `db::upsert_keyring`, `db::upsert_vault`, `db::upsert_record`, `db::query_records`, `db::delete_record`

- [ ] **Step 1: Add keyring + rusqlite dependencies**

```toml
keyring = "3"
rusqlite = { version = "0.32", features = ["bundled"] }
```

- [ ] **Step 2: Write keystore test**

```rust
// save/load refresh token roundtrip
// save/load remember blob roundtrip
// clear removes everything
```

- [ ] **Step 3: Implement keystore.rs**

- [ ] **Step 4: Write db test**

```rust
// open creates tables
// upsert_user_profile roundtrip
// upsert_keyring roundtrip
// upsert_record + query_records roundtrip
// delete_record marks deleted
```

- [ ] **Step 5: Implement db.rs**

- [ ] **Step 6: Wire into lib.rs, `cargo test` → PASS**

- [ ] **Step 7: `cargo check` → PASS**

- [ ] **Step 8: Commit**

---

## Task 10: Client TS Crypto Wrappers

**Files:**
- Modify: `client/src/lib/crypto/crypto.ts`
- Modify: `client/src-tauri/src/lib.rs` (add invoke handlers if needed)

**Interfaces:**
- Produces: Same exported API shape as current stub, but calling Tauri commands

- [ ] **Step 1: Write crypto wrapper test (vitest)**

```typescript
// test that generateAccountMaterial returns salt_cl, recovery_code, public_key
// test that encryptSecret / decryptSecret roundtrip
```

- [ ] **Step 2: Implement crypto.ts wrappers**

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function generateAccountMaterial() {
  return invoke<{salt_cl: string; recovery_code: string; public_key: string}>('generate_account_material');
}

export async function deriveKek(password: string, saltCl: string) {
  return invoke<void>('derive_kek', { password, saltCl });
}

// ... etc
```

- [ ] **Step 3: `pnpm vitest` → PASS**

- [ ] **Step 4: Commit**

---

## Task 11: Client TS Auth API + Store

**Files:**
- Modify: `client/src/lib/api/auth.ts`
- Create: `client/src/stores/auth/authStore.ts`

**Interfaces:**
- Produces: `authApi.prelogin`, `authApi.register`, `authApi.login`, `authApi.refresh`, `authApi.logout`, `authApi.passwordChange`, `authApi.recovery`, `authApi.oauthExchange`, `authApi.setup`; `authStore` (Zustand)

- [ ] **Step 1: Write auth API test**

```typescript
// prelogin returns {nonce, kdf, server_salt, salt_cl}
// register returns {access_token, refresh_token, user}
// login returns {access_token, refresh_token, user, keyring}
// 401 on wrong password
// 429 on rate limit
```

- [ ] **Step 2: Implement auth.ts**

- [ ] **Step 3: Write auth store test**

```typescript
// register flow: prelogin → generate material → register → set tokens
// login flow: prelogin → compute proof → login → set tokens → unlock
// refresh flow: 401 → refresh → retry
// logout: clear tokens + local data
```

- [ ] **Step 4: Implement authStore.ts**

- [ ] **Step 5: `pnpm vitest` → PASS**

- [ ] **Step 6: Commit**

---

## Task 12: Client TS Auth Pages

**Files:**
- Create: `client/src/pages/auth/LoginPage.tsx`
- Create: `client/src/pages/auth/RegisterPage.tsx`
- Create: `client/src/pages/auth/SetupPage.tsx`
- Create: `client/src/pages/auth/RecoveryPage.tsx`
- Create: `client/src/pages/auth/RecoveryRevealModal.tsx`
- Modify: routing (add auth routes)

**Interfaces:**
- Consumes: `authStore`, `authApi`

- [ ] **Step 1: Create LoginPage (email + password + social buttons)**

- [ ] **Step 2: Create RegisterPage (email + name + password)**

- [ ] **Step 3: Create SetupPage (post-OAuth: set encryption password)**

- [ ] **Step 4: Create RecoveryPage (enter recovery code)**

- [ ] **Step 5: Create RecoveryRevealModal (show code + download kit)**

- [ ] **Step 6: Wire routes**

- [ ] **Step 7: `pnpm biome check .` → PASS**

- [ ] **Step 8: `pnpm tauri dev` → manual smoke test**

- [ ] **Step 9: Commit**

---

## Task 13: Integration Smoke Test

- [ ] **Step 1: Start server (`go run ./cmd/termvault-server`)**

- [ ] **Step 2: Start client (`pnpm tauri dev`)**

- [ ] **Step 3: Register → recovery kit download → logout → login → password change → logout → recovery restore**

- [ ] **Step 4: `pnpm build` + `cargo check` + `go vet` → all green**

- [ ] **Step 5: Final commit**
