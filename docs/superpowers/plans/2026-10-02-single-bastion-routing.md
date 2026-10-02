# Single-Bastion Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current branch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route a saved SSH host through one saved bastion for terminal, SFTP, host checks, and saved forwards, validating both host keys and never falling back to direct.

**Architecture:** Store `jumpHostId` only in the destination host's encrypted payload. A Rust resolver validates and decrypts both saved hosts; a route connector authenticates the bastion, opens `direct-tcpip`, and authenticates the destination over the channel. Consumers retain both handles until their work ends.

**Tech stack:** Tauri v2/Rust, russh 0.62, rusqlite encrypted sync rows, React/Zustand/TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-single-bastion-routing-design.md`

## Global constraints

- Work in the current branches; do not create a worktree or branch.
- Do not commit or push until the user explicitly asks, overriding the skill's generic commit steps.
- Keep SSH traffic client-to-remote and secrets/topology inside encrypted host data; no server model/API change.
- One same-vault bastion only; no direct fallback, implicit reconnection, or multi-hop chaining.
- Existing unsaved connections and direct saved hosts retain their behavior.

## Review focus

- Deleted or not-yet-synced bastion: saved connection fails with a route error, without trying direct TCP (Task 2).
- A destination in a team vault referring to a personal bastion: Rust rejects the cross-vault reference (Task 2).
- Changed key on either hop: existing host-key policy runs separately for each address/port and a rejection closes both handles (Task 3).
- Destination connection stalls or is cancelled after bastion authentication: both handles and the channel are released (Task 3).
- A saved remote forward through the bastion: the forward control channel remains alive until stop/pane close (Task 5).

---

### Task 1: Encrypted host route selection

**Files:** Modify `client/src/lib/schema/hosts/hostFormSchema.ts`, `client/src/stores/hosts/hostStore.ts`, `client/src/components/hosts/forms/HostForm.tsx`, and the host-form callers/types; test `client/src/stores/hosts/hostStore.test.ts` and a new HostForm test if the existing suite has no form fixture.

**Interfaces:** Produce optional `Host.jumpHostId?: string | null` and `HostPayload.jumpHostId?: string | null`. Persist it only through `upsertRow("hosts", ..., { plaintext })`. The form accepts `null` for direct and a same-vault saved host ID for bastion.

- [ ] Add tests proving create, edit, reload, and clear preserve `jumpHostId` in encrypted payload while plaintext host-row fields contain no route ID; picker rejects self and already-routed hosts and shows a missing current bastion as an error.
- [ ] Run focused Vitest; confirm these tests fail on current behavior.
- [ ] Implement the type, payload read/write, form selector and validation. Include direct option; filter by current vault and destination ID. Prevent submit on missing/deleted selection.
- [ ] Run focused Vitest, `pnpm exec tsc --noEmit`, and `pnpm biome check .`; require passes.

### Task 2: Resolve and validate a saved route in Rust

**Files:** Create `client/src-tauri/src/ssh_route.rs`; modify `client/src-tauri/src/lib.rs` module registration and `client/src-tauri/src/ssh.rs` host-config loader as needed.

**Interfaces:** `SavedRoute { target_id: String, target: SshConfig, bastion_id: Option<String>, bastion: Option<SshConfig> }`; `resolve_saved_route(db: &LocalDb, crypto: &CryptoState, host_id: &str) -> Result<SavedRoute, String>`. Use the IDs only for context and never include credentials in errors. Reuse `ssh::load_host_config` for both credential sets.

- [ ] Add Rust tests for direct, valid one-bastion, missing/deleted bastion, self-reference, cross-vault reference, malformed ID, and a bastion with its own `jumpHostId`.
- [ ] Run `cargo test --no-default-features --lib ssh_route`; confirm failures.
- [ ] Implement resolution from encrypted host payload. Require an active same-vault host, reject chained/self routes, and do not resolve DNS for the target locally.
- [ ] Run focused Rust tests and `cargo check --no-default-features`; require passes.

### Task 3: Authenticated nested SSH transport

**Files:** Modify `client/src-tauri/src/ssh.rs` and `client/src-tauri/src/ssh_route.rs`; add transport tests to `ssh_route.rs` (or a dedicated integration-test module).

**Interfaces:** `RouteConnection { target: russh::client::Handle<SshHandler>, bastion: Option<russh::client::Handle<SshHandler>> }`; `connect_saved_route(route: &SavedRoute, target_handler: SshHandler, bastion_handler: SshHandler, progress: Option<(&tauri::AppHandle, &str)>) -> Result<RouteConnection, String>`. Factor direct socket/handshake/authentication from `ssh::connect_authenticated` so the same auth routine accepts an `AsyncRead + AsyncWrite + Unpin + Send + 'static` channel stream.

