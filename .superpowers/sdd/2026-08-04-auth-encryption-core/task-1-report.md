# Task 1 Report: Server Config + Models + Migration

## Status: DONE

## What was implemented

### Config (`server/internal/config/config.go`)
- `Config` struct with all environment variables from the spec
- `Load()` function that reads env vars with sensible defaults
- Support for `RATE_LIMIT_AUTH`, `RATE_LIMIT_API`, `TRUSTED_PROXIES` (comma-separated)

### Models (`server/internal/models/`)
- **user.go** - User model matching spec §7 schema (UUID PK, email, auth fields, KDF params, public key)
- **user_key.go** - UserKey model (keyring rows: dek_wrapped_by_kek, etc.)
- **refresh_token.go** - RefreshToken model with rotation/reuse detection fields
- **oauth_state.go** - OAuthState model with PKCE code_verifier support
- **auth_code.go** - AuthCode model for one-time codes (oauth_exchange, setup)
- **vault.go** - Vault model (personal/team kinds)
- **record.go** - Record model with soft delete for sync
- **models.go** - `AutoMigrate()` and `SeedPersonalVault()` functions

### Main (`server/cmd/termvault-server/main.go`)
- Updated to load config, connect GORM (SQLite via pure-Go driver), run AutoMigrate
- Uses `glebarez/sqlite` (no CGO required)

## Test Results

**5/5 passing:**
- `TestLoadDefaults` - Verifies default config values
- `TestLoadEnvOverrides` - Verifies env var overrides work
- `TestAutoMigrate` - Verifies all 7 tables are created
- `TestSeedPersonalVault` - Verifies idempotent vault seeding
- `TestUserModel` - Verifies user CRUD operations

## Files Changed
- Created: `server/internal/config/config.go`
- Created: `server/internal/config/config_test.go`
- Created: `server/internal/models/user.go`
- Created: `server/internal/models/user_key.go`
- Created: `server/internal/models/refresh_token.go`
- Created: `server/internal/models/oauth_state.go`
- Created: `server/internal/models/auth_code.go`
- Created: `server/internal/models/vault.go`
- Created: `server/internal/models/record.go`
- Created: `server/internal/models/models.go`
- Created: `server/internal/models/models_test.go`
- Modified: `server/cmd/termvault-server/main.go`

## Concerns
- Used `glebarez/sqlite` instead of `gorm.io/driver/sqlite` (mattn/go-sqlite3) because CGO was disabled in the build environment. Both are functionally equivalent for our use case.
