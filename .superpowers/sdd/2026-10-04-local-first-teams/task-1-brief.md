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
