# Local-First Encrypted Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A previously enrolled TermVault device can reopen and edit offline, then synchronize encrypted saved records with other signed-in devices without losing queued work.

**Architecture:** Keep SQLite writes immediate and atomic with an outbox. A Rust coordinator exchanges opaque encrypted record envelopes with authenticated Go push/pull endpoints; the server maintains current rows, operation deduplication, and a separate monotonic change cursor. Offline unlock uses a locally cached *wrapped* account keyring and the existing password/keychain policy.

**Tech Stack:** Tauri v2/Rust/rusqlite/russh, React/TypeScript/Zustand/Vitest, Go/Gin/GORM/SQLite, Argon2id and XChaCha20Poly1305 already in the client.

**Spec:** `docs/superpowers/specs/2026-09-27-local-first-e2ee-sync-design.md` (read in full before Task 1).

## Global Constraints

- The user's earlier instruction remains in force: **do not commit or push unless explicitly asked**. Each task ends in a reviewable uncommitted state; omit the skill's normal commit step.
- Local operations work after an enrolled device reopens offline. New-device login, signup, and password reset remain online-only.
- Preserve `alwaysAsk`: prompt every launch when on; otherwise use the existing 14-day inactivity/90-day maximum-age OS-keychain policy.
- Sensitive fields are AEAD-encrypted under the account DEK before local or server storage. The server never receives a raw DEK, password, or decrypted sensitive data. User-approved non-sensitive metadata may remain plaintext.
- Synced scope: vaults, groups, hosts, keys, snippets, workspaces, presets, and saved port-forward definitions. Exclude local files, active sessions, session logs, and device preferences.
- Never auto-start a downloaded port forward or auto-reconnect one after restart.
- Persist every time-valued DB field and wire timestamp as fixed-millisecond UTC ISO 8601 (`YYYY-MM-DDTHH:mm:ss.SSSZ`); migrate legacy local integer and server date values before comparing them.
- Same-record conflict order is `(edited_at, device_id, operation_id)`; larger tuple wins. Device clock skew may affect the result, as accepted by the user.
- A server change cursor is globally increasing and separate from per-row version. No whole-vault snapshot overwrites.
- Use `pnpm`, not npm. Complete appropriate Rust, Go, TypeScript, Biome, and multi-device checks before claiming completion.

## Review Focus

1. **Refresh token expired during an offline launch:** Task 2 tests that the enrolled vault still opens locally and queues writes; Task 7 tests that sync waits for online reauthentication.
2. **Server accepted an upload but the response was lost:** Tasks 4 and 6 test operation-ID retry idempotency and exact-operation acknowledgement.
3. **A new local edit happens while its previous operation is in flight:** Tasks 5 and 6 test that the older acknowledgement cannot erase the newer outbox entry.
4. **A pull page contains a malformed/unreadable encrypted record:** Task 5 tests no partial cursor advance and a visible error; the previous local row remains.
5. **Another account or forged owner/vault ID is used in a sync request:** Task 4 tests rejection before any record or event mutation.

---

## File map and dependency order

- `client/src-tauri/src/db.rs`: local schema migration, durable outbox, atomic remote apply/ack. Keep record SQL here; extract a new `sync_db.rs` only if this file becomes unwieldy.
- `client/src-tauri/src/offline_auth.rs` (new): cached profile and wrapped keyring access; no server calls.
- `client/src/stores/auth/authStore.ts`: local-access versus server-session state and offline restore; `AuthGuard.tsx` consumes that distinction.
- `server/internal/models/`: current row models for missing types and sync change/operation tables; model migrations.
- `server/internal/sync/` (new): typed wire DTOs, validation, per-vault authorization, push and pull handlers. Register them in `server/cmd/termvault-server/main.go`.
- `client/src-tauri/src/sync/` (new): wire DTOs, one-cycle engine, scheduling, and Tauri commands. Use the existing Rust `HttpClient`/refresh provider rather than exposing tokens to JS.
- `client/src/stores/sync/syncStore.ts` (new) and `client/src/lib/api/sync.ts`: status and manual trigger. Stores continue local-first writes.
- `client/src-tauri/src/forwarding/storage.rs`: migrate saved definitions to the encrypted synced record path while retaining runtime state locally.
- `client/src/components/layout/shell/Layout.tsx`: surface sync state and trigger after account unlock/reconnection.

