# Decrypt-on-Demand Lists + Plaintext Whitelist Columns

**Date:** 2026-08-11
**Status:** Approved (brainstormed 2026-08-11)
**Spec:** Supersedes parts of `2026-08-09-offline-first-design.md` (§3 whitelist) for the three list-facing tables. Plan #3 (`2026-08-10-local-typed-tables.md`) dropped the local `records` table; this spec drops the server `records` table too.

## 1. Goal

Lists (hosts, keys, snippets) must render **without decrypting anything on page load**:

- **Host card**: color dot, name, static `SSH` label, os icon/name, "created N ago", tags.
- **Snippet card**: name, "created N ago", tags. (command line removed)
- **Key card**: unchanged visually, but reads plaintext columns.
- Decryption happens **on demand only**: host details / edit prefill / connect / snippet copy / snippet edit.
- OS is **auto-detected on connect** (Rust emits `os` in the `connected` event; client writes only the plaintext `os` column).

Rule (user directive): *non-sensitive data needs no encryption — neither locally nor on the server.* Non-sensitive = `name`, `description`, `os`, `tags`, `color`, `auth_type`, `key_type`, `fingerprint`, `public_key`, envelope. Sensitive stays in the AEAD `data` blob: hosts `{address, port, username, password}`, snippets `{command}`, keys `{privateKey, passphrase}`.

## 2. Client schema (`client/src-tauri/src/db.rs`)

Add plaintext columns to the synced tables (blob `data` column unchanged):

```sql
hosts    ADD COLUMN auth_type    TEXT NOT NULL DEFAULT 'password';  -- password|key
hosts    ADD COLUMN tags         TEXT NOT NULL DEFAULT '[]';        -- JSON array
hosts    ADD COLUMN color        TEXT;                              -- CSS hex
keys     ADD COLUMN key_type     TEXT NOT NULL DEFAULT 'ed25519';
keys     ADD COLUMN fingerprint  TEXT;
keys     ADD COLUMN public_key   TEXT;
snippets ADD COLUMN tags         TEXT NOT NULL DEFAULT '[]';
```

- Extend `CREATE TABLE IF NOT EXISTS` **and** add a startup migration in `open()`: for each new column run `PRAGMA table_info(<table>)` and `ALTER TABLE ... ADD COLUMN` when missing (no version bookkeeping; works for existing installs).
- `table_cols` / `row_vals` / `row_from` / `SyncRow` struct extended with: `auth_type`, `tags`, `color`, `key_type`, `fingerprint`, `public_key` (all `Option<String>`).
- `upsert_sync_row` builds INSERTs from `table_cols` — new columns flow through automatically.
- `tags` stored as JSON array string in the TEXT column; stores `JSON.parse`/`stringify`.
- Existing rows: tags/keyType/fingerprint remain in the blob (invisible in lists until re-saved). No backfill.

## 3. Server schema (`server/internal/models/`)

Replace the generic `Record` model with typed GORM models mirroring the local tables (same column set, same envelope, `data TEXT NOT NULL DEFAULT '{}'` blob):

- `group.go` — groups: id, revision, vault_id (FK, index), name NOT NULL, parent_id, sort_order, data, deleted_at, timestamps; index (vault_id, parent_id, sort_order).
- `host.go` — hosts: + os (`column:os`), auth_type NOT NULL DEFAULT 'password', tags NOT NULL DEFAULT '[]', color, group_id, key_id; index (vault_id, group_id, sort_order).
- `key.go` — keys: + description, key_type NOT NULL DEFAULT 'ed25519', fingerprint, public_key; index (vault_id, sort_order).
- `snippet.go` — snippets: + description, tags NOT NULL DEFAULT '[]'; index (vault_id, sort_order).

Delete `record.go`. `AutoMigrate` registers the four models. The unused `records` table is dropped via `db.Migrator().DropTable("records")` in a tiny migration helper called from AutoMigrate (or directly guarded by `HasTable`). Update `models_test.go` expected tables (drop `records`, add the four typed tables). Nothing reads/writes these tables yet — pure additive.

## 4. Stores (TS)

### hostStore
- `hostFromRow`: **no decrypt**. Reads `row.name`, `row.os`, `row.auth_type`, `JSON.parse(row.tags ?? "[]")`, `row.color`, `row.group_id`, `row.key_id`, `row.created_at/updated_at`. Sensitive fields empty: `address: ""`, `port: 22`, `username: undefined`, `password: undefined`.
- `createHost`/`updateHost`: whitelist fields → row columns (`auth_type`, `tags`, `color`); blob payload shrinks to `{address, port, username, password}`. Update merges whitelist into row + existing decrypted payload for the rest.
- New `getDecryptedHost(id)`: `getRow` + `decryptRowData` + merge → full `Host` (for HostDetails / edit prefill / connect).
- New `updateHostOs(id, os)`: `upsertRow("hosts", {id, vault_id, os}, {})` — plaintext-column-only write, no encryption round (db_upsert with `plaintext: null` skips AEAD); updates local state. Wired to the Rust `connected` event payload field `os`.
- `fetchGroups`: drop the pointless `decryptRowData` call.
- `getCredentialsForHost`: unchanged (already on demand).

### keyStore
- `keyFromRow`: **no decrypt**. `keyType`/`fingerprint`/`publicKey` from columns; `encryptedPrivateKey: ""` (only populated by on-demand decrypt).
- `importKey`/`generateKey`: `key_type`, `fingerprint`, `public_key` → row columns; blob payload shrinks to `{privateKey, passphrase}`.
- `getCredentialsForKey`: unchanged.

### snippetStore
- `snippetFromRow`: **no decrypt**. Tags from column; `command: ""`.
- `create`/`update`: tags → column; command stays in blob.
- New `getDecryptedSnippet(id)`: `getRow` + decrypt → full snippet (edit prefill, copy on demand).
- Search: name + tags only (no command/address search).

## 5. UI

- New `client/src/lib/format/relativeTime.ts`: `formatRelativeTime(epochMs)` → "just now / 5m ago / 3h ago / 2d ago / 3mo ago / 1y ago". (SourceControlPanel's `relativeTime` is unix-seconds based and stays untouched.)
- `DraggableHostCard.tsx:48-51`: replace `username@address:port` line with: os icon (Phosphor `LinuxLogo`/`AppleLogo`/`WindowsLogo`, fallback `DesktopIcon`) + os name, `SSH` label, created-ago, tag badges. Color dot now reads plaintext `color`.
- `SnippetList.tsx`: remove command line (132-134); add created-ago; copy button → `getDecryptedSnippet` then copy; edit click → `getDecryptedSnippet` then `onEdit(decrypted)`; search name + tags.
- `KeyList.tsx`: no visual change; fields now come from columns.
- `HostBrowser.tsx`: drop address search (84, 99, 210) → name + tags; subtitle (368-369) → `SSH` + os + created-ago.
- `HostDetails.tsx` / `HostForm.tsx` / snippet form: edit/detail paths call the new `getDecrypted*` actions before rendering sensitive fields.

## 6. Verification

- `cargo test db::` — new tests: migration adds columns to an old-schema DB; hosts/keys/snippets plaintext column roundtrip through `upsert_sync_row`.
- `pnpm vitest` — updated store tests (payloads shrink, whitelist asserts); `db.test.ts` extended.
- `cd server && go vet ./... && go test ./...` — models test updated for typed tables + records dropped.
- `pnpm biome check .`, `pnpm tsc --noEmit` (only pre-existing errors expected).
