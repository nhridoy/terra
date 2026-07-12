# TermVault — Complete Implementation Plan

## 1. Project Overview

**TermVault** is an open-source, self-hosted SSH client and infrastructure management platform — a 1-to-1 replica of Termius with identical encryption, but self-hosted and open-source.

### Architecture

- **Server**: Self-hosted Go backend (API + SSH proxy + WebSocket sync)
- **Client**: Cross-platform desktop app (Tauri v2 + React + xterm.js)
- **Mobile**: React Native apps (iOS + Android)
- **Shared**: Common types and utilities

---

## 2. Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Server Language | **Go** | Fast, single binary, excellent SSH/SFTP libs |
| Server DB | **SQLite** (dev) / **PostgreSQL/MySQL** (prod) via **GORM** | Flexible, migration support |
| Server API | **Gin** router | Fast, idiomatic Go HTTP |
| Server Real-time | **Gorilla WebSocket** | SSH proxy + sync |
| Server Auth | **SRP6a** (Botan-compatible) | Match Termius auth protocol |
| Desktop Framework | **Tauri v2** (Rust backend) | 87% smaller than Electron, 4x less RAM |
| Desktop UI | **React 18+ TypeScript** + **Tailwind CSS** | Fast iteration, great ecosystem |
| Terminal Emulator | **xterm.js** + WebGL addon | Industry standard, GPU-accelerated |
| SSH Client | **ssh2** (Node.js) or **Rust SSH2** via Tauri commands | Proven, well-maintained |
| SFTP | **ssh2-sftp-client** | Works with SSH connection |
| Crypto Library | **Libsodium** (via libsodium.js / rust-sodium) | Match Termius exactly |
| Password Hashing | **Argon2id** (`OPSLIMIT_INTERACTIVE`, `MEMLIMIT_INTERACTIVE`) | Match Termius exactly |
| State Management | **Zustand** | Lightweight, fast |
| Local DB | **better-sqlite3** or **sql.js** | Encrypted local vault |
| Mobile | **React Native + Expo** | Code sharing with web UI |
| Docker | **Docker + docker-compose** | One-command server deployment |

---

## 3. Project Structure

