# TermVault — Agent Instructions

Open-source Termius alternative. Tauri v2 desktop + Go server. Local-first, encrypted, self-hostable.

## Commands

```bash
# Client dev (starts Vite + Tauri)
cd client && pnpm tauri dev

# Client lint
cd client && pnpm biome check .

# Client test
cd client && pnpm vitest

# Server dev (hot-reload via air)
cd server && air

# Server dev (no hot-reload)
cd server && go run ./cmd/termvault-server

# Server vet
cd server && go vet ./...

# Server test
cd server && go test ./...
```

## Architecture

- `client/src-tauri/` — Rust backend (Tauri commands: SSH, vault encryption, auth tokens)
- `client/src/` — React frontend (Zustand stores, xterm.js terminal)
- `server/internal/` — Go API (Gin + GORM, auth, CRUD)
- Both `client/` and `server/` have their own `.env` files

## Key Quirks

- **pnpm only** — never npm
- Tauri v2 uses ACL-based capabilities in `capabilities/default.json`
- Tauri IPC errors appear as `tauri-error` header in network tab (non-zero value = error)
- GORM AutoMigrate runs on server startup — no manual migration files
- `biome.json` enforces single quotes, space indent
- Server `.env` may contain real credentials — never commit
- All crypto: Argon2id + ChaCha20Poly1305 (Termius-compatible)
- SSH connections are direct client→remote (server does NOT proxy SSH)
- Server stores/syncs config only, never sees plaintext credentials

## Database

- Server: GORM with `DATABASE_URL` env — supports SQLite (dev), PostgreSQL, MySQL
- Client: SQLite via rusqlite (encrypted at rest)
- Schema is identical on both sides — mirror models

## Auth Flow

1. Register → server creates user + default vaults (Personal, Team)
2. Login → server returns access token (15min) + refresh token (30d)
3. Client stores secrets (refresh token, saved password) via `tauri-plugin-keyring-store` (OS keychain); settings/state JSON via `tauri-plugin-store`
4. Auto-refresh: check expiry before API calls, refresh if needed
5. On 401 → attempt refresh → retry → if refresh fails → login screen

## Encryption

- Password set during signup → derive key via Argon2id
- All sensitive data encrypted client-side before storage/server
- Server receives only encrypted blobs (zero-knowledge)
- Recovery kit: downloadable encrypted file for password recovery

## Env Vars

### Server

| Variable | Description | Default |
|----------|-------------|---------|
| `TERMVAULT_PORT` | Server port | `8080` |
| `TERMVAULT_HOST` | Bind address | `0.0.0.0` |
| `DATABASE_URL` | DB connection string | `sqlite://termvault.db` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRY` | Access token lifetime | `15m` |
| `REFRESH_TOKEN_EXPIRY` | Refresh token lifetime | `720h` (30d) |
| `BASE_URL` | Public URL for OAuth callbacks | `http://localhost:8080` |
| `REDIS_URL` | Optional Redis for multi-instance | empty (in-memory) |
| `RATE_LIMIT_AUTH` | Requests/min for register/login | `10` |
| `RATE_LIMIT_API` | Requests/min for sync/refresh | `30` |
| `TRUSTED_PROXIES` | Comma-separated CIDRs of reverse proxies | empty (no proxy) |
| `OAUTH_REDIRECT_BASE` | Public base URL for provider callbacks | `BASE_URL` |
| `OAUTH_GOOGLE_CLIENT_ID` | Google OAuth client ID | empty (Google login disabled) |
| `OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth client secret | empty |
| `OAUTH_GITHUB_CLIENT_ID` | GitHub OAuth client ID | empty (GitHub login disabled) |
| `OAUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | empty |
| `TERMVAULT_OAUTH_REDIRECT_URIS` | Comma-separated allowlist of desktop app callback URIs | `http://127.0.0.1:142{1,2,3}/oauth/callback` |
| `REQUIRE_EMAIL_VERIFICATION` | Require OTP email verification for password signups (`true`/`1`/`yes`) | `false` (off) |
| `SMTP_HOST` | SMTP server hostname for verification emails (empty = OTP logged to console) | empty |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` | SMTP auth username | empty |
| `SMTP_PASSWORD` | SMTP auth password | empty |
| `SMTP_FROM` | From address for verification emails | empty |

### Client

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Default server URL | `http://localhost:8080` |
| `VITE_KEYCHAIN_INACTIVE_DAYS` | Keychain purge after N days unused | `14` |
| `VITE_KEYCHAIN_MAX_AGE_DAYS` | Keychain purge after N days since save | `90` |

Client keychain policy (auto-unlock renewal): 14-day inactivity / 90-day absolute cap, constants in `src/lib/keychain/keychain.ts`. Debug overrides: `inactive_days` / `max_age_days` keys in the `keychain-meta.json` store file (app data dir; `0` = always prompt, no rebuild needed). `alwaysAsk` toggle persisted in the `auth.json` store file (`alwaysAsk`, `apiUrl`, `deviceId`); turning it ON purges the saved keychain entry (toggle-off then requires a manual unlock before auto-unlock resumes). API URL override is also in `auth.json` (`apiUrl`, memory-cached for sync reads). Refresh-token rotation: the client persists rotated refresh tokens to the OS keychain immediately (auto-refresh setter), otherwise the server's reuse detection would revoke the stored copy and log the user out on next launch.
