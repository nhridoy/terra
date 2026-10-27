# Local-First Teams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make SQLite the Teams UI's source of truth and reconcile team metadata and queued changes with the server through background IPC-driven sync.

**Architecture:** Store team snapshots and pending operations in the existing local SQLite database. Add one authenticated, batched server exchange with idempotent operation IDs and a caller-scoped snapshot. A Rust sync coordinator uses the existing `HttpClient`; the webview calls Tauri commands only. Keep generic vault-record synchronization and team-key encryption paths unchanged.

**Tech Stack:** Rust, rusqlite, Tauri v2 commands, reqwest `HttpClient`, Go/Gin/GORM, React/Zustand, Vitest, Go tests.

**Spec:** `docs/superpowers/specs/2026-10-04-local-first-teams-design.md`

## Global Constraints

- SQLite is the source of truth for Teams UI reads and local edits.
- All team-owned HTTP traffic originates in the Rust sync/recipient-key code, not React components or Zustand stores.
- Use the current authenticated HTTP client and server authorization checks.
- Persist timestamps as canonical UTC ISO-8601 strings.
- Store no plaintext vault credentials or raw team keys in team tables or the operation outbox.
- Keep shared-vault record encryption, wrapped team-key storage, and generic sync tables intact.
- A pending local access-control operation is not represented as effective on the server until acknowledged.
- Do not commit or push unless the user explicitly asks.

## Shared Sync Contract

- Route: `POST /api/v1/teams/sync` (Bearer access token).
- Request JSON: `{ "cursor": string|null, "known_vault_epochs": [{"vault_id": string, "key_epoch": u64}], "operations": [{"operation_id": string, "type": string, "payload": object}] }`.
- Response JSON: `{ "results": [{"operation_id": string, "status": "accepted"|"rejected", "error_code": string|null, "error_message": string|null}], "snapshot": {"teams": [], "members": [], "invites": [], "vaults": []}, "envelopes": [], "next_cursor": string|null, "has_more": boolean }`.
- Limits: at most 50 operations, 100 known vault epochs, and 256 KiB total JSON request body; each operation payload at most 32 KiB. Return HTTP 413 for a request exceeding body limits and per-operation validation failures in `results` for otherwise valid batches.
- Supported types and required payload fields: `team.create {team_id,name}`, `team.rename {team_id,name}`, `team.delete {team_id}`, `vault.create {vault_id,team_id,name}`, `vault.rename {vault_id,name}`, `vault.delete {vault_id}`, `invite.create {invite_id,team_id,email,recipient_fingerprint,encrypted_key_envelope}`, `invite.accept {invite_id}`, `invite.decline {invite_id}`, `member.remove {team_id,user_id}`, `member.role {team_id,user_id,role}`, `vault.rotate {vault_id,rotation_id,expected_key_epoch,new_key_epoch,envelopes}`. UUID fields are canonical UUID strings. `role` is an existing server role enum. `vault.rotate` reuses the server's existing rotation validation and transaction rules.
- Cursor is an opaque server-issued string. `cursor=null` requests a complete caller-scoped snapshot. A response with `has_more=true` is followed by another request using `next_cursor`; operations are sent only on the first request of that sync run. A cursor is advanced locally only in the same SQLite transaction that applies its page.
- Idempotency key is `(authenticated_user_id, operation_id)`. Store and replay the original per-operation result. Do not return a prior user's result or expose another account's data.
- The client owns the stable DTO types in `client/src-tauri/src/team_sync.rs`; the Go wire structs mirror the JSON fields above. Local outbox payloads use these same operation type/payload pairs.

## Review Focus

- **Lost response after server commit:** replaying an operation ID must return its prior result without applying the mutation twice; pin this in Task 2.
- **Account switch:** cached teams, invitations, and outbox work must stay scoped to the originating account; pin this in Tasks 1 and 3.
- **Member revocation:** applying a newer snapshot that excludes or removes the current user must revoke local access and wrapped-key use; pin this in Task 3.
- **Stale key epoch:** unchanged epochs must not download/import envelopes again, while a higher epoch must refresh the local wrapped key; pin this in Task 3.
- **Offline security mutations:** removal/role/team deletion remain visibly pending and are not described as server-effective before acknowledgement; pin this in Task 4.

### Task 1: Add local team tables and IPC-backed persistence

**Files:**
- Modify: `client/src-tauri/src/db.rs`
- Modify: `client/src-tauri/src/lib.rs`
- Test: Rust tests in `client/src-tauri/src/db.rs` and Tauri command helpers

