# Port Forwarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dummy forwarding UI with saved, manually started local TCP, remote TCP, and dynamic SOCKS5 SSH forwards.

**Architecture:** SQLite stores per-host definitions but never runtime state. A Rust manager owns one authenticated `russh` connection per active definition; mode-specific tasks relay traffic and report actual state through Tauri commands/events. The React store invokes those commands and displays mode-specific fields and failures.

**Tech Stack:** Tauri v2, Rust, russh 0.62, Tokio, rusqlite, React, Zustand, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-port-forwarding-design.md`

## Global Constraints

- All modes use saved SSH hosts and load credentials in Rust with `ssh::load_host_config`; never send secrets over frontend IPC.
- Definitions are local to this device, survive restart, and always load stopped. Never reconnect automatically.
- Local and SOCKS listeners bind only `127.0.0.1`; remote bind defaults to `127.0.0.1`, with an explicit `0.0.0.0` choice.
- Supported SOCKS operation: SOCKS5 CONNECT, no-auth, IPv4/IPv6/domain targets. No UDP, SOCKS4, or port-zero allocation.
- Stopping and deleting close active channels and release listeners. Closing the owning pane stops its active forwards and retains definitions.
- Unknown/changed SSH host keys must use an explicit trust flow or fail safely; no silent trust of changed keys.
- Use pnpm for the client. Do not require system `sshd` for automated tests.

## File map

- `client/src-tauri/src/forwarding/model.rs`: serializable definitions, validation, status/error types.
- `client/src-tauri/src/forwarding/storage.rs`: local SQLite CRUD and orphan handling.
- `client/src-tauri/src/forwarding/relay.rs`: TCP/SSH channel byte copying and close semantics.
- `client/src-tauri/src/forwarding/socks.rs`: SOCKS5 handshake parser and replies.
- `client/src-tauri/src/forwarding/runtime.rs`: manager, local/dynamic listeners, remote request, cancellation, events.
- `client/src-tauri/src/forwarding/mod.rs`: Tauri commands and state wiring.
- `client/src-tauri/src/ssh.rs`: expose shared authentication/host-key helpers and receive remote forwarded channels.
- `client/src-tauri/src/db.rs`: create and wipe the local-only table.
- `client/src-tauri/src/lib.rs`: manage forwarding state and register commands.
- `client/src/stores/portforwarding/portForwardingStore.ts`: IPC-backed state and status synchronization.
- `client/src/lib/schema/portforwarding/portForwardFormSchema.ts`: mode-specific Zod discriminated union.
- `client/src/components/portforwarding/{forms/PortForwardForm.tsx,panels/PortForwarding.tsx,cards/ForwardCard.tsx}`: creation, editing, start/stop/delete, status/error UI.
- `client/src/components/terminal/panes/Pane.tsx` and `client/src/lib/terminal/sessionManager.ts`: owner pane ID and stop-on-close lifecycle.

## Review Focus

1. An occupied local port: Start must fail, preserve the other listener, and leave the new definition stopped. Covered in Task 3.
2. Partial SOCKS5 messages and unsupported methods/commands: parser must respond and close without hanging or allocating an SSH channel. Covered in Task 2.
3. Remote bind request denied by server policy: Start must fail and not show active. Covered in Task 4.
4. Stale definitions after saved-host deletion and local-data wipe: they must not be startable or leave credentials behind. Covered in Task 1 and Task 6.
5. Unmounted pane or app shutdown while clients are connected: tasks and local ports must be released, definitions retained. Covered in Task 6.

---

### Task 1: Validated, persisted forward definitions

**Files:** Create `client/src-tauri/src/forwarding/model.rs`, `storage.rs`, `mod.rs`; modify `client/src-tauri/src/db.rs`, `lib.rs`; test in `model.rs`, `storage.rs`, and `db.rs`.

**Interfaces:** Produces `ForwardMode`, `ForwardDefinition`, `ForwardInput`, `ForwardStatus`, `validate(input: &ForwardInput) -> Result<(), String>`, `storage::{list, create, update, delete, delete_for_host}` using `&LocalDb`. `ForwardDefinition` fields: `id`, `host_id`, `mode`, `name`, `local_port: Option<u16>`, `remote_bind_address: Option<String>`, `remote_port: Option<u16>`, `destination_host: Option<String>`, `destination_port: Option<u16>`. `ForwardStatus` is transient: `Stopped|Starting|Active|Failed(String)`. Add `ForwardInput::local(host_id, name, local_port, destination_host, destination_port)` and `ForwardInput::dynamic(host_id, name, local_port)` constructors for tests; production IPC uses deserialization.

- [ ] **Step 1: Write failing Rust tests** for all three valid field sets, missing/invalid fields, port bounds, SQLite round-trip, stale host pruning, and wipe:

```rust
assert!(validate(&ForwardInput::local("h1", "web", 8080, "localhost", 80)).is_ok());
assert!(validate(&ForwardInput::dynamic("h1", "socks", 0)).is_err());
let db = crate::db::open(":memory:").unwrap();
let saved = storage::create(&db, ForwardInput::local("h1", "web", 8080, "localhost", 80)).unwrap();
assert_eq!(storage::list(&db, "h1").unwrap()[0].id, saved.id);
crate::db::wipe_all(&db).unwrap();
assert!(storage::list(&db, "h1").unwrap().is_empty());
```

- [ ] **Step 2: Run red**: `cd client/src-tauri && cargo test --locked --offline forwarding::model forwarding::storage` (run each filter separately if Cargo accepts only one). Expected: missing module/types/tests.
- [ ] **Step 3: Implement** exact enum/structs above, reject irrelevant mode fields, create `port_forwards` with a foreign host ID column and JSON-free explicit fields, add SQLite CRUD and orphan pruning, include table in `wipe_all`; register `mod forwarding` in `lib.rs`.
- [ ] **Step 4: Run green**: `cd client/src-tauri && cargo test --locked --offline forwarding`. Expected: all Task 1 tests pass; run `cargo test --locked --offline db::tests` for wipe regression.
- [ ] **Step 5: Commit in client**: `git add src-tauri/src/forwarding src-tauri/src/db.rs src-tauri/src/lib.rs && git commit -m 'feat: store validated port-forward definitions'`.

### Task 2: Bidirectional relay and SOCKS5 protocol

**Files:** Create `client/src-tauri/src/forwarding/relay.rs`, `socks.rs`; modify `forwarding/mod.rs`; tests in both new files.

**Interfaces:** Consumes `ForwardDefinition`. Produces `relay::bridge(stream: TcpStream, channel: russh::Channel<russh::client::Msg>) -> Result<(), String>` and `socks::read_connect(stream: &mut TcpStream) -> Result<(String, u16), SocksError>`; `SocksError` maps to a SOCKS5 reply code.

- [ ] **Step 1: Write failing tests** for split handshake reads, IPv4/IPv6/domain CONNECT, no supported auth method, unsupported BIND/UDP, malformed lengths, EOF during handshake, and relay full-duplex/half-close with loopback streams:

```rust
let request = [5, 1, 0, 3, 9, b'l', b'o', b'c', b'a', b'l', b'h', b'o', b's', b't', 0, 80];
let (host, port) = socks::parse_connect(&request).unwrap();
assert_eq!((host.as_str(), port), ("localhost", 80));
assert_eq!(socks::parse_connect(&[5, 3, 0, 1, 127, 0, 0, 1, 0, 80]), Err(SocksError::UnsupportedCommand));
```

- [ ] **Step 2: Run red**: `cd client/src-tauri && cargo test --locked --offline forwarding::socks`; expected: missing parser/error. Run relay test filter too.
- [ ] **Step 3: Implement** exact parser/read API and SOCKS5 replies. Use bounded `read_exact` with timeout, `channel.split()`/`ChannelMsg::Data`, and two concurrent copy directions. On local EOF send SSH EOF; on SSH EOF shut down TCP write; cancel both on stop. Avoid unbounded buffers.
- [ ] **Step 4: Run green**: `cd client/src-tauri && cargo test --locked --offline forwarding::socks` and `cargo test --locked --offline forwarding::relay`; expected: pass.
- [ ] **Step 5: Commit in client**: `git add src-tauri/src/forwarding && git commit -m 'feat: add SSH relay and SOCKS5 protocol'`.

### Task 3: Manager and local/dynamic forwarding

**Files:** Create `client/src-tauri/src/forwarding/runtime.rs`; modify `forwarding/mod.rs`, `client/src-tauri/src/ssh.rs`, `lib.rs`; tests in `runtime.rs`.

**Interfaces:** Consumes Task 1 definitions/storage and Task 2 `bridge`, `read_connect`. Produces `ForwardingState::new()`, `start(id: &str, owner_pane_id: &str, db: &LocalDb, crypto: &CryptoState, app: &AppHandle, ssh: &SshSessions) -> Result<ForwardView, String>`, `stop(id: &str)`, `stop_owner(pane_id: &str)`, and `status(id: &str) -> ForwardStatus`. `ForwardView` joins definition + runtime status. Event `forward-status` has `{id, status, error?}`.

- [ ] **Step 1: Write failing tests** with a controlled in-process `russh::server` fixture and loopback echo destination: local forward relays bytes, SOCKS5 CONNECT relays bytes, simultaneous clients work, duplicate bind fails without altering the first, stop releases port, SSH handshake failure leaves stopped/failed. Build fixture as a test module in `runtime.rs`; use ephemeral ports and test timeouts.

```rust
let port = fixture.free_local_port().await;
let first = manager.start_with_fixture(local_definition(port), fixture.clone()).await.unwrap();
let err = manager.start_with_fixture(local_definition(port), fixture).await.unwrap_err();
assert!(err.contains("address") || err.contains("bind"));
assert_eq!(manager.status(&first.id), ForwardStatus::Active);
manager.stop(&first.id).await.unwrap();
```

- [ ] **Step 2: Run red**: `cd client/src-tauri && cargo test --locked --offline forwarding::runtime::tests`; expected: missing manager/fixture methods.
- [ ] **Step 3: Implement** a single-owner state map and cancellation handles; load saved host credentials inside Rust, authenticate via shared `ssh` helper with existing host-key policy, bind loopback before marking active, accept clients into bounded per-client tasks, open `direct-tcpip` and relay. Dynamic mode parses SOCKS then opens `direct-tcpip`. Never hold a mutex across `.await`. Enforce one active task per definition and release resources on all error paths.
- [ ] **Step 4: Run green**: `cd client/src-tauri && cargo test --locked --offline forwarding::runtime::tests`; expected: pass. Run `cargo check --locked --offline --no-default-features`; expected: exit 0.
- [ ] **Step 5: Commit in client**: `git add src-tauri/src/forwarding src-tauri/src/ssh.rs src-tauri/src/lib.rs && git commit -m 'feat: run local and SOCKS SSH forwards'`.

### Task 4: Remote forwarding

**Files:** Modify `client/src-tauri/src/forwarding/runtime.rs`, `client/src-tauri/src/ssh.rs`; tests in `runtime.rs`.

**Interfaces:** Consumes Task 3 `ForwardingState` and Task 2 `bridge`. Produces remote mode within `start`, with `ssh::SshHandler` routing `server_channel_open_forwarded_tcpip(channel, connected_address, connected_port, originator_address, originator_port, reply, session)` to the forward manager's channel receiver. Accept `reply` only for a matching active forward; reject unmatched channels. Stop sends `cancel_tcpip_forward` and drops the SSH handle.

- [ ] **Step 1: Write failing fixture tests**: request for `127.0.0.1:remotePort` succeeds; incoming remote channel reaches local echo destination; denied request leaves failed/stopped; stop cancels request; two remote definitions do not cross-route channels.

```rust
let view = manager.start_with_fixture(remote_definition(remote_port), fixture.clone()).await.unwrap();
assert_eq!(view.status, ForwardStatus::Active);
assert_eq!(fixture.connect_remote(remote_port, b"ping").await.unwrap(), b"ping");
manager.stop(&view.definition.id).await.unwrap();
assert!(fixture.connect_remote(remote_port, b"ping").await.is_err());
```

- [ ] **Step 2: Run red**: `cd client/src-tauri && cargo test --locked --offline forwarding::runtime::tests::remote`; expected: remote mode unsupported or failing assertion.
- [ ] **Step 3: Implement** `tcpip_forward` request and server-forwarded channel callback, match each callback to the correct definition/listen endpoint, connect to `destinationHost:destinationPort` locally, then call `bridge`; stop calls `cancel_tcpip_forward` and drains client tasks. Require explicit remote bind choice for `0.0.0.0`. Surface server refusal from `RequestDenied`.
- [ ] **Step 4: Run green**: same remote filter and entire `cargo test --locked --offline forwarding`; expected: pass.
- [ ] **Step 5: Commit in client**: `git add src-tauri/src/forwarding src-tauri/src/ssh.rs && git commit -m 'feat: add remote SSH forwarding'`.

### Task 5: Tauri API and React UI

**Files:** Modify `client/src-tauri/src/forwarding/mod.rs`, `lib.rs`, `client/src/stores/portforwarding/portForwardingStore.ts`, `client/src/lib/schema/portforwarding/portForwardFormSchema.ts`, and three forwarding components; create `client/src/stores/portforwarding/portForwardingStore.test.ts` and schema tests.

**Interfaces:** Consumes Tasks 1–4 `ForwardingState`/storage. Produces Tauri commands `forward_list(host_id)`, `forward_create(input)`, `forward_update(id,input)`, `forward_delete(id)`, `forward_start(id,owner_pane_id)`, `forward_stop(id)`, `forward_stop_owner(owner_pane_id)`. React actions `loadForwards(hostId)`, `createForward(input)`, `updateForward(id,input)`, `deleteForward(id)`, `startForward(id,paneId)`, `stopForward(id)`.

- [ ] **Step 1: Write failing Vitest tests** for mode-specific schema, list loads all saved definitions stopped, Start IPC failure keeps inactive with message, Create does not start, Stop/Delete call matching commands, and status event updates card state:

```ts
mockInvoke.mockRejectedValueOnce('Address already in use');
await expect(usePortForwardingStore.getState().startForward('f1', 'p1')).rejects.toBeTruthy();
expect(usePortForwardingStore.getState().forwards.find(f => f.id === 'f1')?.status).not.toBe('active');
expect(portForwardFormSchema.safeParse({ mode: 'dynamic', localPort: 1080, name: 'SOCKS' }).success).toBe(true);
```

- [ ] **Step 2: Run red**: `cd client && pnpm vitest run src/stores/portforwarding/portForwardingStore.test.ts src/lib/schema/portforwarding/portForwardFormSchema.test.ts`; expected: missing actions/schema failures.
- [ ] **Step 3: Implement** commands and state managed in `lib.rs`; store loads IPC results and subscribes once to `forward-status`, no synthetic active state. Replace local-only form with mode selector and fields; cards show mode/endpoints/status/errors plus Start/Stop/Edit/Delete. Panel receives `hostId` and `paneId` and never opens for local terminal panes. Failed create/start leaves form/card available for correction. Treat `hostId` as a saved host ID, never as an SSH session ID.
- [ ] **Step 4: Run green**: same targeted Vitest command, `pnpm exec tsc --noEmit`, `pnpm biome check` on changed frontend files, and `cd src-tauri && cargo check --locked --offline --no-default-features`; expected: all pass.
- [ ] **Step 5: Commit in client**: `git add src-tauri/src/forwarding src-tauri/src/lib.rs src/stores/portforwarding src/lib/schema/portforwarding src/components/portforwarding src/components/terminal/panes/Pane.tsx && git commit -m 'feat: manage saved SSH forwards in UI'`.

### Task 6: Pane, host deletion, shutdown, and final verification

**Files:** Modify `client/src/lib/terminal/sessionManager.ts`, `client/src/components/terminal/panes/Pane.tsx`, `client/src/stores/hosts/hostStore.ts`, `client/src-tauri/src/forwarding/runtime.rs`, `storage.rs`, `db.rs`; tests alongside changed modules.

**Interfaces:** Consumes `forward_stop_owner(pane_id)` and storage `delete_for_host(host_id)`. Produces deterministic cleanup on pane/host deletion, app exit and local-data wipe.

- [ ] **Step 1: Write failing tests**: closing owner pane invokes stop_owner once, closing a different pane does not; host deletion removes definitions; wipe removes definitions; app drop cancels active listener/client tasks; reloading saved definitions reports stopped without opening sockets.

```ts
await destroySession('pane-owner');
expect(mockInvoke).toHaveBeenCalledWith('forward_stop_owner', { ownerPaneId: 'pane-owner' });
expect(mockInvoke).not.toHaveBeenCalledWith('forward_delete', expect.anything());
```

- [ ] **Step 2: Run red**: targeted `pnpm vitest run` for cleanup tests and `cargo test --locked --offline forwarding::runtime::tests::shutdown`; expected: missing stop-owner call and unreleased listener.
- [ ] **Step 3: Implement** owner cleanup in session destruction (including tab and pane closure), host deletion cleanup in the Rust storage boundary, RAII cancellation on Tauri app exit, and wipe coverage. Keep definitions intact on normal pane close. Ensure status events cannot resurrect deleted definitions in the frontend store.
- [ ] **Step 4: Run green and full checks**: `cd client && pnpm vitest run && pnpm exec tsc --noEmit && pnpm biome check .`; `cd client/src-tauri && cargo test --locked --offline && cargo check --locked --offline --no-default-features`; expected: zero failures. Manually start each mode against a disposable SSH server, relay bytes, stop, and verify ports are released.
- [ ] **Step 5: Commit in client**: `git add src src-tauri/src && git commit -m 'fix: clean up forwarding across terminal lifecycle'`.
- [ ] **Step 6: Update parent submodule pointer**: from repository root, `git add client && git commit -m 'chore: bump client for port forwarding'`; expected: parent and client working trees clean.