Tasks 1–2 make offline reopen independently testable. Tasks 3–4 make server sync independently testable. Tasks 5–6 join local and server. Tasks 7–9 complete scoped data types, status, and end-to-end behavior. Do not enable background sync before the durability/security tests pass.

### Task 1: Canonical timestamps and legacy migration

**Files:** Modify `client/src-tauri/src/db.rs`, `client/src/lib/db/db.ts`, typed client stores/tests that consume `SyncRow` timestamps, `server/internal/models/*.go` (time serialization/migration), and add focused migration tests under the existing Rust/Go test files.

**Interfaces:** Produce Rust `canonical_utc_millis(input) -> Result<String, String>` and Go `CanonicalUTCMillis(time.Time) string`, plus migrated `SyncRow.created_at`, `updated_at`, and `deleted_at` string/null fields. Existing DB rows remain readable. All later tasks use these codecs and field types.

- [ ] **Step 1: Write failing migration/codec tests.** Cover UTC `Z` output with exactly three fractional digits, integer epoch-to-ISO migration, a server legacy date value, `NULL` deletion time, and ordering across timezone offsets after normalization. Assert a pre-migration host survives with its encrypted `data` unchanged.
- [ ] **Step 2: Run targeted Rust and Go tests.** `cargo test --no-default-features canonical_utc` from `client/src-tauri`; `go test ./internal/models -run 'TestCanonical|TestTimestampMigration'` from `server`. Confirm failures reflect missing migration/codec behavior.
- [ ] **Step 3: Implement codecs and migrations.** Convert existing time-valued columns on the local synced tables and affected auth cache, preserve backwards compatibility during the migration transaction, and ensure GORM persists/retrieves canonical UTC values for synced models. Update TS `SyncRow` and store time formatting, using one parser at the boundary rather than scattered `Number(...)` conversions.
- [ ] **Step 4: Run targeted tests, `pnpm exec tsc --noEmit`, and `pnpm vitest run` from `client`.** All must pass. Review the migrated DB with old and new rows before continuing.

### Task 2: Offline enrollment and unlock

**Files:** Create `client/src-tauri/src/offline_auth.rs` and its tests; modify `client/src-tauri/src/db.rs`/`lib.rs`, `client/src/stores/auth/authStore.ts` and tests, `client/src/components/auth/guard/AuthGuard.tsx`, and any minimal keychain helper needed.

**Interfaces:** Rust `save_offline_identity(profile, salt_cl, wrapped_keyring) -> Result<(), String>`, `load_offline_identity() -> Result<Option<OfflineIdentity>, String>`, and `clear_offline_identity() -> Result<(), String>`; `OfflineIdentity` contains account ID/profile and **wrapped** material only. TS auth state gains `localAccessAccountId: string | null` (enrolled account) distinct from `serverAuthenticated: boolean`; exact UI gates use local access plus `isUnlocked` for local CRUD. Existing online auth API stays intact.

- [ ] **Step 1: Write failing Rust cache tests and auth-store tests.** Online enrollment persists only wrapped material; offline restart with `alwaysAsk=true` prompts and unlocks with password; `alwaysAsk=false` uses a valid keychain password and prompts on expired/missing entry; wrong password fails; failed online refresh does not wipe local records or pending edits; explicit logout does.
- [ ] **Step 2: Run `cargo test --no-default-features offline_auth` and `pnpm vitest run src/stores/auth/authStore.test.ts`.** Confirm the new cases fail for the expected server dependency/missing cache.
- [ ] **Step 3: Implement local identity cache and auth state split.** Cache after successful login/signup/recovery/password change; try online refresh without blocking local restore; use cached salt/wrapped DEK for offline unlock; preserve current password-renewal behavior and account-scoped wipe. Rework `AuthGuard` so enrolled locked users can reach the unlock flow offline while un-enrolled users still need login.
- [ ] **Step 4: Re-run targeted tests and manually simulate offline restart in both settings.** Confirm no raw DEK/password in SQLite, online account switching cannot reuse the prior account's cache, and pending edits survive server auth failure.

