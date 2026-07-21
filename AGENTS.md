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
3. Client stores tokens via `tauri-plugin-store` (OS keychain-backed)
4. Auto-refresh: check expiry before API calls, refresh if needed
5. On 401 → attempt refresh → retry → if refresh fails → login screen

## Encryption

- Master password set during signup → derive key via Argon2id
- All sensitive data encrypted client-side before storage/server
- Server receives only encrypted blobs (zero-knowledge)
- Recovery kit: downloadable encrypted file for master password recovery

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

### Client

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Default server URL | `http://localhost:8080` |
