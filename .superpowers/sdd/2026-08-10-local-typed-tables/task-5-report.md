# Task T4 Report: TS wrapper `lib/db/db.ts` (TDD)

**Status:** DONE
**Commit:** `d6ca049` feat: ts db wrapper — list/get/upsert/deleteRow, getOutbox
**Date:** 2026-08-10

## What was implemented

`client/src/lib/db/db.ts` — thin typed wrapper over the 5 `db_*` Tauri commands from T3 plus the pre-existing `wipeLocalData` (unchanged, doc comment kept):

- `TableName` union (`groups | hosts | keys | snippets | workspaces | presets`)
- `SyncRow` interface (snake_case fields, matches Rust `db::SyncRow` serde shape)
- `OutboxEntry` interface (`table_name`, `record_id`, `queued_at`)
- `listRows(table, vaultId, includeDeleted = false)` → `db_list`
- `getRow(table, id)` → `db_get` (returns `SyncRow | null`)
- `upsertRow(table, row)` → `db_upsert` — passes the `row` object through **as-is** (snake_case), per T3 implementer's note; no camelCase conversion
- `deleteRow(table, id)` → `db_delete` (tombstone)
- `getOutbox()` → `db_outbox`
- `wipeLocalData()` → `wipe_local_data` (existing, untouched)

`client/src/lib/db/db.test.ts` — 5 vitest tests using the codebase's standard idiom: `vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))` + `vi.mocked(invoke)` (same as `crypto.test.ts` / `http.test.ts`).

Argument-name verification against Rust: Tauri v2 auto-converts snake_case Rust params to camelCase on the JS side, so `vault_id`→`vaultId`, `include_deleted`→`includeDeleted` — confirmed against `client/src-tauri/src/lib.rs:55-82` and asserted in the tests.

## TDD evidence

**RED** — `pnpm vitest run src/lib/db/db.test.ts` (before implementation):

```
❯ src/lib/db/db.test.ts (5 tests | 5 failed)
TypeError: listRows is not a function  (×4 more: getRow, upsertRow, deleteRow, getOutbox)
Test Files  1 failed (1)
     Tests  5 failed (5)
```

**GREEN** — same command after implementation:

```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

**Full suite** — `pnpm vitest run`:

```
Test Files  7 passed (7)
     Tests  83 passed (83)   [78 pre-existing + 5 new]
```

**Lint** — `pnpm biome check src/lib/db/`:

```
Checked 2 files. No fixes applied.   (clean)
```

Note: initial biome run flagged 3 formatter findings (import sort order, long-line wrapping, trailing newline) in the test file; applied `biome check --write` (safe formatting only, zero semantic changes) and re-ran tests → still 5/5 green. The brief's test code was used verbatim initially as required; formatting-only deviations were needed to satisfy the biome gate.

## Files changed

- `client/src/lib/db/db.ts` (modified — added 63 lines of typed API, kept existing `wipeLocalData`)
- `client/src/lib/db/db.test.ts` (created — 68 lines)

## Self-review findings

1. **Snake_case pass-through confirmed**: `upsertRow` does not transform `row`; test asserts `toHaveBeenCalledWith("db_upsert", { table: "hosts", row })` with `vault_id` present — matches Rust `serde_json::from_value::<db::SyncRow>` expectation.
2. **Optional arg shape**: T3 Rust `db_list` accepts `include_deleted: Option<bool>`; wrapper defaults to `false` and always sends it — matches the brief's interface. Rust unwraps with `unwrap_or(false)` so either shape works; tests lock the brief's exact call shape.
3. **`deleteRow` is void**: `await invoke(...)` without return — matches brief; test verified.
4. **Type note**: `SyncRow`'s optional fields are declared per brief; if T6–T8 consume rows from `data: string` (encrypted JSON), the concrete sub-shapes will live there, not here — wrapper stays generic.
5. CRLF/LF warnings from git are pre-existing repo config noise, not a content issue.

## Concerns

- None blocking. Minor: future consumers must remember to send snake_case field names in `upsertRow` rows; the `SyncRow` interface itself documents this. A runtime (not TS-level) guarantee could be added later if a consumer mis-sends camelCase, but that is T6–T8 territory and the brief explicitly forbids conversion here.
- One brief deviation: biome-safe formatting applied to the verbatim test (import order, line wrapping, trailing newline) — no logic changes.