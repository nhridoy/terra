# Teams and Encrypted Shared Vaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Existing TermVault accounts can collaborate in dedicated, local-first, end-to-end encrypted team vaults with server-enforced roles, invitations, and safe member removal.

**Architecture:** Keep personal vaults on the current account DEK. Add an independent random key and epoch per team vault, sealed to each accepted member's existing X25519 identity; clients cache only a local account-DEK-wrapped copy. Extend the typed sync protocol's authorization, envelope validation, and rotation barrier, then connect the existing Teams UI to real APIs.

**Tech Stack:** Go/Gin/GORM server; Tauri v2/Rust/SQLite client; React/Zustand/pnpm; X25519, HKDF-SHA256, XChaCha20-Poly1305; existing device-bound sync feed.

**Spec:** `docs/superpowers/specs/2026-09-30-teams-and-encrypted-shared-vaults-design.md` (read it before executing this plan).

## Global Constraints

- Work only in the existing `main` checkouts; do not create a worktree or another branch.
- Do not commit or push unless the user explicitly asks. The normal per-task commit step is replaced by a diff review.
- Invite only existing TermVault accounts; create dedicated team vaults; never silently share a legacy `kind: "team"` vault.
- Personal rows continue using the account DEK and version-1 ciphertext; team rows use per-vault keys and an authenticated vault ID and epoch.
- Membership changes require online server access; accepted members can edit cached team data offline.
- Only the client sees raw account/team keys or sensitive row plaintext. Server-side names, emails, IDs, roles, and UTC ISO-8601 timestamps may be plaintext.
- On removal, revoke server access immediately; rotate keys without publishing partial ciphertext; never claim old offline copies are erased.
- Use `pnpm`, `cargo test --no-default-features`, and `go test ./...` for verification.

## Review Focus

1. Invite recipient's public key changes between lookup and submission: Task 4 tests rejection without creating a usable invite.
2. Old `kind: "team"` vault lacks `team_id`: Task 6 tests that it remains owner-only and uses the personal key.
3. A member reconnects with offline edits during key rotation: Task 10 tests re-encryption and replay once, without losing the outbox.
4. An invite, vault grant, or rotation fails midway: Tasks 4, 5, and 9 test atomic rollback and idempotent retry.
5. A removed user still has a valid access token/device ID: Tasks 6 and 9 test 403 on sync and envelope reads after removal.

---

### Task 1: Server Team Schema

**Files:** Create `server/internal/models/team.go`, `team_member.go`, `team_invite.go`, `vault_key_envelope.go`, `vault_rotation.go`, `team_schema_test.go`; modify `server/internal/models/vault.go`, `models.go`.

**Interfaces:** Add `Vault.TeamID *uuid.UUID`, `Vault.KeyEpoch int`, `Vault.RotationState string`; `Team`, `TeamMember`, `TeamInvite`, `VaultKeyEnvelope`, and `VaultRotation` GORM models. Unique member `(team_id,user_id)` and envelope `(vault_id,epoch,recipient_user_id)` indexes; invite lookup by `(team_id,recipient_user_id,state)`.

- [ ] Write `TestTeamSchemaConstraints`: duplicate member/envelope rejected, a private vault keeps null `team_id`, invitation timestamps are canonical UTC, migration preserves pre-existing vault rows.
- [ ] Run `cd server && go test ./internal/models -run TestTeamSchemaConstraints -count=1`; expect red for missing schema/fields.
- [ ] Add models and register them in `AutoMigrate`, preserving existing data and no automatic sharing for legacy team-labeled vaults.
- [ ] Re-run the focused test; expect green. Review `git diff --check`; do not commit.

### Task 2: Client Sealed-Key Primitive

**Files:** Create `client/src-tauri/src/team_keys.rs`; modify `client/src-tauri/src/lib.rs`, `client/src-tauri/Cargo.toml` and lockfile if HKDF dependency is required.

**Interfaces:** `generate_vault_key() -> Zeroizing<[u8;32]>`, `seal_key_bytes(key: &[u8;32], context: &GrantContext, recipient_public_key: &[u8;32]) -> Result<TeamKeyEnvelope,String>`, `open_key_bytes(envelope: &TeamKeyEnvelope, recipient_private_key: &StaticSecret) -> Result<Zeroizing<[u8;32]>,String>`, and `fingerprint_identity_key(public_key: &str) -> Result<String,String>`. `GrantContext` binds team ID, vault ID, epoch, recipient user ID, and fingerprint. Envelope has version, ephemeral public key, nonce, ciphertext, and context fields. No raw key crosses IPC.

