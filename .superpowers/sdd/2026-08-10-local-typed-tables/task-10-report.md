# Task T9 — Plan-Level Gate Pass Report

**Feature:** Offline-first, phase 2 (local typed tables + outbox)
**Branch:** `ai` @ `a402f32` (working tree clean at start and end)
**Base (comparison tree):** `bc38a4f`
**Date:** 2026-08-10
**Status:** PASS_WITH_NOTES

---

## 1. Suites

### 1.1 Rust — `cargo check` → **PASS** (exit 0, 27 warnings, net change −5)
Command: `cargo check` in `client/src-tauri` (also `--message-format=short` for capture).

- HEAD warnings: 27. Base warnings: 32. **Net −5**.
- New warnings introduced by this plan (2, both dead-code in `db.rs`):
  - `function outbox_remove is never used` (db.rs:561 — used only from tests; `cargo test` build doesn't flag it)
  - `unused variable: table` (db.rs, `outbox_remove` signature — same function)
- Removed warnings (6): `delete_record/hard_delete_record/query_records/upsert_record` never used, `LocalDb` never constructed, `RecordRow` never constructed (all `records`-table machinery deleted).
- All other 25 warnings identical to base (unused vars in lib.rs, deprecated GenericArray::from_slice in crypto.rs, etc.).

### 1.2 Rust — `cargo test` (full) → **PASS on re-run; 1 pre-existing flake on run 1**
Command: `cargo test` in `client/src-tauri`.

- Run 1: **38 passed, 1 failed** — `http::tests::test_single_flight_concurrent_401s`
  (`assertion failed: matches!(r1, Err(HttpErrorKind::SessionExpired))` at src/http.rs:510).
- That test lives in `http.rs`, which has a **zero-line diff** across the whole plan range (`git diff bc38a4f..HEAD --stat -- client/src-tauri/src/http.rs` = 0 lines). It is timing-sensitive (concurrent 401s single-flight).
- Standalone re-runs: **2/2 PASS**. Full-suite re-run (post environment restore, section 4): **39 passed, 0 failed**.
- Classification: pre-existing flake under parallel test load, not caused by this plan.
- HEAD lib suite = 39 tests (db + http + crypto modules). Base comparison: base `cargo test --lib` **requires `client/dist` to exist** (`tauri::generate_context!()` panics: "frontendDist ... path doesn't exist" — dist is gitignored, absent in fresh worktree). With `dist/` provided: base = **37 passed, 0 failed**. (Both runnable-suite counts verified; +2 tests net from plan.)

### 1.3 TS — `pnpm vitest run` → **PASS: 114 tests, 11 files**
```
Test Files  11 passed (11)
Tests       114 passed (114)
```
Same count before and after the environment restore (see §4), i.e. stable 114.

### 1.4 Biome — `pnpm biome check .` → **PASS (zero new diagnostics)**
- HEAD: **7 errors + 3 warnings** — all in untouched files: `HostForm.tsx` (4), `KeyboardSettings.tsx` (1), `TerminalTab.tsx` (1), `FileGridItem.tsx` (1), `ContextMenu.tsx` (1), `loginFormSchema.ts` (1), `registerFormSchema.ts` (1).
- Base (worktree `bc38a4f`, checked out with LF — see §5): **byte-identical set: 7 errors + 3 warnings, same files**.
- Conclusion: the plan's 14 changed files add **zero** biome diagnostics. (Biome config `client/biome.json` is unchanged across the range, verified by diff.)

### 1.5 Server — `go vet ./...` and `go test ./...` → **PASS**
- `go vet ./...`: exit 0, no findings.
- `go test ./...`: `internal/auth`, `internal/config`, `internal/email`, `internal/models` — `ok`; `cmd/termvault-server` no test files. Exit 0.
- Server directory is untouched by the plan: the full range diff touches 14 files, all under `client/` (`git diff bc38a4f..HEAD --name-only` = 14 `client/…` paths, zero `server/…`). No server files were edited or committed during this gate.

### 1.6 Build proxy — `pnpm build` (`tsc && vite build`) → **FAIL (type errors in test files)**
The heavy `tauri build --no-bundle` was replaced by tasks' suggested compile-level proxy: `cargo check` (§1.1, PASS) + `pnpm build` (this section). `tsc` run (`pnpm exec tsc --noEmit`) on HEAD:

- **11 errors total = 2 pre-existing + 9 NEW.**
- Pre-existing (present identically at base): `src/stores/auth/authStore.test.ts(493)` and `(529)` — `TS2345` (mock param type). Base `tsc --noEmit` = exactly these 2 → **the build was already red at base**.
- NEW — all in the plan's own test files (production code: **zero** type errors):
  - `hostStore.test.ts` ×3 — TS2741 `sort_order` missing in `SyncRow` literal (lines 71, 230); TS2740 `{id}` not assignable to `Host` (145)
  - `keyStore.test.ts` ×5 — TS2345 `"uuid-123"` not a UUID template literal (64); TS2741 `sort_order` ×3 (66, 103, 140); TS2739 `{id}` not assignable to `Key` (182)
  - `snippetStore.test.ts` ×1 — TS2739 `{id}` not assignable to `Snippet` (179)
- vtess passes because vitest does not type-check. `tsc` (thus `pnpm build`) fails at both base (2) and HEAD (11). This is a plan gate miss on "app builds cleanly" — **recommend fixing the 9 test-file literals** (add `sort_order: 0` to SyncRow literals; full-object mocks) — and decide whether `authStore.test.ts`'s 2 pre-existing errors get fixed in a follow-up. No production code affected.

---

## 2. DoD greps

| Check | Base (`bc38a4f`) | HEAD (`a402f32`) | Verdict |
|---|---|---|---|
| `grep -c "fetch("` in `client/src` | 2 files: `lib/api/auth.ts:1`, `stores/auth/authStore.ts:1` | **identical 2 files/2 lines** | ✅ UNCHANGED — no new HTTP anywhere |
| `records`/`record_type` in `client/src-tauri/src` | 32 hits (crypto.rs 4, db.rs 26, lib.rs 2) | 7 hits (crypto.rs ×4, lib.rs ×2, db.rs ×1) | ✅ No new refs; all records-table machinery deleted |
| `TODO` in `client/src/stores/{hosts,keys,snippets,workspaces}` | — | **0 matches** (grep exit 1) | ✅ no stubs/TODO bodies |
| Store files present as real implementations | — | `hostStore.ts` +297/−34, `keyStore.ts` +158, `snippetStore.ts` +139, `workspaceStore.ts` +133, four companion test files (+885 lines) | ✅ interfaces exercised by 100+ passing tests, components import-store untouched |

Notes on the two caveat rows:

- **`fetch(` — unchanged, verified via `git grep -c` on both trees** (no stash, no dirty working tree; task instructions honored).
- **`records`/`record_type` — "must be ZERO" does not hold literally**, but every remaining hit is pre-existing crypto-layer keyword usage, none introduced by this plan:
  - `crypto.rs:231,234,597,598` — `record_type` param of the pre-existing `encrypt_secret` envelope helper (crypto.rs has a **0-line diff** across the range).
  - `lib.rs:834,836` — pre-existing `encrypt_secret` Tauri-command signature (same param, existed at base: 2 hits).
  - `db.rs:645` — a **test assertion that the `records` table does NOT exist** (`assert!(!tables.contains(&"records"))`), i.e. removal-proof.
  - Deleted by the plan: `RecordRow`, `upsert_record`, `query_records`, `delete_record`, `hard_delete_record`, `records` table/index DDL, and 26 db.rs hits.
  - New outbox code uses `record_id` (different token, outbox PK) — not `records`/`record_type`.

---

## 3. Manual smoke coverage (Step 4 of T9)

GUI cannot be executed in this environment (no display). Compile-level proxies ran instead (§1.1 cargo check PASS, §1.6 tsc/vite — see failure note). The following checklist items from the plan remain **MANUAL — for the human**:

1. Boot + login → create group, host (password auth), SSH key, snippet, workspace → restart app → all five persist.
2. Delete host → restart → gone; devtools `await invoke("db_outbox")` shows pending `{ table_name: "hosts", record_id: ... }` tombstone.
3. Stop server → create/delete hosts+snippets locally with no errors → restart server → login still works.
4. Logout → login → old data gone (`wipe_all`); new-session host persists across restarts.

Environment note for the human: your dev servers are already running (`tauri dev` PID 29320, `vite` PID 8624, both started 2026-08-07). `node_modules` was rebuilt during this gate (§4) — **restart the dev servers once** to pick up the fresh link farm, then run items 1–4. Also: several dozens of stuck VS Code biome-extension daemon processes (`__run_server`, some since Aug 1) were observed; harmless but restarting VS Code will clear them.

---

## 4. Environment incident + restoration (transparency log)

During base-tree comparison setup, `Remove-Item -Recurse -Force` on a junctioned `node_modules` copy traversed the junction and deleted `node_modules/.bin` in the real tree. Subsequent `pnpm install --force` aborted with `EPERM` on `lightningcss…node` (locked by the user's dev server, §3) leaving the link farm half-rebuilt; vite/vitest then failed on config bundling (`UNRESOLVED_ENTRY`, rolldown). **Full restoration**: `cmd /c rmdir /s /q node_modules` (all junctions self-contained within node_modules — safe) + fresh `pnpm install --prefer-offline --frozen-lockfile`. Post-restore verification matches the pre-incident numbers exactly: vitest 114/114, biome 7/3, cargo test 39/39 — evidence that all results in this report reflect the true tree state. No repo files were modified at any point (`git status` clean at start and end); the junction `src-tauri/target` survived all operations and cargo artifacts are intact.

## 5. Methodology notes for future gate passes

- `git worktree add` applies the system-level `core.autocrlf=true`, checking out files as **CRLF**, which makes `biome check` report ~235 spurious "format" errors. Use `git -c core.autocrlf=false worktree add …` (and never `Remove-Item -Recurse` on a junction — use `cmd /c rmdir`).
- Base `cargo test --lib` needs `client/dist` (gitignored) present for `tauri::generate_context!()`; copy it from the main tree when comparing on a checkout.

---

## 6. Verdict

- **PASS** on: cargo check (exit 0), cargo test (39/39 on re-run; single run-1 failure = pre-existing flake in untouched http.rs, passes standalone 2/2), vitest 114/114, biome 7/3 identical to base (zero new), go vet + go test PASS, server untouched, `fetch(` count unchanged (2 files → 2 files), stores fully implemented (0 TODOs), zero new `records`/`record_type` references (remaining hits pre-existing crypto keyword).
- **NOTES (not blocking, but must be recorded):**
  1. **`pnpm build` fails on tsc**: 2 pre-existing errors (already red at base) + **9 new type errors in the plan's own test files** (`sort_order` missing in `SyncRow` literals; incomplete `Host`/`Key`/`Snippet` mocks; non-UUID string). Production code type-checks clean. Fix in a small follow-up.
  2. 2 new Rust dead-code warnings (`outbox_remove`, `table` param) — net warning count still −5.
  3. GUI smoke items 1–4 unexecuted — manual for the human (dev servers already live; restart them after the node_modules rebuild).
  4. `records`/`record_type` grep is not literally zero — 7 pre-existing crypto-envelope hits remain (see §2).