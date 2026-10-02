# Single-bastion SSH routing design

## Purpose and scope

TermVault must connect to a saved SSH host that is reachable only through a saved bastion. The first release supports exactly one bastion for a destination host. Saved terminal, SFTP, host check/OS detection, and all three saved forwarding modes use the same route. Multi-hop chains, SSH agent forwarding, certificates, and unsaved ad-hoc jump configuration are outside this release. Connections remain direct client-to-remote; the TermVault server never proxies SSH.

The app is local-first. A saved route works offline from the TermVault API when the two SSH hosts are reachable on the user's network. Saving a route syncs through the existing encrypted host payload; it does not initiate or automatically restore a connection. Existing direct hosts continue using their present path.

## Saved data and UI

The destination host's encrypted `hosts.data` JSON gains an optional `jumpHostId` string. It is absent or `null` for a direct connection. The ID is never copied into plaintext metadata or a new server column. The same field is surfaced in the frontend `Host`/form types, decrypted only on demand for editing. Host creation and update preserve it in the encrypted payload, including a deliberate change back to “Direct connection.”

The Host form has a “Connect through” selector with “Direct connection” and saved SSH hosts from the destination's current vault. It excludes the destination itself and hosts already configured through a bastion. A selected bastion is identified by its saved host name, with helper text explaining that its own credentials and host key are checked first. Selection never silently changes the destination's authentication fields. Editing an existing host shows its current route; a missing/deleted bastion is shown as an error and must be changed before saving. UI filtering is convenience only: Rust validates the route again at connection time, including stale or maliciously edited synced data.

For this release a bastion must be an active saved host in the same vault as the destination. This keeps dedicated team-vault routes usable by every authorized member and avoids silently depending on one member's personal host. A host cannot route through itself, and the selected bastion cannot itself have a `jumpHostId`; multi-hop and cycles fail with a clear error. Deleting a bastion does not silently reroute dependents directly: they retain the encrypted reference and fail until the user chooses another route or direct connection.

## Connection architecture

Rust loads and decrypts both saved host configs and their key rows. It connects to the bastion with the current SSH library and the existing host-key verification handler. After bastion authentication succeeds, it opens a `direct-tcpip` channel to the destination address and port, then starts a separate SSH handshake over that channel's bidirectional stream. The destination gets its own handler and host-key check, keyed by its destination address/port. Target authentication uses only the target host's saved credentials. DNS for the destination is performed by the bastion; TermVault resolves only the bastion locally.

A shared `connect_saved_route` service owns route validation, the bastion handle, channel stream, destination handle, progress/error context, and cancellation. The bastion handle must remain alive for the whole destination session; dropping or disconnecting a terminal, SFTP browser, or forward stops both hops and closes its channels. Each consumer opens its own routed SSH connection; there is no implicit cross-pane credential/session sharing. An explicit direct/unsaved `connect` or `sftp_connect` invocation continues to use its direct config.

Terminal and SFTP create a destination session through that service. Host reachability/OS detection also goes through it so a bastion-only destination does not appear unreachable; a port check without SSH authentication must not claim that both hops work. Saved local, dynamic, and remote forwards attach to the authenticated destination session, preserving their existing bind and stop semantics. Forward definitions remain stopped after app restart, as previously requested. No consumer falls back to direct TCP if the bastion route fails.

## Security and errors

Both SSH handshakes require normal known-host validation. The current trust-on-first-use policy records a new key; a changed key on either hop prompts in the interactive terminal or fails in background checks. A host-key rejection stops the route. The UI identifies whether the error belongs to the bastion or destination without logging addresses, passwords, private keys, passphrases, or terminal data. Authentication failures likewise name the failing hop. A target connection timeout is bounded; route startup and shutdown honor user cancellation. A failing target handshake releases the bastion connection. Unexpected bastion disconnect propagates to the destination UI/forward status rather than leaving a false “connected” state.

The server continues to see only encrypted `hosts.data` plus its existing neutral host metadata. The route ID is non-secret by itself but remains encrypted so the server does not learn infrastructure topology. Team membership and vault authorization continue to control access to both host rows and their encrypted credentials.

## Verification

Rust tests cover route resolution and rejection (missing/deleted bastion, cross-vault reference, self-reference, chained bastion, malformed ID); direct compatibility; both-hop known-host behavior; each hop's distinct credentials; and cleanup on target/auth/cancel errors. A local SSH test fixture that accepts `direct-tcpip` proves the nested handshake and target DNS/port forwarding behavior. Frontend tests cover create/edit/direct selection, encrypted payload persistence, same-vault filtering, and a deleted reference. Existing terminal, SFTP, and forwarding suites remain green.

Manual checks use two disposable SSH servers: a bastion reachable from the client and a destination reachable only from the bastion. Verify terminal, SFTP, host check, local/remote/dynamic forwarding, each hop's unknown/changed key prompt, wrong credentials, bastion outage, pane close, forward stop, offline-from-TermVault-API use, and no automatic reconnect. Repeat core checks on Linux, Windows, and macOS before claiming platform-wide support.
