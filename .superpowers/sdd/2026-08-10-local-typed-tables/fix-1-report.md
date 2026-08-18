# Fix 1 Report — T9 Gate: tsc-typed test fixtures + Rust dead-code warnings

**Commit:** `66d9e27` — `fix: tsc-typed test fixtures + silence outbox_remove dead-code warning`
**Branch:** `ai` (HEAD a402f32 → 66d9e27)
**Scope:** Test-only fixes (3 files) + one Rust annotation + one param rename. No production store code touched.

## Changes

### A. 9 tsc type errors fixed (all 9; 2 pre-existing authStore errors left untouched)

**`client/src/stores/hosts/hostStore.test.ts`** (3 errors)
- L71–79: `mockUpsert.mockResolvedValue` (createHost test) — added missing `sort_order: 0` to the `SyncRow` literal (TS2741).
- L145: `selectedHost: { id: "h1" }` → full `Host` object `{ id, name, address, port, tags, sortOrder, createdAt, updatedAt }` (TS2740); mirrored the neighboring hosts[0] fixture.
- L230–238: `mockUpsert.mockResolvedValue` (createGroup test) — added `sort_order: 0` (TS2741).

**`client/src/stores/keys/keyStore.test.ts`** (5 errors)
- L64: `vi.spyOn(crypto, "randomUUID").mockReturnValue("uuid-123")` → well-formed UUID `"123e4567-e89b-12d3-a456-426614174000"` (TS2345 template-literal type).
- L67, L103, L140: three `mockUpsert.mockResolvedValue` literals — added `sort_order: 0` (TS2741); ids updated to the well-formed UUID for consistency.
- L92: assertion `expect.objectContaining({ id: "uuid-123", ... })` → well-formed UUID, keeping the "id IS the UUID from the spy fallback" assertion meaningful.
- L182: `selectedKey: { id: "k1" }` → full `Key` object (TS2739).

**`client/src/stores/snippets/snippetStore.test.ts`** (1 error)
- L179: `selectedSnippet: { id: "s1" }` → full `Snippet` object `{ id, name, command, tags, createdAt }` (TS2739).

### B. Rust warnings (2 fixed)

**`client/src-tauri/src/db.rs`**
- L561 `outbox_remove`: added `#[allow(dead_code)]` with comment `// used by the Plan #4 sync engine and db tests` — pub API exercised by db tests, reserved for Plan #4 sync engine.
- L429 `row_from`: renamed unused `table: Table` param → `_table`. The param is genuinely unused (rows read by position/name, see L434–450); the gate's "misattribution" suspicion was wrong — cargo confirmed a real `unused variable: table` at db.rs:429. Kept the signature (arity/type unchanged; callers pass positionally) because Plan #4 may use it. The suggested `let _ = table;` alternative was avoided.

Note: the edit tool rewrote db.rs as CRLF; repo blobs are LF with `core.autocrlf=false`. Detected via `git diff --ignore-cr-at-eol` (real change only 3+/1- vs numstat 870/868), normalized back to LF. Final diff: 4 lines (3 insertions, 1 deletion) as intended.

## Verification (all run on Windows/pwsh)

### 1. tsc
```
pnpm exec tsc --noEmit
# only 2 pre-existing errors remain:
src/stores/auth/authStore.test.ts(493,51): error TS2345 ... 'recovery_emitted' ... 'void'
src/stores/auth/authStore.test.ts(529,57): error TS2345 ... 'password_changed' ... 'void'
```
All 9 target errors fixed; authStore errors are at base (out of scope, untouched).

### 2. vitest
```
pnpm vitest run
Test Files  11 passed (11)
Tests     114 passed (114)
```
114/114, matches gate baseline.

### 3. biome
```
pnpm biome check src/stores/hosts/hostStore.test.ts src/stores/keys/keyStore.test.ts src/stores/snippets/snippetStore.test.ts
Checked 3 files in 639ms. No fixes applied.
```
Clean; no `--write` needed.

### 4. cargo
```
cargo check   # warnings: 27 → 25 (outbox_remove + row_from table gone; 25 remaining all pre-existing)
cargo test    # 39 passed; 0 failed (http concurrency flake did NOT occur on first run)
```

### 5. git status
Only 4 intended files modified; committed as `66d9e27`.

## Remaining errors/warnings (out of scope, pre-existing)

- tsc: `authStore.test.ts` L493, L529 (TS2345 — existed at base).
- cargo: 25 warnings — deprecated `GenericArray::from_slice` (crypto.rs), unused imports (`BTreeMap`, `Child/Command/Stdio`, `cipher::KeyInit`), unused vars in lib.rs (SshConfig stubs, session_id/cols/rows/accepted), dead pub API in db.rs (`UserProfile`, `upsert_user_profile`, `get_user_profile`, `UserKeyRow`, `upsert_keyring`, `get_keyring`, `VaultRow`, `upsert_vault`, `chrono_utc_now`) — all pre-plan artifacts.
