# Real SSH Connect + OS Auto-Detection + Ping — Design

Date: 2026-08-13

## Problem

`connect` in `client/src-tauri/src/lib.rs` is a stub: it emits `connected`, a fake output line, and never stays connected. `send_input`, `resize`, `disconnect`, `accept_host_key` are no-ops. The frontend already decrypts credentials and speaks the `ssh-output` event protocol, so only the Rust engine is missing. Separately, the host `os` field is never populated (client plumbing exists but no `os` payload is ever emitted), and users want a reachability check on host cards.

## Goals

1. Real interactive SSH sessions (password + private key auth) over the existing event protocol.
2. OS auto-detection that populates `hosts.os`:
   - on host create/edit (background, after save),
   - on connect, but only when the db row has no `os` yet,
   - via a ping button on host cards.
3. Ping button: reachability + latency (transient, zustand only) + OS fetch (persisted).
4. TOFU host-key verification with the existing "host key changed" confirmation flow.

Non-goals: SFTP, port forwarding, agent forwarding, local-session changes, chain/kitty terminal features.

## Approach

Pure-Rust async SSH via the `russh` crate (tokio-native, fits Tauri v2 async commands, hermetic Windows builds). Rejected alternatives: `ssh2` (libssh2/C, blocking, OpenSSL build pain) and shelling out to system `ssh` (password auth hacks).

## Architecture

### New module: `client/src-tauri/src/ssh.rs`

One async task per session managed by a Tauri state `SshSessions`:

- `sessions: Mutex<HashMap<String, Arc<Mutex<SshSession>>>>` where `SshSession` holds the `russh::client::Handle`, the `Channel`, and the task `AbortHandle`.
- `known_hosts: Mutex<Vec<KnownHostEntry>>` loaded once from `dirs::data_local_dir()/termvault/known_hosts` (same directory as `device_id`), rewritten on change.

### Session lifecycle (`connect`)

Signature unchanged: `connect(session_id, config: SshConfig)`; `SshConfig` gains `detect_os: bool` (default `false`).

1. Resolve host key via `check_server_key` callback:
   - unknown host+port → compute SHA-256 fingerprint, append to known_hosts, accept (TOFU);
   - known and matching → accept;
   - known and different → emit `ssh-host-key-changed` `{host, port, oldFingerprint, newFingerprint}`, park the handshake on a pending oneshot; `accept_host_key(accepted)` resolves it; rejected → emit `error`/`disconnected`.
2. Authenticate: `authenticate_password(username, password)` or, when `private_key` is present, `russh-keys::decode_secret_key(pem, passphrase)` + `authenticate_publickey`.
3. Open session channel → `request_pty(false, "xterm", cols, rows, &[])` → `shell()`. Initial size: 80×24 unless the frontend supplied a cached size; the client's `resize` command corrects it immediately after connect anyway.
4. If `detect_os`: probe (below) before/while the shell starts; include `os` in the `connected` event payload.
5. Emit `connected` (with optional `os`), spawn a reader loop: read from the channel and emit `ssh-output` `{sessionId, type: "output", data}` until EOF/error, then `{type: "disconnected"}` and clean up state.

### Existing commands get bodies

- `send_input(session_id, data)` → channel write.
- `resize(session_id, cols, rows)` → `request_pty_window_change`.
- `disconnect(session_id)` → abort task, drop handle/channel, remove session.
- `accept_host_key(accepted)` → resolve the parked handshake.

### OS probe (shared)

`probe_os(...)` internally: connect → auth → exec channel `uname -s` → trim → map:

| uname output | stored value |
|---|---|
| `Linux` | `linux` |
| `Darwin` | `darwin` |
| `FreeBSD` / `OpenBSD` / `NetBSD` | `bsd` |
| `SunOS` | `solaris` |
| `MINGW*` / `MSYS*` / `CYGWIN*` | `windows` |
| anything else | trimmed raw string |

Background probes (ping, post-save, connect fallback) auto-accept unknown host keys silently and never open the change prompt; interactive `connect` keeps the prompt. Probe timeout ~5s; failures return `null` os (never fatal).

### New command: `ping_host`

`ping_host(config: SshConfig, timeout_ms: u64) -> {reachable: bool, latency_ms: u64 | null, os: string | null}`:

1. Timed `TcpStream::connect(host:port)` (default timeout 2s) → `reachable` + `latency_ms`.
2. Only if reachable: run the SSH os probe; `os` may still be `null` (auth failed, timeout).

## Frontend changes

### `client/src/stores/hosts/hostStore.ts`

- `createHost` / `updateHost`: after a successful save, fire-and-forget a probe using the form creds (`getCredentialsForHost` → `invoke("ping_host", …)`), then `updateHostOs` on a non-null `os`. All errors swallowed.

### `client/src/lib/terminal/sessionManager.ts`

- Pass `detect_os: !host.os` inside the connect `config` (only probe when the local row has no os). Existing `connected`-payload `os` handling is already in place.

### New store: `client/src/stores/hosts/hostPingStore.ts` (memory-only)

- State: `pings: Record<hostId, {status: "pinging" | "reachable" | "unreachable", latency_ms?: number, os?: string}>`.
- Action `ping(hostId)`: builds config from stored creds (only when address+auth available; otherwise mark `unreachable`… implementation detail: mark `error`-free `unreachable` when no config), invokes `ping_host`, stores reachability/latency, and calls `updateHostOs` when `os` is returned.
- Never persisted → cleared on relaunch by definition.

### `client/src/components/hosts/cards/DraggableHostCard.tsx`

- New ping icon before the edit icon in the card action row.
- Transient status line under the subtitle while a ping result exists:
  - `● 23 ms` green (with `os` appended when returned), `● Unreachable` red, spinner while `pinging`.
- Order: ping → edit → delete (other host-list surfaces with action rows, if edit/delete exist there, get the same icon — verify each during implementation).

## Error handling

- Auth failure → `error` event with a readable message for interactive connect; `null` os for probes.
- Host unreachable / timeout → `disconnected` for interactive; `reachable: false` for ping; probes silently no-op.
- known_hosts I/O failure → log, continue with accept-all for the session (do not crash connect).

## Testing

### Rust unit tests (`ssh.rs`)

- OS mapping table (incl. MINGW/CYGWIN/raw fallback).
- known_hosts: add unknown, match known, detect change (different fingerprint), rewrite persistence via temp files.
- No live-sshd integration tests; manual checklist below.

### TS (vitest)

- `hostPingStore` with mocked `invoke`: success (stores latency, calls `updateHostOs`), unreachable (no call, status set), no-config guard.
- `hostStore`: post-save probe fires once with form creds and swallows errors (mocked `ping_host`).

### Manual checklist

- Ping: reachable host shows latency + os; unreachable shows Unreachable; state clears on relaunch.
- Save-time os detection populates `os`; deleting creds / breaking the host keeps it empty without errors.
- Connect to a host with empty `os` → filled; with `os` present → not re-probed.
- Interactive connect: password and private-key (with/without passphrase) auth.
- Host-key changed flow: change the server key → dialog → accept continues / reject closes.