### Task 3: Server current rows, change log, and operation ledger

**Files:** Create `server/internal/models/workspace.go`, `preset.go`, `port_forward.go`, `sync_change.go`, `sync_operation.go`; modify `server/internal/models/models.go` and model tests.

**Interfaces:** `SyncChange{Seq, VaultID, TableName, RecordID, Envelope, CreatedAt}` with globally increasing server `Seq`; `SyncOperation{DeviceID, OperationID, VaultID, Outcome}` unique on `(DeviceID, OperationID)`; current-record models mirror the approved synced table set. `Seq` is never a row revision. Expose GORM migration only; handlers arrive in Task 4.

- [ ] **Step 1: Write failing model tests.** AutoMigrate creates all tables; two changes on different record types receive increasing cursors; duplicate operation IDs fail the uniqueness constraint; an opaque encrypted `data` blob round-trips; timestamps serialize canonically.
- [ ] **Step 2: Run `go test ./internal/models -run 'TestSyncSchema|TestSyncSequence'` and confirm red.**
- [ ] **Step 3: Add the models and indexes.** Use the current SQLite GORM driver and a serialized write transaction so cursor commit order matches visibility; preserve existing row/table IDs and data. Do not cascade-delete change events before offline peers can pull tombstones.
- [ ] **Step 4: Run model tests and `go vet ./...`.** Verify an existing server DB migrates without dropping current vault/host/key data.

### Task 4: Authenticated, idempotent server push/pull

**Files:** Create `server/internal/sync/types.go`, `validation.go`, `handlers.go`, `handlers_test.go`; modify `server/cmd/termvault-server/main.go`.

**Interfaces:** JSON `POST /api/v1/sync/push {vault_id, device_id, operations:[{operation_id, table, record}]}` returns `{results:[{operation_id, fate, canonical_record, cursor}]}` where fate is `accepted|superseded|duplicate`. JSON `POST /api/v1/sync/pull {vault_id, after_cursor, limit}` returns `{changes:[{cursor, table, record}], next_cursor, upper_cursor, has_more}`. `record` is the typed opaque envelope from the spec; `limit` is bounded server-side. JWT middleware identifies the caller; owner checks use server state, not a client-provided owner ID.

- [ ] **Step 1: Write failing Gin/GORM tests.** Include authorized creation/update/tombstone; repeated operation ID after lost response; newer/older edit tuple and equal timestamp tie-break; two records sharing a row revision but different change cursors; paginated pull; foreign-vault and spoofed-owner rejection; unknown table/oversized/plaintext-sensitive-field rejection.
- [ ] **Step 2: Run `go test ./internal/sync -count=1` and confirm red.**
- [ ] **Step 3: Implement validation and handlers.** In one transaction deduplicate, compare edit tuples, update the typed row, and append the event. Return the canonical winner even to a superseded operation. Pull from a stable upper cursor and never return another user's events. Do not decrypt `data`.
- [ ] **Step 4: Run `go test ./...` and `go vet ./...`.** Assert `server/cmd/termvault-server/main.go` registers both protected routes and unauthenticated requests get 401.

### Task 5: Atomic client mutation, remote apply, and acknowledgement

**Files:** Modify `client/src-tauri/src/db.rs`, `client/src-tauri/src/lib.rs`, `client/src/lib/db/db.ts`, and local DB tests. Extract `client/src-tauri/src/sync/db.rs` if necessary for the sync-specific transaction code.