- [ ] Write `team_keys::tests` for round trip, wrong recipient, modified vault/epoch/fingerprint, low-order public key, and invalid envelope; assert no plaintext key in serialized envelope.
- [ ] Run `cd client/src-tauri && cargo test --no-default-features team_keys::tests --lib`; expect red for missing module/functions.
- [ ] Implement ephemeral X25519 + all-zero check + HKDF-SHA256 domain separation + XChaCha20-Poly1305 authenticated context; use existing identity private key and account DEK only after unlock.
- [ ] Re-run focused tests; expect green. Review diff; do not commit.

### Task 3: Local Team-Key Cache and Vault-Aware Row Encryption

**Files:** Modify `client/src-tauri/src/db.rs`, `crypto.rs`, `lib.rs`, `sync_db.rs`; create `client/src-tauri/src/team_keys/storage.rs` only if `team_keys.rs` would otherwise mix envelope and SQLite concerns; modify `client/src/lib/crypto/crypto.ts` only for changed IPC shape.

**Interfaces:** `resolve_row_key(db: &LocalDb, session: &KeySession, vault_id: &str, epoch: u32) -> Result<Zeroizing<[u8;32]>,String>` chooses account DEK for personal/legacy vaults and locally wrapped team key for true `team_id` vaults. Rust IPC commands `create_team_vault_key(vault_id, team_id, recipients: Vec<RecipientKey>) -> Result<Vec<TeamKeyEnvelope>,String>`, `grant_team_vault_key(vault_id, recipient: RecipientKey) -> Result<TeamKeyEnvelope,String>`, and `import_team_key_envelope(envelope: TeamKeyEnvelope) -> Result<(),String>` keep raw keys inside Rust. Team ciphertext version 2 includes `vault_id` and `epoch` as authenticated headers; existing version 1 remains readable. `db_upsert`, `decrypt_secret`, saved-host credential resolution, forwarding storage, and `validate_pull_payloads` use that selector. `team_vault_keys` SQLite table stores only account-DEK-wrapped keys and is cleared by `wipe_all`.

- [ ] Write Rust tests for personal version-1 compatibility, team round trip, wrong vault/epoch rejection, missing/locked key, local wipe, raw key never crossing IPC, and legacy `kind: "team"` remaining personal-encrypted.
- [ ] Run `cd client/src-tauri && cargo test --no-default-features --lib team_keys` plus focused `db`/`sync_db` tests; expect red on team cases.
- [ ] Add the key cache and vault-aware selection at the shared crypto/DB boundary; audit every row decryption caller, including saved SSH/SFTP and forwarding. Never use current UI selection to choose a decryption key.
- [ ] Re-run focused tests; expect green. Review diff; do not commit.

### Task 4: Server Team Lifecycle and Invitations

**Files:** Create `server/internal/teams/handlers.go`, `authorization.go`, `handlers_test.go`; modify `server/cmd/termvault-server/main.go`.

**Interfaces:** `RegisterRoutes(protected *gin.RouterGroup, db *gorm.DB)` exposes `GET/POST /teams`, `GET/PATCH/DELETE /teams/:id`, `GET /teams/:id/members`, `POST /teams/:id/invites`, `GET /teams/invites/mine`, `POST /teams/invites/:id/accept`, `POST /teams/invites/:id/decline`, `DELETE /teams/:id/invites/:inviteId`, role update/removal endpoints. `RoleFor(db *gorm.DB, teamID,userID uuid.UUID) (string,error)` is reused by vault/sync tasks. Invite payload binds existing recipient user ID, exact public-key fingerprint, role, and all current vault envelopes; expiry is seven days.

- [ ] Write handler tests for owner/admin/member permissions, unknown email, invite replay/expiry/cancel/decline, normalized email, role-change rules, public-key change before submit, and atomic rollback if any envelope is missing.
- [ ] Run `cd server && go test ./internal/teams -count=1`; expect red for absent handlers.
- [ ] Implement transactional endpoints and JWT-recipient-bound acceptance; lookup/rate-limit policy must avoid leaking broad account lists. Do not send email in this existing-account-only slice.
- [ ] Re-run focused tests; expect green. Review diff; do not commit.

