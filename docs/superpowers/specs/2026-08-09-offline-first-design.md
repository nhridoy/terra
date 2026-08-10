# TermVault — Offline-First Local Architecture (Design)

Date: 2026-08-09 · Status: Draft for review

## 1. Goals

- The desktop app must boot, unlock, browse, and edit vault data with no server
  reachable (Termius-style offline-first).
- Every write is local-first; sync to the server happens in the background.
- Conflicts between devices are never silently lost (LWW + loser kept).
- The client never talks to the server directly: all HTTP goes through a Rust
  proxy command (tokens never live in JS memory).
- The existing authentication system (register/login/verify/OTP/OAuth/recovery/
  keyring/refresh rotation) must not change in behavior or schema.

## 2. Architecture

```
webview (React/zustand)
  └─ stores → lib/api/http.ts (thin TS facade, vitest-mocked seam)
                  │ invoke("http_request")
                  ▼
Rust (Tauri)
  ├─ http_request      token custody (access+refresh in-memory),
  │                    auto-refresh single-flight, 401 retry-once,
  │                    offline classification (NETWORK_ERROR), request log
  ├─ sqlite            typed tables + outbox + conflicts + __sync_meta
  ├─ sync engine       pull/merge/push: launch, debounce 3s, reconnect, manual
  └─ keychain          refresh token (unchanged)
                  │
                  ▼
Server (Gin + GORM)
  └─ POST /sync/pull, POST /sync/push  (Bearer JWT, owner/member AuthZ)
```

- `lib/api/http.ts` is the only seam the webview uses for the server; stores
  keep their current interfaces; vitest mocks `http.ts`.
- OAuth loopback already lives in Rust — unchanged.

## 3. Database schema

Shared envelope on all synced tables (client SQLite + server mirror):

```sql
id         VARCHAR(36) PRIMARY KEY  -- UUID v4
revision   BIGINT NOT NULL DEFAULT 1
created_at BIGINT NOT NULL          -- epoch ms
updated_at BIGINT NOT NULL
deleted_at BIGINT NULL              -- tombstone (sync delete)
```

### users (existing, unchanged)

email UNIQUE COLLATE NOCASE; name; auth_provider; provider_sub; salt_cl;
kdf_m/t/p; public_key (enc); initialized; last_login_at; created_at; updated_at.

### vaults

```sql
id, owner_id REFERENCES users(id),
kind VARCHAR(16) CHECK (kind IN ('personal','team')),
name TEXT NOT NULL,                    -- plaintext (vault switcher pre-unlock)
created_at, updated_at;
INDEX (owner_id)
```

### vault_members

```sql
vault_id REFERENCES vaults(id) ON DELETE CASCADE,
user_id  REFERENCES users(id),
role VARCHAR(16) DEFAULT 'member',     -- owner|admin|member
created_at,
PRIMARY KEY (vault_id, user_id);
INDEX (user_id)
```

### groups

```sql
id, revision, created_at, updated_at, deleted_at,
vault_id  REFERENCES vaults(id) ON DELETE CASCADE,
name TEXT NOT NULL,                    -- plaintext
parent_id REFERENCES groups(id) ON DELETE CASCADE NULL,   -- child groups
sort_order SMALLINT DEFAULT 0;
INDEX (vault_id, parent_id, sort_order)
```

### hosts

```sql
id, revision, created_at, updated_at, deleted_at,
vault_id REFERENCES vaults(id) ON DELETE CASCADE,
group_id REFERENCES groups(id) NULL,   -- NULL = vault root
name TEXT NOT NULL, os TEXT NULL,      -- plaintext
address TEXT NOT NULL, port INTEGER DEFAULT 22,
username TEXT DEFAULT 'root',          -- encrypted
auth_type VARCHAR(16) DEFAULT 'password',  -- password|key
password TEXT NULL,                    -- encrypted (auth_type=password)
key_id REFERENCES keys(id) NULL,       -- auth_type=key
sort_order SMALLINT DEFAULT 0;
INDEX (vault_id, group_id, sort_order)
```

### keys

```sql
id, revision, created_at, updated_at, deleted_at,
vault_id REFERENCES vaults(id) ON DELETE CASCADE,
name TEXT NOT NULL, description TEXT NULL,   -- plaintext
public_key TEXT NULL, private_key TEXT NOT NULL, passphrase TEXT NULL,  -- encrypted
sort_order SMALLINT DEFAULT 0;
INDEX (vault_id, sort_order)
```

### snippets

```sql
id, revision, created_at, updated_at, deleted_at,
vault_id REFERENCES vaults(id) ON DELETE CASCADE,
name TEXT NOT NULL, description TEXT NULL,   -- plaintext
command TEXT NOT NULL, tags TEXT DEFAULT '[]',  -- encrypted (tags = JSON array)
sort_order SMALLINT DEFAULT 0;
INDEX (vault_id, sort_order)
```

### workspaces / presets  (same shape; layout = encrypted pane-tree JSON)

```sql
id, revision, created_at, updated_at, deleted_at,
vault_id REFERENCES vaults(id) ON DELETE CASCADE,
name TEXT NOT NULL,                    -- plaintext
layout TEXT NOT NULL,                  -- encrypted WorkspaceLayout / QuickPreset
sort_order SMALLINT DEFAULT 0;
INDEX (vault_id, sort_order)
```

### history (activity log)

```sql
id, revision, created_at, updated_at, deleted_at,
user_id  REFERENCES users(id) ON DELETE CASCADE,
vault_id REFERENCES vaults(id) ON DELETE CASCADE,
group_id/host_id/key_id/snippet_id/workspace_id/preset_id
         REFERENCES respective tables, all NULL,
action_type VARCHAR(10) CHECK (action_type IN ('create','update','delete')),
description TEXT NOT NULL,             -- plaintext ("Updated host prod-db")
occurred_at BIGINT NOT NULL;
INDEX (user_id, occurred_at DESC); INDEX (host_id)
```