**Interfaces:** `local_mutate(table, row_or_tombstone, device_id) -> SyncRow` atomically writes row + `operation_id`/generation outbox entry; `pending_batch(vault_id, limit) -> Vec<SyncOperation>`; `apply_pull_page(vault_id, changes, next_cursor) -> Result<(), String>` atomically applies winning remote rows and cursor; `ack_push_results(vault_id, results) -> Result<(), String>` removes only exact matching operation IDs. A remote apply never inserts a local outbox entry.

- [ ] **Step 1: Write failing Rust DB tests.** A crash/rollback cannot save the row without its outbox; a newer local edit survives an older in-flight ack; same-record remote win replaces local row and clears only its superseded operation; local win retains outbox; malformed encrypted record does not advance cursor or replace the prior row; tombstones and initial default-vault hydration behave correctly.
- [ ] **Step 2: Run `cargo test --no-default-features sync_db` and confirm red.**
- [ ] **Step 3: Evolve schema and route every existing `db_upsert`/`db_delete` path through the shared local mutation transaction.** Add a non-outbox remote apply path and matching Tauri DB commands. Preserve existing encrypted blobs; migrate legacy outbox rows into stable operation IDs. Ensure host reorder/OS updates and future forwarding writes also queue changes.
- [ ] **Step 4: Run Rust DB tests, `cargo test --no-default-features`, and `pnpm exec tsc --noEmit`.** Inspect that no server-hydrated row appears as a new local edit.

### Task 6: Rust one-cycle sync coordinator

**Files:** Create `client/src-tauri/src/sync/{mod.rs,types.rs,coordinator.rs}` and tests; modify `client/src-tauri/src/lib.rs` and reuse `client/src-tauri/src/http.rs` client/refresh provider.

**Interfaces:** `run_sync_cycle(vault_id: &str, db: &LocalDb, http: &HttpClient) -> Result<SyncReport, SyncError>` and Tauri `sync_now(vault_id) -> SyncReport`; `SyncReport{pending, last_sync_at, cursor}`. One runner per vault; a cycle pulls, applies atomically, pushes bounded pending operations, acknowledges exact IDs, then pulls again. Auth/network failures keep local state and outbox unchanged.

- [ ] **Step 1: Write failing coordinator tests against a loopback fake server.** Lost push response followed by retry makes one server operation; pull pagination reaches upper cursor; network failure preserves outbox; refresh expiry reports auth-required while offline local reads still work; second local edit during upload remains queued; simultaneous `sync_now` calls serialize.
- [ ] **Step 2: Run `cargo test --no-default-features sync::` and confirm red.**
- [ ] **Step 3: Implement typed wire parsing, bounded batches, and the per-vault lock.** Use Rust token custody and the existing HTTP request classification; do not pass access/refresh tokens through a JS sync body. Emit status changes without encrypted payloads. Register the command and state in `lib.rs`.
- [ ] **Step 4: Run targeted and full Rust tests.** Document any existing unrelated flaky test separately rather than weakening sync assertions.

### Task 7: Background scheduling and visible status

**Files:** Implement `client/src/lib/api/sync.ts`; create `client/src/stores/sync/syncStore.ts` and tests; modify `client/src/components/layout/shell/Layout.tsx` and a compact sidebar/header status component; update relevant auth-store hooks.

**Interfaces:** TS `triggerSync(vaultId?: string): Promise<SyncReport>` invokes Rust `sync_now`; `useSyncStore` exposes `state: 'local-only'|'pending'|'syncing'|'synced'|'offline'|'auth-required'|'error'`, `pendingCount`, `lastSyncAt`, `requestSync()`, and `retry()`. Scheduling uses local-mutation event/debounce, online restoration, and a bounded periodic retry. One in-flight UI request per vault.