### Task 5: Team Vault Creation and Grants

**Files:** Create `server/internal/teams/vaults.go`, `vaults_test.go`; modify `server/internal/models/vault.go` only as required by Task 1's schema.

**Interfaces:** `POST /teams/:id/vaults` accepts a new UUID, name, epoch 1, and one encrypted envelope per active member, creating all in one transaction. `GET /teams/:id/vaults` and `GET /vaults/:id/key-envelope` return only authorized metadata/envelope; owner/admin may create/rename/delete, members may view. Server validates recipient set and fingerprint against stored identity keys but never decrypts envelopes.

- [ ] Write tests for all-role grants, missing/duplicate envelope rollback, failed retry idempotence, unauthorized envelope read, key change between lookup/submission, and vault deletion permission.
- [ ] Run `cd server && go test ./internal/teams -run 'TestTeamVault|TestVaultEnvelope' -count=1`; expect red.
- [ ] Implement endpoints and typed model writes; keep personal vault creation and default-vault bootstrap unchanged.
- [ ] Re-run focused tests; expect green. Review diff; do not commit.

### Task 6: Member-Aware Sync Authorization

**Files:** Modify `server/internal/sync/handlers.go`, `validation.go`; create `server/internal/sync/handlers_team_test.go`.

**Interfaces:** Replace owner-only checks with `canReadVault`/`canWriteVault` based on `vault.team_id`, active membership, role, and `rotation_state`. Reject ordinary sync changes to `owner_id`, `team_id`, and `key_epoch`; only dedicated team endpoints change them. Existing personal and legacy team-labeled vaults remain owner-only.

- [ ] Write two-account/device-bound tests: accepted member push/pull succeeds; pending/declined/removed/foreign user gets 403; member cannot mutate vault metadata; old valid token does not bypass revocation; legacy `kind: "team"` stays private.
- [ ] Run `cd server && go test ./internal/sync -run 'TestTeamSync|TestLegacyTeamVault' -count=1`; expect red.
- [ ] Implement authorization and epoch/rotation validation in the same transaction as push, and before returning pull changes.
- [ ] Re-run focused tests; expect green. Review diff; do not commit.

### Task 7: Client Team API, Discovery, and Offline State

**Files:** Create `client/src/lib/api/teams.ts`, `client/src/lib/api/teams.test.ts`; modify `client/src/stores/teams/teamStore.ts`, `sharedVaultStore.ts`, `client/src/stores/vault/vaultStore.ts`, `client/src/lib/sync` coordinator/scheduler files as located in the repo; add focused store tests.

**Interfaces:** Typed `teamsApi` wraps Task 4/5 endpoints. `teamStore` loads teams, roles, invitations, and handles server errors without optimistic success. `sharedVaultStore` creates dedicated online vaults, seals grants through Task 2 commands, accepts invitations, imports envelopes into Task 3 cache, and discovers accessible vaults before per-vault sync. Existing `vaultStore` identifies true team vaults via `team_id`, not `kind` alone.

- [ ] Write frontend tests for invite accept/decline, error retention, duplicate retry, new-device/login hydration, offline accepted-vault access, missing key not advancing sync, and logout/account switch clearing team state.
- [ ] Run `cd client && pnpm vitest run src/lib/api/teams.test.ts src/stores/teams`; expect red.
- [ ] Implement typed API and store wiring, with membership/epoch refresh before team-vault push and key fetch before pull validation.
- [ ] Re-run focused tests; expect green. Review diff; do not commit.

### Task 8: Team and Vault UI

**Files:** Modify `client/src/components/teams/managers/TeamManager.tsx`, `SharedVaultManager.tsx`, `client/src/components/teams/forms/InviteMemberForm.tsx`, `client/src/components/vault/selector/VaultSelector.tsx`, `client/src/components/vault/forms/VaultForm.tsx`; add focused component tests where existing harness permits.

**Interfaces:** Teams UI displays roles, invite state, fingerprint verification, accept/decline, and real shared vaults. A true team vault is created only from its team context; the generic vault form must not create a misleading `kind: "team"` private vault. Save/confirm buttons await store/API results and show errors. Member removal warns about offline copies; rotation/revocation states are visible.