```
termvault/
├── server/                          # Go backend
│   ├── cmd/
│   │   └── termvault-server/        # Entry point
│   │       └── main.go
│   ├── internal/
│   │   ├── api/                     # HTTP handlers
│   │   │   ├── auth.go              # Login, register, SRP6a
│   │   │   ├── hosts.go             # Host CRUD
│   │   │   ├── groups.go            # Group management
│   │   │   ├── vault.go             # Vault CRUD (encrypted blobs)
│   │   │   ├── keys.go              # Keychain management
│   │   │   ├── snippets.go          # Command snippets
│   │   │   ├── sessions.go          # Session logs
│   │   │   ├── workspaces.go        # Workspace save/restore
│   │   │   └── settings.go          # User settings
│   │   ├── auth/                    # Authentication
│   │   │   ├── srp.go               # SRP6a implementation
│   │   │   ├── jwt.go               # JWT issue/verify
│   │   │   ├── oauth.go             # OAuth2 providers
│   │   │   └── middleware.go        # Auth middleware
│   │   ├── db/                      # Database layer
│   │   │   ├── models.go            # GORM models
│   │   │   ├── migrations.go        # Auto-migration
│   │   │   └── sqlite.go            # SQLite driver
│   │   ├── ssh/                     # SSH proxy
│   │   │   ├── proxy.go             # WebSocket ↔ SSH bridge
│   │   │   ├── sftp.go              # SFTP server
│   │   │   └── portforward.go       # Port forwarding
│   │   ├── sync/                    # Real-time sync
│   │   │   ├── hub.go               # WebSocket hub
│   │   │   └── handler.go           # Sync protocol
│   │   └── config/
│   │       └── config.go            # Env-based config
│   ├── migrations/                  # SQL migrations
│   ├── go.mod
│   ├── go.sum
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── client/                          # Tauri desktop app
│   ├── src-tauri/                   # Rust backend
│   │   ├── src/
│   │   │   ├── main.rs              # Tauri entry
│   │   │   ├── ssh.rs               # SSH client (Rust)
│   │   │   ├── sftp.rs              # SFTP client
│   │   │   ├── pty.rs               # PTY management
│   │   │   ├── crypto.rs            # Libsodium bindings
│   │   │   ├── vault.rs             # Local vault DB
│   │   │   └── keychain.rs          # OS keychain integration
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   │
│   ├── src/                         # React frontend
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TitleBar.tsx
│   │   │   │   └── StatusBar.tsx
│   │   │   ├── terminal/
│   │   │   │   ├── Terminal.tsx
│   │   │   │   ├── TerminalTabs.tsx
│   │   │   │   ├── SplitView.tsx
│   │   │   │   └── FocusMode.tsx
│   │   │   ├── hosts/
│   │   │   │   ├── HostList.tsx
│   │   │   │   ├── HostCard.tsx
│   │   │   │   ├── HostForm.tsx
│   │   │   │   └── HostDetails.tsx
│   │   │   ├── vault/
│   │   │   │   ├── VaultList.tsx
│   │   │   │   ├── VaultItem.tsx
│   │   │   │   └── VaultForm.tsx
│   │   │   ├── sftp/
│   │   │   │   ├── FileBrowser.tsx
│   │   │   │   ├── FileTransfer.tsx
│   │   │   │   └── FilePreview.tsx
│   │   │   ├── keychain/
│   │   │   │   ├── KeyList.tsx
│   │   │   │   ├── KeyGen.tsx
│   │   │   │   └── KeyImport.tsx
│   │   │   ├── snippets/
│   │   │   │   ├── SnippetList.tsx
│   │   │   │   └── SnippetForm.tsx
│   │   │   └── settings/
│   │   │       ├── ThemeSettings.tsx
│   │   │       ├── KeyboardSettings.tsx
│   │   │       └── ServerSettings.tsx
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   ├── hostStore.ts
│   │   │   ├── terminalStore.ts
│   │   │   ├── vaultStore.ts
│   │   │   └── settingsStore.ts
│   │   ├── hooks/
│   │   │   ├── useSSH.ts
│   │   │   ├── useSFTP.ts
│   │   │   ├── useVault.ts
│   │   │   └── useTheme.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── crypto.ts
│   │   │   ├── sync.ts
│   │   │   └── themes.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── mobile/                          # React Native app
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── HostsScreen.tsx
│   │   │   ├── TerminalScreen.tsx
│   │   │   ├── SFTPScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── components/
│   │   ├── stores/
│   │   └── lib/
│   ├── app.json
│   └── package.json
│
├── shared/                          # Shared types/utils
│   ├── types/
│   │   ├── host.ts
│   │   ├── vault.ts
│   │   ├── user.ts
│   │   └── api.ts
│   └── utils/
│       └── encryption.ts
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── encryption.md
│   └── deployment.md
│
├── .github/
│   └── workflows/
│       ├── server-ci.yml
│       ├── client-ci.yml
│       └── release.yml
│
├── LICENSE                          # MIT
├── README.md
└── CONTRIBUTING.md
```

---

## 4. Database Schema

### Core Tables (PostgreSQL/SQLite)

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255),           -- SRP6a verifier
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth connections
CREATE TABLE oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

-- Teams/Organizations
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    public_key TEXT,                        -- User's X25519 public key
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- Hosts (SSH connections)
CREATE TABLE hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    group_id UUID,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    port INT DEFAULT 22,
    username VARCHAR(100),
    tags JSONB DEFAULT '[]',
    color VARCHAR(7),
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Host groups (hierarchical)
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    parent_id UUID REFERENCES groups(id),
    name VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vault (encrypted credentials)
CREATE TABLE vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    encrypted_data BYTEA NOT NULL,
    iv BYTEA NOT NULL,
    salt BYTEA NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keychain (SSH keys, certificates)
