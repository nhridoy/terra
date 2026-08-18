# Task T1 Report — `Table` enum, `SyncRow`, generic upsert/get/list

**Status:** DONE
**Branch:** `ai` (base `e131c39` = current HEAD)
**Commit:** `df31c00` — `feat: Table enum, SyncRow, generic upsert/get/list with revision clock and outbox`
**Files changed:** `client/src-tauri/src/db.rs` (only)

## What was implemented (verbatim from brief)

Additions above `#[cfg(test)]` in `client/src-tauri/src/db.rs`:

- `Table` enum (`Groups, Hosts, Keys, Snippets, Workspaces, Presets`) with `parse` (lowercase names, else `Err("unknown table: {s}")`) and `as_str` (crate-private constants → whitelisted for `format!` SQL interpolation).
- `SyncRow` struct — snake_case serde, shared TSV envelope (`id, revision, vault_id, created_at, updated_at, deleted_at`) + plaintext whitelist columns + opaque `data` blob.
- `upsert_sync_row(db, table, &row)`:
  - Ignores caller-supplied `revision`: existing row → `revision+1`, `created_at` preserved; new row → `revision=1`, `created_at=now`.
  - Always `updated_at=now`; sets `deleted_at=None` (upsert of a tombstoned row resurrects it — LWW create/update wins).
  - `INSERT OR REPLACE` with per-table column sets (positionally bound via `row_vals`), always upserts the `outbox` entry (`table_name, record_id, queued_at`).
- `get_sync_row` + lock-free `get_sync_row_unlocked` (used inside upsert for revision computation).
- `list_sync_rows(db, table, vault_id, include_deleted)` — excludes `deleted_at IS NOT NULL` when `include_deleted=false`, `ORDER BY sort_order, created_at`.
- `row_from` decodes envelope by position (0–5) and whitelist columns by name (`.ok()` → `None` when a column is absent from a table's result set).
- `ENVELOPE_COLS`, `table_cols`, `now_ms` helpers.

## TDD evidence

### RED — `cargo test db::tests::test_upsert_group_roundtrip_and_revision_bump` (tests written first)

Compile failure, 17 errors — exactly the expected cause (feature missing, not typo):
`SyncRow` / `Table` / `upsert_sync_row` / `get_sync_row` / `list_sync_rows` "not found in this scope" / "use of undeclared type". No db test ran.

### GREEN — `cargo test db::` (after implementation)

```
test db::tests::test_open_creates_synced_tables ... ok
test db::tests::test_upsert_host_roundtrip ... ok
test db::tests::test_list_scoped_to_vault_and_sorted ... ok
test db::tests::test_upsert_group_roundtrip_and_revision_bump ... ok
test db::tests::test_upsert_keyring_roundtrip ... ok
test db::tests::test_upsert_user_profile_updates ... ok
test db::tests::test_upsert_user_profile_roundtrip ... ok
test db::tests::test_upsert_keyring_updates ... ok
test db::tests::test_upsert_vault_roundtrip ... ok
test db::tests::test_wipe_all_clears_every_row ... ok
test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 26 filtered out
```

3 new tests + all 7 T0 db tests pass. Tests assert: caller `revision: 99` ignored → `revision==1`, bump on update → `revision==2`, `created_at` preserved, `updated_at >= created_at`, opaque `data` passthrough, vault scoping, `sort_order, created_at` ordering (`h2` before `h1`).

### Full suite — `cargo test` (client/src-tauri)

```
test result: ok. 36 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

All T0 db tests and http tests still green.

## Self-review findings

- Code added is the brief's Step 3 verbatim, plus the `Table` enum declaration and `SyncRow` struct from the brief's Interfaces block (Step 3's block omits those declarations but depends on them; same signatures/derives).
- The brief's interfaces list `OutboxEntry` / `tombstone_sync_row` / `outbox_pending` / `outbox_remove` as T2 — deliberately NOT implemented (out of scope for T1).
- Scope check: brief forbids new crates — none added (uses existing `rusqlite 0.32` generic `params_from_iter`/`Value`). `Result<_, String>` errors throughout.
- `get_sync_row` returns `Option::None` when the row is absent; lock scope: the `Mutex<Connection>` guard is held for the whole upsert (prepare+execute+outbox) — correct, serializes revision reads vs writes.
- Warning: `row_from(table, ...)` — the `table` param is unused → compiler warns (`db.rs:429`). Kept verbatim from the brief (forward marker, e.g. future AEAD AAD = table name). All other warnings are pre-existing.
- Pre-existing warnings elsewhere (lib.rs/crypto.rs) untouched.

## Concerns

- None functionally. Two minor notes logged in the report: the unused `table` param warning is intentional (verbatim brief code); `filter_map(|r| r.ok())` in `list_sync_rows` silently drops decode-failed rows (matches brief verbatim and pre-existing codebase pattern).