**Interfaces:**
- Produces `TeamRecord`, `TeamMemberRecord`, `TeamInviteRecord`, `TeamVaultRecord`, and `TeamOutboxOperation` Rust DTOs, all carrying `account_id`; exposes `list_teams(account_id)`, `list_team_members(account_id, team_id)`, `list_team_invites(account_id)`, `list_team_vaults(account_id, team_id)`, and transactional `enqueue_team_operation(account_id, operation_type, payload) -> operation_id` database functions.
- Produces Tauri commands with equivalent camelCase arguments and return DTOs. Local mutations insert/update the relevant row and the corresponding typed outbox operation in one transaction.
- Reuses `team_vaults`, `team_vault_keys`, and generic `vaults`; it does not route team permissions through generic `SyncRow` writes.

- [ ] **Step 1: Write failing SQLite tests.** Cover fresh schema creation, account-scoped team/member/invite reads, outbox enqueue/update/acknowledge, and atomic rollback when a local mutation cannot enqueue.
- [ ] **Step 2: Run the focused Rust tests and verify the expected missing-table/operation failures.** Run `cargo test --manifest-path src-tauri/Cargo.toml --lib db::team_sync_tests` from `client`.
- [ ] **Step 3: Implement schema migrations and DB functions.** Add stable operation IDs, canonical ISO timestamps, account IDs on every team-owned row, and transactions coupling local writes with outbox insertion.
- [ ] **Step 4: Add typed Tauri commands.** Register commands for local reads and mutations; validate account/team/vault IDs and operation payloads before writing.
- [ ] **Step 5: Run focused tests and `cargo check --tests`.** Verify old SQLite databases open without losing existing generic sync rows or wrapped team keys.

### Task 2: Add an authorized and idempotent server team sync exchange

**Files:**
- Create: `server/internal/teams/sync.go` and focused tests
- Modify: `server/internal/models/` (team-operation idempotency model and migration)
- Modify: `server/cmd/terra-server/main.go`
- Test: `server/internal/teams/sync_test.go`

**Interfaces:**
- Implements the exact `POST /api/v1/teams/sync` JSON contract and limits in **Shared Sync Contract**.
- Produces a caller-scoped snapshot page and key envelopes only for known epochs that are missing or stale. Each operation receives an independent accepted/rejected result; authorization uses the authenticated actor and current server state, never role/owner claims from payloads.

- [ ] **Step 1: Write failing handler tests.** Cover authorization, every operation's role checks, account-scoped snapshots, bounded batches, and cursor continuation.
- [ ] **Step 2: Add idempotency tests.** Simulate the same operation ID twice, including retry after an accepted write, and assert one server-side mutation and a stable result.
- [ ] **Step 3: Run focused Go tests and verify failure for the missing route/model.** Run `GOCACHE=/tmp/terra-go-cache go test ./internal/teams -run 'TestTeamSync'` from `server`.
- [ ] **Step 4: Implement the endpoint by reusing existing authorization/domain rules.** Apply each operation transactionally, record its result under `(user_id, operation_id)`, and return authoritative state without exposing other users' data.
- [ ] **Step 5: Test cursor paging, malformed operations, stale recipient fingerprints, and oversized batches.** Require rejected operations to return structured per-operation errors without aborting unrelated valid operations in the same batch.
- [ ] **Step 6: Run `go test ./internal/teams ./internal/models`, then `go test ./...` and `go vet ./...`.**

### Task 3: Implement the Rust background team sync coordinator

**Files:**
- Create: `client/src-tauri/src/team_sync.rs`
- Modify: `client/src-tauri/src/lib.rs`
- Modify: `client/src-tauri/src/db.rs`
- Modify: existing sync lifecycle wiring in `client/src-tauri/src/sync/`
- Test: Rust unit tests for sync application/retry behavior

**Interfaces:**
- Exposes `run_team_sync(account_id: &str, db: &LocalDb, http: &HttpClient) -> Result<TeamSyncSummary, TeamSyncError>` in `team_sync.rs`; DTOs match **Shared Sync Contract**. `LocalDb` is the existing `client/src-tauri/src/db.rs` wrapper around `Mutex<rusqlite::Connection>`.
- Calls only `POST /api/v1/teams/sync` through `HttpClient`.
- Produces atomic application of accepted operation results and each snapshot page; advances that page's cursor in the same transaction. Network failures retain all unacknowledged outbox entries.
- Emits the existing Terra sync-completion event only after the local transaction commits.

