# Fix 2 Report — SyncRow serde defaults for partial store rows

**Branch:** `ai` · **Commit:** `5d35678` — `fix: serde defaults on SyncRow so db_upsert accepts partial store rows`
**Date:** 2026-08-10

## Bug

`db_upsert` (`client/src-tauri/src/lib.rs:55-57`) deserializes the incoming row via `serde_json::from_value::<db::SyncRow>`. `SyncRow` had 14 required fields and no `#[serde(default)]`, but stores send partial rows (hostStore.ts:158, keyStore.ts:95, snippetStore.ts:94, workspaceStore.ts:88 — only `id`, `vault_id`, `name`, `group_id`/`key_id`/`description`, `sort_order`, `data`). Every store write failed at runtime: `db_upsert: bad row: missing field 'revision'`. Vitest mocks `invoke` and cargo tests built complete structs, so neither caught it; the plan's T4 test even encoded the partial shape.

## What changed

1. **`client/src-tauri/src/db.rs:605-607`** — struct-level `#[serde(default)]` added to `SyncRow` (with `#[derive(Default)]` added to the derives). Missing fields now default: `revision/created_at/updated_at/sort_order = 0`, `deleted_at/name/os/description/parent_id/group_id/key_id = None`, `id/vault_id/data = ""`. SAFE: `upsert_sync_row` overwrites revision/created_at/updated_at/deleted_at anyway (caller-supplied values already ignored), and stores always send id/vault_id/whitelist fields/data.

2. **`client/src-tauri/src/db.rs:851-897`** — new seam test `test_sync_row_deserializes_store_shapes` in `mod tests`: deserializes the exact literal JSON shapes the TS stores emit (hosts, keys, snippets, workspaces) via `serde_json::from_value::<SyncRow>(serde_json::json!({...}))` and asserts the defaults land (revision 0, created_at 0, updated_at 0, deleted_at None, os None, etc.).

3. **`client/src/lib/db/db.ts:64-67`** — stale docstring on `wipeLocalData` updated: "removes the DB file plus WAL/SHM sidecars" → "deletes all rows from all local tables (wipe_all)". No logic change.

Out of scope (untouched): `records` DROP TABLE cleanup and all other Minor items.

## RED / GREEN evidence

**RED** (test added first, before the fix):
```
running 1 test
test db::tests::test_sync_row_deserializes_store_shapes ... FAILED
thread 'db::tests::test_sync_row_deserializes_store_shapes' panicked at src\db.rs:856:13:
called `Result::unwrap()` on an `Err` value: Error("missing field `revision`", line: 0, column: 0)
test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 39 filtered out
```

**GREEN** (after adding `#[serde(default)]` + `#[derive(Default)]`):
```
running 40 tests
test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Verification

1. `cargo test` — **40 passed** (39 existing + 1 new seam test). ✅
2. `cargo check` — Finished, no new warnings (all warnings pre-existing: unused imports/vars, GenericArray deprecation). ✅
3. `pnpm vitest run` — **114/114 passed** (11 files). ✅
4. `pnpm exec tsc --noEmit` — exactly the 2 pre-existing authStore.test.ts errors (493, 529), nothing new. ✅
5. `git status` — only `client/src-tauri/src/db.rs` + `client/src/lib/db/db.ts` modified. ✅
