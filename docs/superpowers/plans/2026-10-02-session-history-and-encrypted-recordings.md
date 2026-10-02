# Session History and Encrypted Recordings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SSH/local session history durable and privately synced, with optional encrypted terminal-output recording.

**Architecture:** Add three typed records to the existing personal-vault encrypted sync path: session summaries, append-only output chunks, and account retention preferences. A focused Rust history module owns lifecycle, chunking, retention, and local queries; the React terminal manager sends events and the History UI reads through Tauri commands. Go stores and authorizes ciphertext without decrypting it.

**Tech Stack:** Rust/Tauri/rusqlite, React/Zustand/TypeScript, Go/Gin/GORM, existing sync protocol.

**Spec:** `docs/superpowers/specs/2026-10-02-session-history-and-encrypted-recordings-design.md`

## Global Constraints

- Work on the existing `main` branches and current workspace; create no worktree or branch.
- Do not commit or push unless the user explicitly requests it. The skill's normal per-task commit step is deferred by this user instruction.
- Use `pnpm`, not npm; preserve the local-first, E2E-encrypted model.
- `session_history`, `session_output_chunks`, and `session_preferences` sync only through the signed-in user's default personal vault; reject team-vault use.
- Output recording is off by default and opted into separately on each device. Never capture input or infer commands/exit codes.
- Raw output chunks are at most 64 KiB, with a 10 MiB raw-output cap per attempt.
- Retention is an encrypted per-account preference with choices 7, 30, and 90 days; default 30 days.
- Every database timestamp is canonical UTC ISO-8601 milliseconds. Server sees no plaintext host details or output.

## Review Focus

- **Account switch while history is open:** frontend tests assert prior account's decrypted sessions and output disappear before the next account's data loads (Task 5).
- **Chunk arriving after parent deletion:** Rust sync/storage tests assert it remains hidden and is tombstoned without resurrecting the parent (Task 3).
- **Reconnect after failure:** lifecycle tests assert two distinct attempts and no reopened ended attempt (Task 3).
- **Large or malformed output:** chunking tests assert UTF-8 boundaries, 64 KiB max, 10 MiB cap, and bounded buffering (Task 3).
- **Team-vault misuse:** Go API and Rust tests reject history/preferences records targeting a team vault even when a user belongs to it (Tasks 1 and 2).

---

### Task 1: Server typed encrypted history sync

**Files:**
- Create: `server/internal/models/session_history.go`, `server/internal/models/session_output_chunk.go`, `server/internal/models/session_preferences.go`
- Modify: `server/internal/models/models.go`, `server/internal/models/timestamps.go`, `server/internal/sync/handlers.go`, `server/internal/sync/validation.go`
- Test: `server/internal/sync/handlers_history_test.go`, `server/internal/models/sync_schema_test.go`

**Interfaces:**
- Consumes: existing `PushOperation`, `PullChange`, per-vault authorization, and GORM typed-table dispatch.
- Produces: sync table names `session_history`, `session_output_chunks`, `session_preferences`, each with the standard sync envelope and encrypted `data`; fixed non-identifying `name` values. No host ID or output plaintext columns.

- [ ] Write failing Go tests for push/pull of all three types, duplicate operations, ciphertext-only allowlist, cross-account and team-vault denial, tombstones, pagination, oversized record rejection, and schema migration.
- [ ] Run `GOCACHE=/tmp/termvault-go-build go test ./internal/sync ./internal/models`; confirm the new tests fail for unknown tables or missing models.
- [ ] Add typed models/migration, table dispatch, validation, personal-vault restriction, and vault-delete child checks. Preferences use one deterministic ID per personal vault so concurrent devices converge on one row.
- [ ] Run `GOCACHE=/tmp/termvault-go-build go test ./...` and `GOCACHE=/tmp/termvault-go-build go vet ./...`; require both to pass.

### Task 2: Client typed rows and sync integration

**Files:**
- Modify: `client/src-tauri/src/db.rs`, `client/src-tauri/src/sync_db.rs`, `client/src-tauri/src/sync/coordinator.rs`, `client/src-tauri/src/team_keys.rs`
- Test: Rust tests in `db.rs` and `sync_db.rs`

**Interfaces:**
- Consumes: three server table names from Task 1 and the standard `SyncRow`/`Table`/outbox APIs.
- Produces: local typed tables accepted by `Table::parse`, `list_sync_rows`, `local_mutate`, pull validation, snapshot handling, vault deletion, and local wipe. All writes use v1 account-DEK ciphertext with AAD equal to the table name.

- [ ] Write failing Rust tests for round-trip encrypted rows, personal-vault-only writes, offline outbox/replay, duplicate pull, tombstones, vault wipe, and unreadable ciphertext rejection.
- [ ] Run focused `cargo test --no-default-features --lib` filters and confirm unknown-table/schema failures.
- [ ] Extend all exhaustive table maps and sync lifecycle paths; ensure team vault rows are rejected for these three types before encryption or enqueue.
- [ ] Run the focused Rust tests and `cargo check --no-default-features`; require both to pass.