- [ ] Write UI tests for pending invite, fingerprint confirmation, failed invite/create preserving form, role-gated controls, legacy vault staying private, and rotation-required/revoked labels.
- [ ] Run `cd client && pnpm vitest run src/components/teams src/components/vault`; expect red for missing behavior.
- [ ] Wire components to Task 7 stores; remove no-op placeholder and misleading controls while preserving keyboard/accessibility behavior.
- [ ] Re-run focused tests; expect green. Review diff; do not commit.

### Task 9: Server Revocation and Atomic Rotation

**Files:** Create `server/internal/teams/rotation.go`, `rotation_test.go`; modify `server/internal/sync/handlers.go` for epoch barrier.

**Interfaces:** `DELETE /teams/:id/members/:userId` immediately revokes and marks each team vault rotation-required. `POST /vaults/:id/rotation/stage` accepts encrypted snapshot batches and new member envelopes bound to expected old epoch/revisions; `POST /vaults/:id/rotation/commit` atomically validates full live row set and publishes epoch/change-feed boundary. Same operation ID retries are idempotent; incomplete staging never becomes visible.

- [ ] Write tests for immediate removed-user 403 with old token, paused writes, partial-stage rollback, duplicate stage/commit, stale revision rejection, interrupted retry, and remaining member's new-envelope access.
- [ ] Run `cd server && go test ./internal/teams -run 'TestRemoveMember|TestRotation' -count=1`; expect red.
- [ ] Implement durable staged rotation with transaction barriers; never expose plaintext or a mixed-epoch feed.
- [ ] Re-run focused tests and `go test ./internal/sync`; expect green. Review diff; do not commit.

### Task 10: Client Rotation and Offline-Edit Rebase

**Files:** Create `client/src-tauri/src/team_keys/rotation.rs`; modify `client/src-tauri/src/sync/coordinator.rs`, `sync_db.rs`, `client/src/stores/teams/sharedVaultStore.ts`.

**Interfaces:** `rotate_team_vault(vault_id: String, expected_epoch: u32, recipients: Vec<RecipientKey>, device_id: String)` stages re-encrypted live rows and envelopes, commits server rotation, then installs the new local key. A remaining member reconnecting with old-epoch pending edits retains the old key until each edit is re-encrypted and acknowledged under the new epoch. A revoked account quarantines pending edits and receives explicit export/discard actions; no silent loss.

- [ ] Write Rust/client tests for rotation crash at each boundary, resume from staged state, stale epoch, old pending edit rebased once, removed-member outbox quarantined, no mixed-epoch local rows, and key zeroization after logout.
- [ ] Run `cd client/src-tauri && cargo test --no-default-features team_keys::rotation --lib`; expect red.
- [ ] Implement the rotation coordinator and team sync preflight using Tasks 3/9 interfaces; use bounded batches and existing idempotent operation IDs.
- [ ] Re-run focused and sync tests; expect green. Review diff; do not commit.

### Task 11: End-to-End Verification and Documentation

**Files:** Create `docs/TEAMS_MANUAL_VERIFICATION.md`; modify `docs/FEATURE_GAP_AUDIT.md`, root `README.md` only where feature claims/setup change; add integration tests beside existing server/client tests as gaps appear.

**Interfaces:** Manual matrix uses two existing accounts on two devices and records OS/app/server versions, vault-key fingerprints, online/offline state, expected/actual result. It covers invitation, two-way sync, restart, recovery, removal with an offline former member, interrupted rotation, and ciphertext inspection. No production secrets in fixtures or logs.

- [ ] Add meaningful integration tests for account isolation, cross-vault key separation, and two-member sync if the previous focused tests do not already exercise the full path.
- [ ] Run `cd server && go test ./... && go vet ./...`; `cd client/src-tauri && cargo test --no-default-features`; `cd client && pnpm vitest run && pnpm exec tsc --noEmit && pnpm biome check .`; expect zero failures. Run `git diff --check` in root, client, and server.
- [ ] Write the manual suite and update the audit with exact automated evidence and any remaining live/platform limitations; do not mark the feature live-verified without the two-device run.
- [ ] Review all three diffs for plaintext leakage, status, and unintended files. Leave changes uncommitted until the user explicitly requests a commit.