CREATE TABLE keychain (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    name VARCHAR(255) NOT NULL,
    key_type VARCHAR(20) NOT NULL,
    public_key TEXT NOT NULL,
    encrypted_private_key BYTEA,
    fingerprint VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Command snippets
CREATE TABLE snippets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    command TEXT NOT NULL,
    description TEXT,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session logs
CREATE TABLE session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    host_id UUID REFERENCES hosts(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    data BYTEA,
    size_bytes BIGINT
);

-- Workspaces
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    layout JSONB NOT NULL,
    host_ids JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(50) DEFAULT 'dark',
    font_family VARCHAR(100) DEFAULT 'JetBrains Mono',
    font_size INT DEFAULT 14,
    cursor_style VARCHAR(20) DEFAULT 'block',
    keybindings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Encryption Architecture (Termius-Matched)

### Crypto Stack (Identical to Termius)

| Component | Algorithm | Parameters |
|-----------|-----------|------------|
| Crypto Library | **Libsodium 1.0.20** | X25519, XSalsa20, Poly1305 |
| Auth Protocol | **SRP6a** (Botan-compatible) | 2048-bit prime |
| Password Hashing | **Argon2id** | `OPSLIMIT_INTERACTIVE` (t=2), `MEMLIMIT_INTERACTIVE` (64 MiB) |
| Public-key Encryption | **crypto_box** | X25519 + XSalsa20 + Poly1305 |
| Secret-key Encryption | **crypto_secretbox** | XSalsa20 + Poly1305 |
| Nonce Generation | **randombytes_buf** | 24 bytes (crypto_box) / 24 bytes (crypto_secretbox) |
| Transport | **gRPC over TLS 1.2** | AES-256-GCM |

### Key Derivation (Identical to Termius)

```javascript
// Termius uses Libsodium's crypto_pwhash with:
//   OPSLIMIT_INTERACTIVE = 2
//   MEMLIMIT_INTERACTIVE = 67108864 (64 MiB)
//   ALG = ARGON2ID13

// TermVault identical config:
import { argon2id } from 'libsodium-wrappers';

const deriveKey = async (password, salt) => {
  return argon2id(
    password,
    salt,
    2,              // OPSLIMIT_INTERACTIVE (iterations)
    67108864,       // MEMLIMIT_INTERACTIVE (64 MiB)
    32              // output key length
  );
};
```

### Account Creation Flow

```
┌─────────────────────────────────────────────────────────┐
│                    ACCOUNT CREATION                      │
│                                                         │
│  1. Generate random key pair (X25519)                   │
│     → publicKey + privateKey                            │
│                                                         │
│  2. Generate personal encryption key (random 32 bytes)  │
│                                                         │
│  3. Encrypt personal key with public key:               │
│     encryptedPersonalKey = crypto_box_easy(             │
│       personalKey, publicKey, privateKey                │
│     )                                                   │
│                                                         │
│  4. Derive key from password:                           │
│     derivedKey = Argon2id(password, salt, 2, 64MiB)     │
│                                                         │
│  5. Encrypt private key with derived key:               │
│     encryptedPrivateKey = crypto_secretbox_easy(        │
│       privateKey, nonce, derivedKey                     │
│     )                                                   │
│                                                         │
│  6. SRP6a: Generate verifier from password              │
│                                                         │
│  7. Store on server:                                    │
│     { encryptedPrivateKey, publicKey, nonce, salt,      │
│       srpVerifier, srpSalt }                            │
│                                                         │
│  Server NEVER sees plaintext password or keys           │
└─────────────────────────────────────────────────────────┘
```

### Vault Unlock Flow

```
┌─────────────────────────────────────────────────────────┐
│                    VAULT UNLOCK                          │
│                                                         │
│  1. User enters password                                │
│                                                         │
│  2. SRP6a handshake (password never transmitted)        │
│     → Authenticated, get encrypted keys from server     │
│                                                         │
│  3. Derive key from password:                           │
│     derivedKey = Argon2id(password, storedSalt, 2, 64M) │
│                                                         │
│  4. Decrypt private key:                                │
│     privateKey = crypto_secretbox_open_easy(            │
│       encryptedPrivateKey, nonce, derivedKey            │
│     )                                                   │
│                                                         │
│  5. Decrypt personal encryption key:                    │
│     personalKey = crypto_box_open_easy(                 │
│       encryptedPersonalKey, privateKey, publicKey      │
│     )                                                   │
│                                                         │
│  6. Decrypt vault data:                                 │
│     plaintext = crypto_secretbox_open_easy(             │
│       ciphertext, nonce, personalKey                    │
│     )                                                   │
│                                                         │
│  Keys exist only in memory during active session        │
└─────────────────────────────────────────────────────────┘
```

### Team Vault Sharing

```
┌─────────────────────────────────────────────────────────┐
│                    TEAM VAULT SHARING                     │
│                                                         │
│  Owner invites Alice:                                   │
│                                                         │
│  1. Generate random teamVaultKey                        │
│                                                         │
│  2. Encrypt teamVaultKey with Alice's public key:       │
│     encryptedForAlice = crypto_box_easy(                │
│       teamVaultKey, alicePublicKey, ownerPrivateKey     │
│     )                                                   │
│                                                         │
│  3. Create MAC with owner's private key:                │
│     mac = crypto_generichash(                           │
│       teamVaultKey, ownerPublicKey                      │
│     )                                                   │
│                                                         │
│  4. Store on server:                                    │
│     { vaultId, memberId: "alice",                       │
│       encryptedKey: encryptedForAlice, mac }            │
│                                                         │
│  Alice decrypts:                                        │
│  1. Get encryptedKey from server                        │
│  2. Decrypt with her private key:                       │
│     teamVaultKey = crypto_box_open_easy(                │
│       encryptedForAlice, alicePrivateKey, ownerPubKey   │
│     )                                                   │
│  3. Verify MAC with owner's public key                  │
│  4. Use teamVaultKey to decrypt vault contents          │
└─────────────────────────────────────────────────────────┘
```

### Local Key Storage

| Platform | Storage Method |
|----------|---------------|
| **iOS** | Keychain (hardware-backed) |
| **Android** | Encrypted SharedPreferences + Android Keystore |
| **macOS** | OS Keychain (via keytar/tauri-plugin-stronghold) |
| **Windows** | OS Credential Manager |
| **Linux** | Secret Service API (GNOME Keyring / KDE Wallet) |

---

## 6. Server Architecture

### API Endpoints

```
POST   /api/auth/register          # Register user
POST   /api/auth/login             # SRP6a login
POST   /api/auth/refresh           # Refresh JWT
GET    /api/auth/oauth/:provider   # OAuth redirect
POST   /api/auth/oauth/callback    # OAuth callback

GET    /api/hosts                  # List hosts
POST   /api/hosts                  # Create host
PUT    /api/hosts/:id              # Update host
DELETE /api/hosts/:id              # Delete host

GET    /api/groups                 # List groups
POST   /api/groups                 # Create group
PUT    /api/groups/:id             # Update group
DELETE /api/groups/:id             # Delete group

GET    /api/vaults                 # List vaults
POST   /api/vaults                 # Create vault (encrypted blob)
PUT    /api/vaults/:id             # Update vault
DELETE /api/vaults/:id             # Delete vault

GET    /api/keys                   # List SSH keys
POST   /api/keys                   # Import/generate key
DELETE /api/keys/:id               # Delete key

GET    /api/snippets               # List snippets
POST   /api/snippets               # Create snippet
PUT    /api/snippets/:id           # Update snippet
DELETE /api/snippets/:id           # Delete snippet

GET    /api/workspaces             # List workspaces
POST   /api/workspaces             # Create workspace
PUT    /api/workspaces/:id         # Update workspace
DELETE /api/workspaces/:id         # Delete workspace

GET    /api/sessions               # List session logs
GET    /api/sessions/:id           # Get session recording

GET    /api/settings               # Get user settings
PUT    /api/settings               # Update settings

GET    /api/teams                  # List teams
POST   /api/teams                  # Create team
POST   /api/teams/:id/members      # Add team member

WS     /ws/ssh                     # SSH proxy (WebSocket)
WS     /ws/sync                    # Real-time sync
```

### WebSocket Protocol (SSH Proxy)

```
Client → Server:
{
  "type": "connect",
  "host_id": "uuid",
  "columns": 120,
  "rows": 40
}

Client → Server:
{
  "type": "input",
  "data": "ls -la\n"
}

Server → Client:
{
  "type": "output",
  "data": "total 48\ndrwxr-xr-x..."
}

Client → Server:
{
  "type": "resize",
  "cols": 120,
  "rows": 40
}

Server → Client:
{
  "type": "disconnect",
  "reason": "host_unreachable"
}
```

---

## 7. Desktop Client Architecture (Tauri)

### Rust Backend Responsibilities

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // SSH commands
            ssh::connect,
            ssh::disconnect,
            ssh::send_input,
            ssh::resize,
            // SFTP commands
            sftp::list_dir,
            sftp::download,
            sftp::upload,
            sftp::delete,
            // Vault commands
            vault::encrypt,
            vault::decrypt,
            vault::derive_key,
            // Keychain commands
            keychain::generate_key,
            keychain::import_key,
            keychain::export_public,
            // PTY commands
            pty::spawn,
            pty::write,
            pty::resize,
        ])
        .run(tauri::generate_context!())
}
```

### React Component Tree

```
App
├── AuthProvider
│   ├── LoginScreen (if not authenticated)
│   │   ├── SRPForm (email + password)
│   │   └── OAuthButtons (GitHub, Google)
│   │
│   └── MainLayout (if authenticated)
│       ├── TitleBar (custom)
│       ├── Sidebar
│       │   ├── SearchBar
│       │   ├── QuickConnect
│       │   ├── HostsTree
│       │   │   └── GroupNode → HostCard[]
│       │   ├── VaultsList
│       │   ├── KeychainList
│       │   ├── SnippetsList
│       │   └── SettingsButton
│       │
│       ├── MainContent
│       │   ├── TerminalView
│       │   │   ├── TabBar
│       │   │   ├── Terminal[] (xterm.js instances)
│       │   │   └── SplitView (optional)
│       │   │
│       │   ├── SFTPView (when active)
│       │   │   ├── FileTree
│       │   │   ├── FileList
│       │   │   └── TransferQueue
│       │   │
│       │   └── HostDetailsPanel (slide-in)
│       │
│       └── StatusBar
│           ├── ConnectionStatus
│           ├── ActiveHost
│           └── ThemeToggle
```

### Theme System

```typescript
// themes.ts
export const themes = {
  dark: {
    name: 'Dark',
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    selection: 'rgba(130, 170, 255, 0.3)',
  },
  light: {
    name: 'Light',
    background: '#ffffff',
    foreground: '#343a40',
  },
  dracula: { /* ... */ },
  solarized: { /* ... */ },
  nord: { /* ... */ },
  monokai: { /* ... */ },
}
```

---

## 8. Performance Targets

| Metric | Termius | TermVault Target |
|--------|---------|------------------|
| Bundle Size | ~120 MB | **< 20 MB** |
| Idle RAM | ~200 MB | **< 60 MB** |
| Startup Time | ~3 s | **< 1 s** |
| SSH Connect | ~2 s | **< 500 ms** |
| Terminal Latency | ~18 ms | **< 10 ms** |

### Optimization Strategies

1. **Tauri over Electron**: Native Rust backend, system webview
2. **Lazy loading**: Load tabs on demand, not all at once
3. **Streaming encryption**: Encrypt/decrypt in chunks, not whole vault
4. **Connection pooling**: Reuse SSH connections across tabs
5. **WebGL terminal rendering**: GPU-accelerated xterm.js
6. **WASM crypto**: WebAssembly for client-side encryption

---

## 9. Deployment

### Docker Compose (Server)

```yaml
version: '3.8'
services:
  termvault:
    image: termvault/server:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=sqlite:///data/termvault.db
      - JWT_SECRET=${JWT_SECRET}
      - OAUTH_GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - OAUTH_GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - OAUTH_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - OAUTH_GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    volumes:
      - termvault-data:/data
    restart: unless-stopped

