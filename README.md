# Terra

Open-source, self-hosted SSH client with 1-to-1 Termius encryption compatibility.

## Features

- **SSH Terminal**: Full terminal emulation with split views, tabs, and focus mode
- **SFTP Browser**: Visual file management with drag-and-drop, preview, and transfer
- **Vault**: Encrypted credential storage (hosts, keys, snippets)
- **Port Forwarding**: Local, remote, and dynamic tunneling
- **Team Collaboration**: Shared vaults, team management, session logging
- **Desktop**: Windows, macOS, and Linux; the separate mobile app keeps its current identity
- **Self-Hosted**: Full control over your data

## Encryption

Terra uses the same encryption as Termius:

- **Authentication**: SRP6a (2048-bit prime)
- **Key Exchange**: X25519
- **Encryption**: XSalsa20 + Poly1305 (libsodium)
- **Key Derivation**: Argon2id (OPSLIMIT=2, MEMLIMIT=64MB)

## Quick Start

### Desktop

```bash
# Clone
git clone https://github.com/nhridoy/terra.git
cd terra

# Install dependencies
cd client && pnpm install

# Start development
pnpm tauri dev
```

### Server

```bash
cd server

# Install dependencies
go mod download

# Run server
go run ./cmd/terra-server
```

### Docker

The server image is published as `ghcr.io/nhridoy/terra-server`.

```bash
cd server
cp .env.example .env
# Set JWT_SECRET, BASE_URL, and a production DATABASE_URL in .env
docker compose up -d --build

# Or run the published image instead of building locally
docker compose pull
docker compose up -d
```

SQLite is supported for local development. Production deployments must use PostgreSQL, for example:

```dotenv
DATABASE_URL=postgres://terra:change-me@db.example.com:5432/terra?sslmode=require
```

Compose publishes port `8080` by default (`TERRA_HTTP_PORT`). Put the server behind a TLS-terminating reverse proxy, then set `BASE_URL`, `TRUSTED_PROXIES`, and `TERRA_BIND_IP=127.0.0.1` as needed. The `terra-data` volume is only used by SQLite.

### Mobile

```bash
cd mobile

# Install dependencies
npm install

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

## Desktop Releases

Pushing a `v*` tag runs the `Release` workflow. It builds the signed desktop apps, the server archive, and the GHCR image, then publishes a GitHub Release. Tags with a `-` (such as `v0.0.1-alpha.1`) become prereleases and do not replace the `latest` server image. See the [desktop release runbook](docs/UPDATER_RELEASE_RUNBOOK.md) for one-time setup, artifact checks, and updater signing.

The tag must equal `v` + the version in `client/src-tauri/tauri.conf.json`, or the workflow stops before building. The `Release` environment must contain the secret `TAURI_SIGNING_PRIVATE_KEY` (plus `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key has one) and the variable `VITE_API_URL`.

Run from the monorepo root, in this order (the tag builds whichever client commit the monorepo points to):

```bash
VERSION=0.0.1-alpha.1

# 1. Bump the version in the client repo and push it
#    (client/package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml,
#     and the `terra` entry in src-tauri/Cargo.lock)
cd client
git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "chore(release): set version $VERSION"
git push origin main
cd ..

# 2. Commit the new client pointer in the monorepo and push it
git add client
git commit -m "chore(release): Terra $VERSION"
git push origin main
git submodule status   # the client line must show the commit pushed in step 1

# 3. Tag and push. This starts the Release workflow
git tag -a "v$VERSION" -m "Terra $VERSION"
git push origin "v$VERSION"

# 4. Watch the run
gh run watch
```

If the run fails before a release is published, delete the tag, push the fix, and tag again:

```bash
git tag -d "v$VERSION"
git push origin ":refs/tags/v$VERSION"
```

After a release has been published, never reuse its version. Ship the fix as the next version (for example `0.0.1-alpha.2`).

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TERRA_PORT` | Server port | `8080` |
| `TERRA_HOST` | Server host | `0.0.0.0` |
| `TERRA_APP_SCHEME` | Desktop OAuth app-scheme fallback | `terra` |
| `TERRA_OAUTH_REDIRECT_URIS` | Allowed desktop OAuth loopback callbacks | `http://127.0.0.1:1421/oauth/callback,http://127.0.0.1:1422/oauth/callback,http://127.0.0.1:1423/oauth/callback` |
| `DATABASE_URL` | Database connection (SQLite for dev, PostgreSQL for production) | `sqlite://terra.db` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRY` | JWT token expiry | `15m` |
| `BASE_URL` | Public URL | `http://localhost:8080` |

The server accepts the Terra environment variable names above. The default SQLite database is `terra.db` for local development; production deployments should set `DATABASE_URL` to a `postgres://` connection string.

### OAuth Providers

| Provider | Variables |
|----------|-----------|
| GitHub | `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` |
| Google | `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET` |
| GitLab | `OAUTH_GITLAB_CLIENT_ID`, `OAUTH_GITLAB_CLIENT_SECRET` |
| Microsoft | `OAUTH_MICROSOFT_CLIENT_ID`, `OAUTH_MICROSOFT_CLIENT_SECRET` |

## API Documentation

### Authentication

```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Hosts

```bash
# List hosts
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/hosts

# Create host
curl -X POST http://localhost:8080/api/hosts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Server","hostname":"192.168.1.100","port":22,"username":"root"}'
```

## Architecture

```
terra/
├── server/           # Go API server + SSH proxy
│   ├── cmd/         # Entry point
│   ├── internal/    # Core logic
│   └── Dockerfile
├── client/          # Tauri v2 + React desktop app
│   ├── src/        # React components
│   └── src-tauri/  # Rust backend
├── mobile/          # React Native app
│   ├── src/        # Screens + stores
│   └── App.tsx
└── shared/          # Shared utils (encryption)
```

## Security

- End-to-end encryption with Termius-compatible algorithms
- Zero-knowledge architecture (server never sees plaintext)
- Biometric authentication on mobile
- Secure credential storage with libsodium

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- GitHub Issues: https://github.com/nhridoy/terra/issues
