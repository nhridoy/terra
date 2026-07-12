# Architecture

## Overview

TermVault consists of three main components:

1. **Server** (Go) - Self-hosted backend
2. **Desktop Client** (Tauri + React) - Cross-platform app
3. **Mobile Client** (React Native) - iOS/Android apps

## Server Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Server Architecture                   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                   HTTP API                       │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │  Auth   │ │  Hosts  │ │ Vault   │           │    │
│  │  │ (SRP6a) │ │  CRUD   │ │  CRUD   │           │    │
│  │  └─────────┘ └─────────┘ └─────────┘           │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │                 WebSocket Hub                    │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │  SSH    │ │  Sync   │ │ Realtime│           │    │
│  │  │ Proxy   │ │ Protocol│ │ Updates │           │    │
│  │  └─────────┘ └─────────┘ └─────────┘           │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │               Database Layer                     │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │ SQLite  │ │PostgreSQL│ │ MySQL   │           │    │
│  │  │  (dev)  │ │  (prod)  │ │ (prod)  │           │    │
│  │  └─────────┘ └─────────┘ └─────────┘           │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Desktop Client Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Desktop Architecture                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                 Tauri (Rust)                     │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │  SSH    │ │  SFTP   │ │ Crypto  │           │    │
│  │  │ Client  │ │ Client  │ │(Libsodium)          │    │
│  │  └─────────┘ └─────────┘ └─────────┘           │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │               React Frontend                     │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │Terminal │ │  Hosts  │ │ Vault   │           │    │
│  │  │(xterm.js)│ │  List   │ │ Manager │           │    │
│  │  └─────────┘ └─────────┘ └─────────┘           │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Local Storage                       │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │   OS    │ │ SQLite  │ │ Settings│           │    │
│  │  │Keychain │ │  (vault)│ │         │           │    │
│  │  └─────────┘ └─────────┘ └─────────┘           │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### Authentication Flow

```
1. User enters email + password
2. Client generates SRP6a proof
3. Server verifies proof, returns JWT
4. Client stores JWT for API calls
5. Vault unlock: derive key from password
6. Decrypt private key with derived key
7. Decrypt personal encryption key
8. Decrypt vault data
```

### SSH Connection Flow

```
1. User selects host from list
2. Client opens WebSocket to server
3. Server establishes SSH connection to target
4. Bidirectional terminal data streams
5. User interacts with terminal
6. Connection closes on disconnect
```

### Vault Sync Flow

```
1. Client encrypts data locally
2. Sends encrypted blob to server
3. Server stores blob (cannot decrypt)
4. Other clients receive blob via sync
5. Clients decrypt locally
```

## Security Model

- **Zero-Knowledge**: Server never sees plaintext
- **End-to-End Encryption**: All crypto on client
- **SRP6a**: Password never transmitted
- **OS Keychain**: Keys stored securely
- **Libsodium**: Battle-tested crypto library