volumes:
  termvault-data:
```

### Desktop Client Distribution

| Platform | Format |
|----------|--------|
| Windows | MSI installer, Portable ZIP |
| macOS | DMG, Homebrew cask |
| Linux | AppImage, Deb, RPM, Flatpak, AUR |

---

## 10. Phased Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Project setup (Go server, Tauri client scaffolding)
- [ ] Database schema + migrations
- [ ] User auth (SRP6a, register, login, JWT)
- [ ] Host CRUD API
- [ ] Basic Tauri shell with sidebar
- [ ] xterm.js terminal integration
- [ ] SSH connection via WebSocket proxy
- [ ] Libsodium integration (client + server)

### Phase 2: Core Features (Weeks 5-8)
- [ ] Group management (hierarchical)
- [ ] Vault system (encrypted CRUD)
- [ ] Keychain (generate, import SSH keys)
- [ ] Snippets system
- [ ] SFTP file browser
- [ ] Connection status indicators
- [ ] Local key storage (OS keychain)

### Phase 3: Advanced UI (Weeks 9-12)
- [ ] Tab management
- [ ] Split view
- [ ] Focus mode
- [ ] Workspace save/restore
- [ ] Host details panel
- [ ] Quick connect bar
- [ ] Command autocomplete

### Phase 4: Collaboration (Weeks 13-16)
- [ ] Teams system
- [ ] Shared vaults (zero-knowledge)
- [ ] Team host sharing
- [ ] Session logging
- [ ] OAuth providers (GitHub, Google)

### Phase 5: Polish & Mobile (Weeks 17-20)
- [ ] Theme system (20+ themes)
- [ ] Keyboard shortcuts
- [ ] Port forwarding UI
- [ ] Docker deployment
- [ ] React Native mobile app
- [ ] Biometric auth (mobile)

### Phase 6: Release (Weeks 21-24)
- [ ] Documentation
- [ ] CI/CD pipelines
- [ ] Auto-updater
- [ ] App store submissions
- [ ] Community guidelines

---

## 11. Competitive Advantages over Termius

| Feature | Termius | TermVault |
|---------|---------|-----------|
| Self-hosted | ❌ Cloud only | ✅ Full control |
| Open source | ❌ Proprietary | ✅ MIT license |
| E2EE | ✅ | ✅ (identical) |
| Bundle size | ~120 MB | < 20 MB |
| RAM usage | ~200 MB | < 60 MB |
| Startup | ~3 s | < 1 s |
| Free tier | Limited | **Unlimited** |
| Team vaults | Paid | **Free** |
| Session logs | Paid | **Free** |
| Multiplayer | Paid | **Free** (Phase 5+) |

---

## 12. Environment Variables

```bash
# Server Configuration
TERMVAULT_PORT=8080
TERMVAULT_HOST=0.0.0.0