### Sync plumbing

```sql
outbox         (table_name VARCHAR(32), record_id VARCHAR(36), queued_at BIGINT,
                PRIMARY KEY(table_name, record_id)); INDEX(queued_at)
sync_conflicts (table_name, record_id, remote_rev BIGINT, remote_payload TEXT,
                created_at, PRIMARY KEY(table_name, record_id))
__sync_meta    (vault_id PK REFERENCES vaults(id) ON DELETE CASCADE,
                watermark BIGINT, last_sync_at BIGINT, last_device_id)
user_keys      (existing, unchanged)
```

Conventions:
- `table_name` validated against a Rust enum — no polymorphic FKs, no SQLi.
- SQLite: `foreign_keys=ON`, WAL, `synchronous=NORMAL` (existing pragmas kept).

## 4. Sync protocol

- **Revisions** are per-row monotonic counters (logical clock), shared across
  all tables per vault. `__sync_meta.watermark` = last-applied cursor.
- **Pull** `POST /sync/pull { vault_id, since_revision?, device_id }` →
  `{ tables: [{ table, records[], deleted[] }], watermark }`; server returns
  rows with `revision > since_revision` across all tables the user may access.
- **Push** `POST /sync/push { vault_id, device_id, tables: [{ table, records[] }] }` →
  server applies per-record CAS:
  `UPDATE ... SET revision = :new, data = :data WHERE id = :id AND revision < :new`
  and replies `{ records: [{ table, id, fate }] }` where fate ∈
  `accepted | rejected_low_revision | rejected_conflict`.
- **Merge (local)**: incoming remote rows are written locally unless the record
  has a pending outbox entry; in that case the remote payload moves to
  `sync_conflicts` and the local row stays — the UI shows a conflict badge with
  a keep-remote / keep-local / keep-both picker.
- **Delete**: tombstone `deleted_at` set; synced like any row. Hard-delete only
  after conflict resolution or vault purge.
- **Signals**: sync on launch, on edit (3s debounce), on reconnect
  (`navigator.onLine` + failed-request retry), and manual "Sync now".
- **Offline classification**: Rust `http_request` maps fetch failures to
  `NETWORK_ERROR`; UI shows offline banner + pending badges; outbox persists.

## 5. Offline UX

- Banner: "You're offline — changes will sync when the server is reachable."
- Per-item pending badge; global sync status (idle/syncing/pending/conflict)
  in the sidebar footer; conflict picker modal.
- Unlock offline: OS keychain saved password (existing policy) or manual
  password entry — both derive KEK locally and unwrap the *local* `user_keys`
  copy (populated at login/register as today).

## 6. Security & authentication invariants

- Auth tables, JWT middleware, verifier/nonce/OTP/OAuth/recovery flows, refresh
  rotation, keychain custody: **no changes**.
- Zero-knowledge preserved: server only ever receives encrypted blobs, keyring
  blobs, hashes, and proofs. New columns reuse the existing
  `encrypt_secret`/AEAD path (XChaCha20Poly1305, AAD = table name); no new KDF.
- Plaintext whitelist is exactly: vaults.name, groups.name, hosts.name/os,
  keys.name/description, snippets.name/description, workspaces/presets.name,
  history.description, structural ids/sort_order. Everything else encrypted.
- `/sync/*` uses the existing Bearer JWT middleware + per-vault AuthZ:
  personal vaults → owner only; team vaults → any vault_members row.
- Host `key_id` FKs may reference any keys row in the same vault: enforced in
  the service layer (server) and Rust enum validation (client).
- `outbox`/`sync_conflicts` never touch auth data; `user_keys` is out of the
  outbox (keyring propagation stays on auth responses).
- HTTP proxy keeps tokens out of JS memory; only the approved plaintext
  columns are written unencrypted to SQLite.

## 7. Error handling

- Classify: `NETWORK_ERROR | AUTH_EXPIRED | SERVER_ERROR`; facade maps to the
  existing `AuthApiError` shape.
- Outbox durable across crashes; failed flushes retry on next tick.
- Refresh 401 inside Rust → session-revoked event → existing teardown hook.
- Structured request log (debug command / log file) replaces devtools network
  tab for debugging (tauri-error parity).

## 8. Testing

- Rust (`cargo test`): CAS revision logic, tombstone handling, typed-table enum
  validation, outbox flush against a loopback test HTTP server, conflict
  parking, watermark pull.
- TS (`vitest`): stores keep mocking `http.ts` facade; new `syncStore` tests:
  debounce, merge decisions, conflict-flag UI state, offline badge transitions.
- Server (`go test`): `/sync/pull` watermark correctness, `/sync/push` CAS
  acceptance/low-revision rejection, AuthZ (owner/member, foreign vaults
  rejected), tombstones, encrypted-payload passthrough (no decryption
  server-side).

## 9. Rollout order

1. Rust `http_request` proxy + token custody + TS facade (auth untouched,
   all existing calls migrated to the facade).
2. Local typed tables + db commands + outbox (client writes local-first;
   sync endpoints stubbed server-side).
3. Server `/sync/pull` + `/sync/push` with CAS + AuthZ (+ go tests).
4. Sync engine (pull/merge/push, signals, watermarks) + conflicts table.
5. Offline UX (banner, badges, sync status, conflict picker).
6. History table + record writes for activity.

## 10. Open questions

- None blocking. (Conflict picker visual treatment deferred to implementation.)