- [ ] **Step 1: Write failing Vitest tests.** One edit schedules one debounced cycle; repeated edits coalesce; network failure leaves `pending`; auth expiry shows `auth-required` and retains work; offline startup does not redirect to login; manual retry starts one cycle; UI never labels pending work “synced.”
- [ ] **Step 2: Run `pnpm vitest run src/stores/sync/syncStore.test.ts` and confirm red.**
- [ ] **Step 3: Implement the facade, store, lifecycle wiring, and accessible status display.** Network status is a hint; Rust HTTP result is authoritative. Do not introduce automatic terminal/forward reconnect when connectivity returns.
- [ ] **Step 4: Run targeted tests, full `pnpm vitest run`, `pnpm exec tsc --noEmit`, and `pnpm biome check .`.** Verify offline/online UI transitions manually.

### Task 8: Finish type coverage and port-forward migration

**Files:** Modify `client/src-tauri/src/forwarding/storage.rs`, `client/src-tauri/src/forwarding/mod.rs`, `client/src/stores/portforwarding/portForwardingStore.ts`, `client/src/stores/workspaces/workspaceStore.ts`, other affected stores, and their focused tests. Use the Task 3 server models and Task 5 local mutation APIs.

**Interfaces:** Saved port-forward definitions become vault/host-scoped synced rows; runtime `ForwardingState` remains local and keyed by local pane. Existing local `port_forwards` rows migrate once to the synced representation with stable IDs. Incoming remote definitions are marked stopped, regardless of prior runtime state on another device.

- [ ] **Step 1: Write failing migration/store tests.** Legacy local forwards survive upgrade; a newly saved definition enters outbox; receiving a definition on B yields stopped state and no bound listener; a local Start/Stop does not sync runtime state; a deleted host removes or tombstones associated definitions consistently.
- [ ] **Step 2: Run focused Rust forwarding tests and `pnpm vitest run src/stores/portforwarding/portForwardingStore.test.ts`; confirm red.**
- [ ] **Step 3: Implement the migration and route vault/group/host/key/snippet/workspace/preset/forward writes through the local mutation API.** Verify each table's plaintext whitelist and encrypted `data` before it can enter a push batch.
- [ ] **Step 4: Re-run focused and full Rust/TS suites.** Repeat the user's three-mode forwarding smoke test after the migration; saved definitions must not auto-start.

### Task 9: Cross-device integration and release gate

**Files:** Add dedicated server/client integration tests and a manual test script/checklist in `docs/`; update the approved spec's status and `docs/FEATURE_GAP_AUDIT.md` after implementation. Avoid claiming macOS/Windows passes without running them.

**Interfaces:** Two isolated local databases/devices with the same enrolled account and one disposable server; tests use real push/pull endpoints and crypto boundaries, not mocked store state alone.

- [ ] **Step 1: Write the integration tests before final fixes.** A creates/edits/deletes every scoped type and B converges; A/B change different records offline and both survive; A/B change the same record and the expected UTC tuple wins; recovery/password change preserves decryption; account B cannot access account A; interrupted upload/pull retries; one device's port forward stays stopped on the other.
- [ ] **Step 2: Run the new integration suite and record failures.** Fix only demonstrated gaps in the owning tasks/components, then rerun.
- [ ] **Step 3: Run `go test ./...`, `go vet ./...`, `cargo test --no-default-features`, `pnpm vitest run`, `pnpm exec tsc --noEmit`, and `pnpm biome check .`; run Linux live offline restart with `alwaysAsk` both ways and the three forwarding modes.** Record exact results and unresolved platform limitations.
- [ ] **Step 4: Review security and migration invariants against the spec.** Inspect local/server DB samples for plaintext sensitive fields, ensure logout wipes account-specific cache, and verify no new secret-bearing logs. Leave all changes uncommitted until the user requests a commit.

## Execution notes

Work in the existing three repositories with their real Git/submodule boundaries. Client and server are independent submodules; do not update the monorepo pointers until explicitly authorized to commit. Keep each task's diff isolated enough for review. The server and client wire contract from Task 4 must be frozen before the coordinator and UI tasks rely on it. When a failure reveals an architectural change rather than a task-local bug, update the spec and obtain review before changing the protocol.