### Task 3: Rust history lifecycle, recording, and retention

**Files:**
- Create: `client/src-tauri/src/session_history.rs`
- Modify: `client/src-tauri/src/lib.rs`, `client/src-tauri/src/db.rs`
- Test: `client/src-tauri/src/session_history.rs` unit tests

**Interfaces:**
- Consumes: Task 2 typed rows, account `KeySession`, default personal-vault ID, device ID, and existing local mutation/tombstone APIs.
- Produces Tauri commands: `history_start_attempt`, `history_mark_connected`, `history_finish_attempt`, `history_append_output`, `history_list`, `history_get_output`, `history_delete`, `history_recover_interrupted`, `history_get_preferences`, `history_set_retention`, `history_apply_retention`. Inputs carry attempt UUID and vault ID; reads return decrypted summaries/output only while unlocked.

- [ ] Write failing Rust tests for monotonic lifecycle, reconnect as a new attempt, crash recovery, UTF-8 chunk boundaries, 64 KiB chunks, 10 MiB cap, flush-on-end, encrypted-at-rest inspection, synced retention tombstones, idempotent cascade delete, and late orphan chunk suppression.
- [ ] Run focused `cargo test --no-default-features --lib session_history` and confirm failures.
- [ ] Implement one serialized state machine per attempt with bounded output buffer and short periodic flush, then expose commands and register them in `generate_handler!`. Writes must be atomic with outbox, and history errors must not break terminal I/O.
- [ ] Run focused tests, then full `cargo test --no-default-features --lib -- --test-threads=4`; require passes.

### Task 4: Terminal events and per-device recording control

**Files:**
- Modify: `client/src/lib/terminal/sessionManager.ts`, `client/src/stores/settings/settingsStore.ts`, `client/src/components/settings/tabs/TerminalTab.tsx`, `client/src/components/settings/modal/SettingsPanel.tsx`
- Test: `client/src/lib/terminal/sessionManager.test.ts`, `client/src/stores/settings/settingsStore.test.ts`

**Interfaces:**
- Consumes: Task 3 Tauri commands and existing `ssh-output` events.
- Produces: one attempt per connect/reconnect, accurate finish reasons, per-device `recordTerminalOutput` setting (default false), and recording-state notification for the terminal UI. Input events never call the history API.

- [ ] Write failing Vitest tests for SSH/local connect/disconnect/error, reconnect attempt separation, default-off recording, opt-in output-only capture, and recording-write failure that leaves the terminal usable.
- [ ] Run `pnpm vitest run src/lib/terminal/sessionManager.test.ts src/stores/settings/settingsStore.test.ts` and confirm failures.
- [ ] Wire lifecycle events and output buffering to Rust; add setting and copy warning that output can contain secrets and syncs encrypted. Capture the opt-in value at attempt start; changes affect new attempts.
- [ ] Run focused tests, `pnpm exec tsc --noEmit`, and `pnpm biome check .`; require passes.

### Task 5: Real History page and account cleanup

**Files:**
- Modify: `client/src/stores/sessions/sessionStore.ts`, `client/src/components/sessions/views/HistoryView.tsx`, `client/src/stores/auth/authStore.ts`
- Delete: `client/src/components/sessions/views/SessionLog.tsx` (currently unused and misleading)
- Test: `client/src/stores/sessions/sessionStore.test.ts`, `client/src/components/sessions/views/HistoryView.test.tsx`

**Interfaces:**
- Consumes: Task 3 read/delete/retention commands and Task 4 recording setting.
- Produces: filtered session summaries, ordered decrypted output, recording/truncation indicators, deletion errors, locked state, synced retention controls, and immediate clearing of decrypted state on lock/logout/account switch.

- [ ] Write failing frontend tests for list/filter/detail/delete, missing output, truncated output, 7/30/90-day choice, locked read failure, account switch clearing, and visible write/sync errors.
- [ ] Run focused `pnpm vitest run` and confirm failures.
- [ ] Replace placeholder history data with store calls, remove invented command/exit-code labels, connect retention controls, and clear sensitive state on auth transitions.
- [ ] Run focused tests, then `pnpm vitest run`, `pnpm exec tsc --noEmit`, `pnpm biome check .`, and `pnpm build`; require passes.

### Task 6: Cross-layer verification and manual suite

**Files:**
- Create: `docs/SESSION_HISTORY_MANUAL_VERIFICATION.md`
- Modify: `docs/FEATURE_GAP_AUDIT.md`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a two-device/offline/security checklist and accurate feature status. Does not claim live verification before the user runs it.

- [ ] Write manual cases for two devices, offline replay, local/SSH/reconnect/crash, output setting off/on, large output, retention, deletion propagation, account switch, team-host privacy, and SQLite/server ciphertext inspection.
- [ ] Run all relevant Go, Rust, and frontend checks once on the final tree; run `git diff --check` in the monorepo and both submodules.
- [ ] Review the final diff for accidental plaintext logs, tokens, private keys, `.env` files, and unrelated changes. Record any live/platform verification still outstanding.
- [ ] Leave changes uncommitted until the user requests a commit.