- [ ] **Step 1: Write failing coordinator tests.** Cover operation batching, continuation cursors, retry after network failure, per-account serialization, and no outbox deletion before acknowledgement.
- [ ] **Step 2: Write failing key-epoch tests.** Verify same-epoch snapshots do not import an envelope again and higher epochs do.
- [ ] **Step 3: Implement `run_team_sync(account_id: &str, db: &LocalDb, http: &HttpClient) -> Result<TeamSyncSummary, TeamSyncError>`.** Send at most 50 outbox operations in the first request, apply acknowledgements and snapshot data transactionally, then request subsequent pages with `operations: []` until `has_more == false`.
- [ ] **Step 4: Integrate current-key import and revocation.** Use existing envelope validation/decryption and revocation functions; never persist a raw team key.
- [ ] **Step 5: Add authenticated Tauri commands and lifecycle triggers.** Trigger once after unlock/connectivity return and from explicit retry; prevent overlapping runs per account.
- [ ] **Step 6: Run focused Rust tests and `cargo test --manifest-path src-tauri/Cargo.toml --lib`.**

### Task 4: Replace webview team API/cache access with local IPC

**Files:**
- Modify: `client/src/stores/teams/teamStore.ts`
- Modify: `client/src/stores/teams/sharedVaultStore.ts`
- Modify: `client/src/components/teams/managers/TeamManager.tsx`
- Modify: `client/src/components/teams/managers/SharedVaultManager.tsx`
- Modify: `client/src/components/layout/shell/Layout.tsx`
- Modify: `client/src/lib/api/teams.ts` only for the Rust-owned recipient-key request boundary, if needed
- Test: `client/src/stores/teams/teamStore.test.ts`, `sharedVaultStore.test.ts`, and IPC/API boundary tests

**Interfaces:**
- Zustand read actions call `list_teams`, `list_team_members`, `list_team_invites`, and `list_team_vaults` Tauri commands and populate the UI before requesting sync.
- Mutations call typed `create/rename/delete` and membership/invitation Tauri commands that enqueue one operation; returned records include `sync_status: "pending"|"synced"|"rejected"` and `sync_error: string|null`.
- The app startup path requests background team sync once; page mounts and team selection perform local reads only.
- Recipient-key lookup is the only immediate online exception, and it is invoked through a Tauri command when no usable key is cached.

- [ ] **Step 1: Write failing frontend tests.** Assert page/store reads invoke local commands without calling `teamsApi`, and pending local mutations render before sync acknowledgement.
- [ ] **Step 2: Test duplicate mount behavior.** Simulate Strict Mode-style repeated effects and assert there is one sync request, while local read commands may be safely repeated.
- [ ] **Step 3: Replace direct `teamsApi` reads/writes with IPC commands.** Keep network error handling in the Rust sync status rather than page-load errors.
- [ ] **Step 4: Remove `team-cache.json` as an ongoing store.** Add a one-time importer that validates current-account `teams:` and `vaults:` entries, writes them via IPC, and records a migration marker only after successful transaction completion.
- [ ] **Step 5: Remove duplicate preload/page network paths.** Layout triggers background sync once; TeamManager and SharedVaultManager use SQLite snapshots and never fetch on mount.
- [ ] **Step 6: Verify targeted Vitest tests and run `pnpm vitest run` plus `pnpm biome check .`.**

### Task 5: Verify rate-limit behavior, migration, and user-facing pending states

**Files:**
- Modify: `docs/TEAMS_MANUAL_VERIFICATION.md`
- Modify: `docs/superpowers/specs/2026-10-04-local-first-teams-design.md` only if implementation reveals a necessary design correction
- Test: Rust, Go, and frontend suites plus manual verification checklist

- [ ] **Step 1: Add manual checks for cold launch, offline reopen, offline edits, reconnection, member removal, stale key epochs, and account switching.**
- [ ] **Step 2: Verify route visits make zero team API requests.** Confirm only the bounded Rust background sync endpoint appears after unlock/reconnect or explicit retry.
- [ ] **Step 3: Exercise a rejected offline role/removal operation.** Confirm it remains visibly rejected/pending as appropriate and server authorization remains authoritative.
- [ ] **Step 4: Run all available suites:** `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `GOCACHE=/tmp/terra-go-cache go test ./...`, `GOCACHE=/tmp/terra-go-cache go vet ./...`, and `pnpm vitest run && pnpm biome check .`.
- [ ] **Step 5: Review `git diff --check` at root and in both submodules.** Leave changes uncommitted and unpushed unless the user separately asks.
