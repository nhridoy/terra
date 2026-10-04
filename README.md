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

The published server container is `ghcr.io/nhridoy/terra-server`:

```bash
docker pull ghcr.io/nhridoy/terra-server:latest
```

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.production.yml up -d
```

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

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TERRA_PORT` | Server port | `8080` |
| `TERRA_HOST` | Server host | `0.0.0.0` |
| `TERRA_APP_SCHEME` | Desktop OAuth app-scheme fallback | `terra` |
| `TERRA_OAUTH_REDIRECT_URIS` | Allowed desktop OAuth loopback callbacks | `http://127.0.0.1:1421/oauth/callback,http://127.0.0.1:1422/oauth/callback,http://127.0.0.1:1423/oauth/callback` |
| `DATABASE_URL` | Database connection | `sqlite:///data/terra.db` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRY` | JWT token expiry | `24h` |
| `BASE_URL` | Public URL | `http://localhost:8080` |

The server accepts the Terra environment variable names above. The default SQLite database is `terra.db`; an explicit `DATABASE_URL` selects any other configured database directly.

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