- [ ] Add failing tests with disposable local SSH fixtures: bastion accepts `direct-tcpip`, destination gets an independent SSH handshake and credentials; each hop runs known-host handling; denied channel, auth failure, timeout, changed key, and cancellation close the route without direct fallback.
- [ ] Run focused Rust tests; confirm failures on current behavior.
- [ ] Implement bastion authentication, `channel_open_direct_tcpip(target.host, target.port, ...)`, `channel.into_stream()`, target handshake/authentication, hop-specific errors, timeout, and ownership of both handles.
- [ ] Run focused Rust tests and `cargo check --no-default-features`; require passes.

### Task 4: Terminal, host check, and SFTP consumers

**Files:** Modify `client/src-tauri/src/ssh.rs`, `client/src-tauri/src/sftp.rs`, and any existing tests touching saved connections.

**Interfaces:** `connect_saved`, `ping_host_saved`/OS probe, and `sftp_connect_saved` call `resolve_saved_route` and `connect_saved_route`; unsaved direct APIs stay direct. Terminal task and `SftpSession` retain the bastion handle for the destination lifetime.

- [ ] Add failing tests for a bastion-only destination connecting to terminal and SFTP, routed OS probe/reachability, wrong credentials on each hop, and cleanup on pane/SFTP close.
- [ ] Run focused Rust tests; confirm failures.
- [ ] Replace duplicate saved-SFTP handshake/authentication with the route connector. Route saved terminal and host checks through it; preserve existing events and OS persistence. Show which hop failed without exposing secret material.
- [ ] Run relevant Rust tests and `cargo check --no-default-features`; require passes.

### Task 5: Saved port forwards through the route

**Files:** Modify `client/src-tauri/src/forwarding/runtime.rs` and its tests.

**Interfaces:** `ForwardingState::prepare` resolves the saved destination route, connects through it, and retains `RouteConnection.bastion` for the lifetime of the forward future. Existing local, remote, and dynamic forwarding modes keep their own channel behavior against the authenticated destination.

- [ ] Add failing tests for all three modes through a bastion, route failure without direct fallback, stop and pane-close cleanup, and remote-forward control-channel lifetime.
- [ ] Run focused forwarding tests; confirm failures.
- [ ] Use the shared route connector in `prepare`, keep parent handle alive until stop/cancel, and preserve current status/error transitions.
- [ ] Run focused forwarding tests and `cargo check --no-default-features`; require passes.

### Task 6: Cross-layer verification and manual suite

**Files:** Add `docs/JUMP_HOST_MANUAL_VERIFICATION.md`; update `docs/FEATURE_GAP_AUDIT.md` status/evidence after implementation.

- [ ] Document a two-server bastion-only fixture and manual cases for terminal, SFTP, host check, each forward mode, both host keys, wrong credentials, outage, offline-from-API operation, close/stop, and Linux/Windows/macOS.
- [ ] Run `pnpm vitest run`, `pnpm exec tsc --noEmit`, `pnpm biome check .`, `pnpm build`, and the full Rust library suite with loopback access (`cargo test --no-default-features --lib -- --test-threads=4`).
- [ ] Run `git diff --check` in the monorepo/client; inspect all changed files for plaintext secrets, direct fallback, leaked handles, unrelated changes, and any `.env` file.
- [ ] Leave all changes uncommitted. Report any live-platform verification still outstanding.