# Database
DATABASE_URL=sqlite:///data/termvault.db
# DATABASE_URL=postgres://user:pass@localhost:5432/termvault
# DATABASE_URL=mysql://user:pass@localhost:3306/termvault

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=24h

# OAuth (user-configurable)
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=

# Encryption (do not change after first run)
ENCRYPTION_SALT=auto-generated-on-first-run
```

---

## 13. Security Checklist

- [ ] All data encrypted with Libsodium (XSalsa20 + Poly1305)
- [ ] Password hashing with Argon2id (64 MiB, t=2)
- [ ] SRP6a authentication (password never transmitted)
- [ ] TLS 1.2 for all transport
- [ ] Local keys stored in OS keychain
- [ ] Zero-knowledge vault sync
- [ ] Server cannot decrypt user data
- [ ] Keys zeroized after use
- [ ] No sensitive data in logs
- [ ] Rate limiting on auth endpoints
- [ ] CORS properly configured
- [ ] Input validation on all endpoints

---

## 14. Testing Strategy

- **Unit Tests**: Go tests for server, Jest for client
- **Integration Tests**: API endpoint tests
- **E2E Tests**: Playwright for desktop, Detox for mobile
- **Security Tests**: OWASP ZAP, dependency scanning
- **Performance Tests**: Load testing with k6

---

## 15. Documentation

- `docs/architecture.md` - System architecture
- `docs/api.md` - API reference
- `docs/encryption.md` - Encryption deep dive
- `docs/deployment.md` - Deployment guide
- `docs/contributing.md` - Contribution guidelines
- `README.md` - Project overview
