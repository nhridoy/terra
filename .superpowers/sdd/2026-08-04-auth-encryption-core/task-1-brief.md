# Task 1: Server Config + Models + Migration

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

## Steps

1. Add dependencies:
```bash
cd server && go get gorm.io/gorm gorm.io/driver/sqlite github.com/joho/godotenv github.com/google/uuid github.com/golang-jwt/jwt/v5 golang.org/x/crypto golang.org/x/oauth2
```

2. Create `server/internal/config/config.go`:
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

3. Create `server/internal/models/user.go`:
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

4. Create `server/internal/models/user_key.go`:
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

5. Create remaining models (`refresh_token.go`, `oauth_state.go`, `auth_code.go`, `vault.go`, `record.go`) following the spec schema exactly (§7 of the design spec at `docs/superpowers/specs/2026-08-04-auth-encryption-core-design.md`).

6. Create `server/internal/models/models.go`:
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

7. Update `server/cmd/termvault-server/main.go`: Replace hello-world with config → GORM → AutoMigrate → router skeleton.

8. Run `go vet ./...` to verify.

9. Commit.
