# API Reference

## Base URL

```
http://localhost:8080/api
```

## Authentication

### Register

```
POST /auth/register
```

Request:
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "securepassword"
}
```

Response:
```json
{
  "userId": "uuid",
  "publicKey": "base64...",
  "encryptedPersonalKey": "base64...",
  "encryptedPrivateKey": "base64...",
  "nonce": "base64...",
  "salt": "base64...",
  "srpSalt": "base64...",
  "srpVerifier": "base64..."
}
```

### Login (SRP6a)

```
POST /auth/login
```

Request:
```json
{
  "email": "user@example.com",
  "srpProof": "base64..."
}
```

Response:
```json
{
  "token": "jwt-token",
  "serverProof": "base64...",
  "encryptedPrivateKey": "base64...",
  "encryptedPersonalKey": "base64...",
  "publicKey": "base64...",
  "nonce": "base64...",
  "salt": "base64..."
}
```

## Hosts

### List Hosts

```
GET /hosts
```

Response:
```json
{
  "hosts": [
    {
      "id": "uuid",
      "name": "Production Server",
      "address": "192.168.1.100",
      "port": 22,
      "username": "root",
      "groupId": "uuid",
      "tags": ["production", "web"],
      "color": "#ff0000",
      "icon": "server",
      "sortOrder": 0,
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

### Create Host

```
POST /hosts
```

Request:
```json
{
  "name": "Production Server",
  "address": "192.168.1.100",
  "port": 22,
  "username": "root",
  "groupId": "uuid",
  "tags": ["production", "web"],
  "color": "#ff0000",
  "icon": "server"
}
```

### Update Host

```
PUT /hosts/:id
```

### Delete Host

```
DELETE /hosts/:id
```

## Groups

### List Groups

```
GET /groups
```

### Create Group

```
POST /groups
```

Request:
```json
{
  "name": "Production",
  "parentId": "uuid"
}
```

### Update Group

```
PUT /groups/:id
```

### Delete Group

```
DELETE /groups/:id
```

## Vaults

### List Vaults

```
GET /vaults
```

### Create Vault

```
POST /vaults
```

Request:
```json
{
  "name": "Production Credentials",
  "description": "SSH keys for production servers",
  "encryptedData": "base64...",
  "iv": "base64...",
  "salt": "base64..."
}
```

### Update Vault

```
PUT /vaults/:id
```

### Delete Vault

```
DELETE /vaults/:id
```

## Keychain

### List Keys

```
GET /keys
```

### Import Key

```
POST /keys
```

Request:
```json
{
  "name": "Production Key",
  "keyType": "ed25519",
  "publicKey": "base64...",
  "encryptedPrivateKey": "base64...",
  "fingerprint": "sha256:..."
}
```

### Delete Key

```
DELETE /keys/:id
```

## Snippets

### List Snippets

```
GET /snippets
```

### Create Snippet

```
POST /snippets
```

Request:
```json
{
  "name": "Check disk usage",
  "command": "df -h",
  "description": "Show disk usage in human-readable format",
  "tags": ["monitoring", "disk"]
}
```

### Update Snippet

```
PUT /snippets/:id
```

### Delete Snippet

```
DELETE /snippets/:id
```

## Workspaces

### List Workspaces

```
GET /workspaces
```

### Create Workspace

```
POST /workspaces
```

Request:
```json
{
  "name": "Production Dashboard",
  "layout": {
    "tabs": [
      { "hostId": "uuid", "title": "Web Server" },
      { "hostId": "uuid", "title": "Database" }
    ],
    "split": "horizontal"
  },
  "hostIds": ["uuid1", "uuid2"]
}
```

### Update Workspace

```
PUT /workspaces/:id
```

### Delete Workspace

```
DELETE /workspaces/:id
```

## Sessions

### List Sessions

```
GET /sessions
```

### Get Session

```
GET /sessions/:id
```

## Settings

### Get Settings

```
GET /settings
```

### Update Settings

```
PUT /settings
```

Request:
```json
{
  "theme": "dark",
  "fontFamily": "JetBrains Mono",
  "fontSize": 14,
  "cursorStyle": "block",
  "keybindings": {}
}
```

## Teams

### List Teams

```
GET /teams
```

### Create Team

```
POST /teams
```

Request:
```json
{
  "name": "Engineering"
}
```

### Add Team Member

```
POST /teams/:id/members
```

Request:
```json
{
  "userId": "uuid",
  "role": "member"
}
```

## WebSocket Endpoints

### SSH Proxy

```
WS /ws/ssh
```

Messages:
```json
// Connect
{
  "type": "connect",
  "hostId": "uuid",
  "columns": 120,
  "rows": 40
}

// Input
{
  "type": "input",
  "data": "ls -la\n"
}

// Resize
{
  "type": "resize",
  "cols": 120,
  "rows": 40
}

// Output
{
  "type": "output",
  "data": "total 48\ndrwxr-xr-x..."
}

// Disconnect
{
  "type": "disconnect",
  "reason": "host_unreachable"
}
```

### Sync

```
WS /ws/sync
```

Messages:
```json
// Sync request
{
  "type": "sync",
  "entity": "hosts",
  "data": { ... }
}

// Sync response
{
  "type": "synced",
  "entity": "hosts",
  "id": "uuid"
}
```
