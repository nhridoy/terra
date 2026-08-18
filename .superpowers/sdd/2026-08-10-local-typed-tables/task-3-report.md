# Task T2 Report — tombstone + outbox ops + remaining tables' tests

**Status:** DONE
**Date:** 2026-08-10
**Branch:** `ai` (base commit df31c00; HEAD before task: 9910db1)

## What I implemented

All changes in `client/src-tauri/src/db.rs`:

1. **Step 0 — Atomicity retrofit into T1's `upsert_sync_row`**: row write + outbox insert were two separate auto-commit `conn.execute` calls; a crash between them would permanently desync offline writes (no outbox entry). Both executes now route through a single `conn.transaction()` handle (`tx.execute`, `tx.execute`, `tx.commit()`); a dropped uncommitted `Transaction` rolls back automatically. Error contexts: `upsert_sync_row tx`, `upsert_sync_row(...)`, `upsert_sync_row outbox`, `upsert_sync_row commit`.

2. **`tombstone_sync_row(db, table, id)`**: idempotent — missing row → `Ok(())` (no-op), already-tombstoned row → `Ok(())` without revision bump (checked via `get_sync_row_unlocked` before the write). Otherwise UPDATE with `revision = existing.revision + 1`, `updated_at = now`, `deleted_at = now`, followed by `INSERT OR REPLACE` into outbox — all in ONE transaction. Table name interpolated only via `Table::as_str()`.

3. **`outbox_pending(db)`**: SELECT `table_name, record_id, queued_at` FROM outbox ORDER BY queued_at → `Vec<OutboxEntry>`.

4. **`outbox_remove(db, table, id)`**: DELETE by (table_name, record_id) via `Table::as_str()`.

5. **`OutboxEntry`** struct with exactly `table_name, record_id, queued_at` — derives `Debug, Clone, serde::Serialize`.

6. Three tests added verbatim from the brief:
   - `test_tombstone_hides_row_and_bumps_outbox`
   - `test_outbox_remove_and_remaining_tables_roundtrip`
   - `test_table_parse_rejects_unknown` — checked T1's test module first; `Table::parse` had no test coverage, so this one was missing and was added.

## TDD evidence

### RED (Step 2)
`cargo test test_tombstone_hides_row_and_bumps_outbox` → **compile failed**, 6 errors, all E0425:

```
error[E0425]: cannot find function `tombstone_sync_row` in this scope
error[E0425]: cannot find function `tombstone_sync_row` in this scope
error[E0425]: cannot find function `outbox_pending` in this scope
error[E0425]: cannot find function `outbox_pending` in this scope
error[E0425]: cannot find function `outbox_remove` in this scope
error[E0425]: cannot find function `outbox_pending` in this scope
error: could not compile `termvault` (lib test) due to 6 previous errors
```

Exactly the failures the brief predicted (functions not found).

### GREEN (Step 4)
`cargo test db::` → **13 passed; 0 failed** (10 pre-existing T0/T1 tests + 3 new).

First attempt failed to compile with E0596 (`conn.transaction()` requires `&mut Connection` in this rusqlite version) — fixed by declaring the guard bindings `mut conn` in `upsert_sync_row` and `tombstone_sync_row` (DerefMut gives `&mut *guard`). The brief/task-note said `mut` was unnecessary; that note was incorrect for the pinned rusqlite, fixed at compile site. No API/semantics change.

### Full suite
`cargo test` (client/src-tauri) → **39 passed; 0 failed** (db + http suites), 20.69s.

### Warnings
No new warnings introduced by this change. The remaining warnings (unused imports in lib.rs, deprecated GenericArray, dead-code for as-yet-unwired db fns like `UserProfile`/`upsert_vault`, unused `table` param in `row_from`) are all pre-existing from T0/T1 and outside this task's scope.

## Self-review findings

- **`mut conn` deviation**: The brief's note claimed `conn.transaction()` works without `mut`; the compiler disagreed (E0596, `cannot borrow conn as mutable`). Resolved with `let mut conn = ...` — idiomatic and the only viable path since `transaction()` takes `&mut self`. Behavior identical.
- **Test verbatim fidelity**: All three tests copied exactly from the brief, no modifications.
- **Idempotency covered**: tombstone twice → revision stays 2 (test asserts); tombstone of missing row → `Ok(())` no-op path exercised indirectly (not asserted in tests but implemented per brief).
- **Constraints respected**: no new crates; `Result<_, String>` error style throughout; SQL table identifiers only ever come from `Table::as_str()` whitelist (never from `Table::parse` output or raw user input — `parse` output is the enum, and `as_str` maps it back to constants, so the `"hosts; DROP TABLE groups"` rejection is belt-and-braces for the public parse boundary).
- **Atomicity scope**: only `upsert_sync_row` and `tombstone_sync_row` touch outbox+writes; both now transactional. `outbox_remove` is a single statement (inherently atomic).
- **Step 0 check**: verified the committed function before editing had both `conn.execute` calls outside a transaction (confirmed in read of db.rs prior to edit) — retrofit applied, not skipped.

## Concerns

- None blocking. Minor: the "no `mut` needed" note in the task context was wrong for the pinned rusqlite version — future task briefs relying on that note for `conn.transaction()` would hit the same E0596.
- `outbox_pending` returns rows ordered by `queued_at` (ties unbroken) — fine for T3's pull-drain use.

## Files changed

- `client/src-tauri/src/db.rs` (only file)

## Commit

`git add client/src-tauri/src/db.rs` → commit `feat: tombstone deletes and outbox pending/remove with tests` (includes Step 0 atomicity retrofit per brief Step 5).