# Port forwarding — design

Date: 2026-09-25

## Purpose and scope

Replace the nonfunctional port-forwarding panel with local TCP, remote TCP, and dynamic SOCKS5 forwarding for saved SSH hosts. Users can save definitions, start and stop them explicitly, and see whether a listener is really running. Definitions survive application restart; no forward starts automatically after restart or host reconnection. This is local device configuration, not vault sync or team sharing.

The existing terminal and SFTP flows remain independent. A forward uses the selected saved host's credentials, decrypted inside Rust; passwords and private keys never cross the frontend IPC boundary for this feature.

## Modes and fields

Each definition has a stable ID, saved host ID, mode, display name, and mode-specific configuration. Ports are integers from 1 through 65535. Hostnames must be nonempty and reasonably bounded. Persist definitions in the client's SQLite database. Runtime status and SSH handles remain only in memory.

- **Local TCP:** `localPort`, `destinationHost`, `destinationPort`. Bind `127.0.0.1:localPort` on the user's computer. For each accepted TCP connection, open an SSH `direct-tcpip` channel to the destination as resolved from the SSH server. Forward bytes in both directions until either side closes.
- **Remote TCP:** `remoteBindAddress`, `remotePort`, `destinationHost`, `destinationPort`. Request an SSH remote listener using `tcpip-forward`; the SSH server chooses its bind policy. For each `forwarded-tcpip` channel, connect from the user's computer to the destination and relay bytes. Default remote bind address is `127.0.0.1`; choosing `0.0.0.0` requires an explicit UI choice and may be refused by server policy. No port-zero allocation in the initial version.
- **Dynamic SOCKS5:** `localPort`. Bind `127.0.0.1:localPort` on the user's computer. Support SOCKS5 `CONNECT` with IPv4, IPv6, and domain-name targets, with no authentication. Open an SSH `direct-tcpip` channel per accepted SOCKS connection. Reject unsupported SOCKS commands and authentication methods clearly. The listener must never bind to a public interface.

No UDP forwarding, SOCKS4, SOCKS5 username/password authentication, or automatic reconnection in this release.

## Architecture

A new Rust forwarding module owns one managed `ForwardingState` with active forward tasks indexed by definition ID. The module loads saved SSH credentials using the existing `load_host_config` path and uses the existing `russh` client and known-host policy. Each running definition owns a separate authenticated SSH connection so terminal shell sessions need no ownership changes. A failed SSH handshake, host-key check, listener bind, or remote forwarding request leaves the definition saved but stopped and returns a useful error. Unknown or changed host keys must use the existing explicit trust flow or fail safely; a forward must never silently accept a changed key.

Expose Tauri commands to list, create, update, delete, start, and stop definitions. Commands return the stored definition and actual runtime status as needed; frontend state must not infer success from an IPC call that returned an error. The Rust module validates inputs even when the frontend form has already validated them. Only one active task may own a definition ID. Two definitions may coexist if their listeners do not conflict. A port bind collision must preserve the original running forward and report the conflict on the new definition.

Starting is explicit. Creating or editing a definition saves it in stopped state. Start authenticates and establishes the relevant listener/request before reporting active. Stop cancels the accept loop or remote request, closes open channels and the SSH connection, and releases the local port. Deleting stops first, then deletes the definition. A running forward records the pane ID that started it. When that pane closes, its active forwards stop; definitions remain saved. Closing a different pane for the same host does not stop them. On app shutdown, active tasks are dropped; on next launch every definition loads as stopped. When an SSH connection dies unexpectedly, transition the forward to failed and release resources; do not reconnect automatically.

## Frontend behavior

The existing port-forwarding panel remains attached to a saved SSH host. Local terminal panes cannot create SSH forwards. Its form gains mode selection and displays only fields relevant to that mode. The list shows mode, bind endpoint, destination where applicable, and `stopped`, `starting`, `active`, or `failed` state. `Start`, `Stop`, edit, and delete actions operate on saved definitions. Creation saves a stopped definition; the user presses Start to activate it. Show errors inline on the affected card and through the existing toast pattern where useful. Do not show a success toast unless the Rust command confirms success. The current dummy store implementation is replaced with Tauri-backed actions; no test fixture values may reach production UI.

## Persistence and deletion

Add a local SQLite `port_forwards` table with `host_id`, mode and validated configuration fields. It is excluded from the sync outbox and server schema. Definitions for a deleted host must not remain startable; clean them up when a host is deleted or prune them on load if the host row no longer exists. Include the table in the client's full local-data wipe. Do not persist `active`, `starting`, or `failed` as status because all definitions start stopped after app launch.

## Verification

- Rust tests for mode and port validation, SOCKS5 request parsing/replies, persistence round-trips, and runtime state transitions.
- Controlled SSH server integration tests for local, remote, and dynamic byte relay; concurrent connections; remote request refusal; listener conflicts; stop/delete/shutdown port release; host-key rejection; and connection loss.
- Frontend tests for mode-specific form validation, list/status rendering, IPC error handling, and stopped-on-load behavior.
- Run client tests, TypeScript and Biome checks, and Rust tests/checks. Manual smoke-test each mode against a disposable SSH server on the current Ubuntu setup; do not use production hosts.
