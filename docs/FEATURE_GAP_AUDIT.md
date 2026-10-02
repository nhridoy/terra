# TermVault feature-gap and reliability audit

**Audited:** 2026-09-27
**Repository baseline:** monorepo `b17b6a1`, client `7edda97`, server `88f5f5e`
**Purpose:** a durable backlog of unfinished controls, missing capabilities, and verification work. Update the status and evidence here when a feature changes.

## How to read this document

- **Confirmed incomplete** means the current source has an empty implementation, an explicit unavailable message, or a control that cannot do what its label promises.
- **Feature gap** means the capability is advertised by Termius but no equivalent implementation was found in the audited TermVault desktop client/server. Absence from a code search is weaker evidence than a failing live test, so verify scope before starting work.
- **Improvement / verification** means code exists but its quality or platform coverage has not been established by this audit.
- **P0** blocks a core product promise or misleads users; **P1** is a major workflow gap; **P2** is a competitive or quality improvement. Priority is a proposed order, not a release commitment.
- Paths below are relative to the monorepo root. This is a source audit, not a claim that every screen was manually tested. The user manually tested local, remote, and dynamic port forwarding successfully before this audit; those modes are **not** listed as missing.

The comparison baseline is the [Termius feature matrix](https://www.termius.com/pricing), which currently lists SSH/SFTP/Telnet/Mosh/local terminal, forwarding, agent forwarding, jump-host chains, proxies, serial, certificates, FIDO2, group configurations, autocomplete, workspaces, snippets, synchronization, collaboration, and session logs. Specific claims can change; recheck that page when planning parity work. TermVault does not need every Termius feature to be useful. Decide product scope before treating this list as a promise.

## At a glance

| ID | Priority | Status | Gap | Main evidence |
| --- | --- | --- | --- | --- |
| G01 | P0 | Implemented; live device verification pending | Cross-device data sync | Client coordinator and `/sync/push`/`/sync/pull` routes; see `docs/SYNC_MANUAL_VERIFICATION.md` |
| G02 | P1 | Misleading control removed; deletion feature pending | Delete All Data | `client/src/components/settings/tabs/AdvancedTab.tsx` |
| G03 | P1 | Implemented; live SSH verification pending | SSH key generation | `client/src/components/keys/modals/GenerateKeyModal.tsx` |
| G04 | P1 | Implemented; two-device verification pending | Teams and shared vaults | Team APIs, E2EE vault keys, rotation/revocation; see `docs/TEAMS_MANUAL_VERIFICATION.md` |
| G05 | P1 | Confirmed incomplete | Session history and logs | `client/src/stores/sessions/sessionStore.ts` |
| G06 | P1 | Confirmed incomplete | In-app updates | `client/src/stores/update/updateStore.ts` |
| G07 | P1 | Feature gap | Advanced SSH connection/authentication options | `client/src-tauri/src/ssh.rs`; host form/model |
| G08 | P2 | Feature gap | Telnet, Mosh, and serial | Connection UI and backend modules |
| G09 | P2 | Partial feature | Context-aware terminal autocomplete | `client/src/components/terminal/views/CommandAutocomplete.tsx` |
| G10 | P2 | Confirmed incomplete | Tab-group operations | `client/src/stores/sessions/tabGroupStore.ts` |
| G11 | P1 | Fixed for new imports; legacy repair pending | Imported key type | `client/src/components/keys/lists/KeyList.tsx` |
| G12 | P1 | Encrypted-key import implemented; live format verification pending | Key-import format and passphrase coverage | Import modal, `keys.rs`, SSH authentication |
| G13 | P1 | Documentation gap | Product claims and setup instructions | Root `README.md` versus repository layout |
| Q01 | P1 | Verification | SFTP/editor and platform regression matrix | Existing implementations; limited live coverage |

## G01 — Cross-device synchronization

**Current behavior.** The client now saves local encrypted edits and durable operations, then runs authenticated per-vault push/pull against the server change feed. Offline unlock, replay, deterministic conflict handling, tombstones, synced forwarding definitions, and status/retry UI are implemented. Automated Rust, Go, and frontend suites pass. A two-device live run, password/recovery cross-device check, and Windows/macOS verification remain outstanding; use `docs/SYNC_MANUAL_VERIFICATION.md`.

**User impact.** An account can log in elsewhere but cannot rely on its saved setup appearing there. Local edits can look durable while existing only on one device. This also prevents real shared vaults and makes backup/recovery expectations ambiguous.

**Target behavior.** Keep local-first reads and encrypted payloads. Authenticate and authorize every push/pull per vault; transmit only the fields the server is allowed to see; preserve stable record IDs; apply tombstones and revisions; support incremental pulls, retries, idempotency, and conflict resolution. Define what happens while offline, after account switching, and after a server-side deletion. Show pending/error/conflict status in the UI. The server must never need plaintext private keys or other secret payloads. The existing design in `docs/superpowers/specs/2026-08-09-offline-first-design.md` is a starting point, not proof of implementation.

**Acceptance checks.**

- [ ] Device A creates/edits/deletes a host, key, snippet, group, and vault; device B receives the same result after sync.
- [ ] Offline edits survive restart and upload when connectivity returns; duplicate retries do not create duplicate records.
- [ ] Concurrent edits follow a documented conflict rule and neither side silently loses data.
- [ ] A different account cannot read or mutate the first account's rows, including via guessed IDs.
- [ ] The server sees encrypted secret data only; tests cover authorization, revision conflicts, tombstones, and key rotation/recovery interactions.
- [ ] The UI distinguishes local-only, pending, synced, and failed states.

**Dependencies.** This is the foundation for G04; decide whether non-sensitive names/metadata remain plaintext as currently modeled. Audit the default-vault mirror/outbox behavior when general sync lands.

## G02 — “Delete All Data” is a nonfunctional destructive control

**Current behavior.** The misleading button and confirmation dialog have been removed from `client/src/components/settings/tabs/AdvancedTab.tsx`. The page now says account-wide deletion is unavailable. The deletion capability itself remains unimplemented and needs an explicit scope before it returns.

**Target behavior.** Decide and label the exact operation before implementing it: (a) clear this device's local cache, (b) delete all account data on the server and synced devices, or (c) delete the account itself. These are different actions and must not share ambiguous wording. A local wipe needs to stop active SSH/SFTP/forwarding work, clear local SQLite, credentials/tokens in the OS keychain, and relevant app settings in an intentional order. A server/account deletion requires authenticated endpoints, authorization, and an explicit irreversible-data confirmation. On failure, show what was or was not deleted; never close with a success impression.

**Acceptance checks.**

- [ ] The label describes exact scope and the dialog names what will be removed.
- [ ] Confirming either completes that scope or reports a visible error; cancellation changes nothing.
- [ ] Restarting/relogging cannot reveal supposedly deleted local data.
- [ ] Tests cover partially failed deletion, multiple accounts, active sessions, and whether server copies remain.

**Near-term safe option.** Disable or remove the button until its scope and implementation are ready. This avoids a false promise without silently deleting user data.

## G03 — SSH key generation

**Current behavior.** The form now generates Ed25519, RSA 4096, and ECDSA P-256 keys through Rust, shows the public/private key after creation, and stores the private key in the encrypted local row. Automated pair and failure tests pass. Authentication against a live SSH server and at-rest inspection remain to be verified.

**Target behavior.** Generate the selected key type with a cryptographic RNG in Rust, derive the OpenSSH public key and fingerprint, and store the private key through the existing encrypted local-row path. Let the user copy/export the public key and securely export the private key if that is a product requirement. Define passphrase support and whether generation is allowed while the vault is locked. Never persist an empty key under a “generated” status or log private material.

**Acceptance checks.**

- [ ] Each offered algorithm yields a valid private/public pair and the stored type matches the key.
- [ ] The generated private key authenticates to a test SSH server after its public key is installed.
- [ ] Cancel/failure leaves no blank or partial key record.
- [ ] Private material is not rendered later without explicit unlock/reveal and is not present in plaintext DB columns or logs.

## G04 — Teams, invitations, roles, and shared vaults

**Current behavior.** The Teams UI now uses authenticated server routes for team creation, rename/deletion, existing-account invitations, roles, member removal, and dedicated shared vault creation/rename/deletion. A team vault has its own client-generated key, sealed separately to each active member's identity key; sensitive rows are encrypted with that key before sync. Accepted members can edit cached data offline. Removal denies server access, pauses writes, and requires an atomic key rotation. A remaining member's queued old-epoch edits are re-encrypted before upload; a removed member's queued edits remain local with explicit plaintext export or queue discard. Previously cached offline data cannot be erased remotely. Automated Go/Rust/frontend tests pass, but a two-device live run and Windows/macOS checks are still outstanding; use `docs/TEAMS_MANUAL_VERIFICATION.md`.

**Target behavior.** Define team ownership, roles, invitations/expiry, removal, and shared-vault lifecycle on the server. Enforce authorization on every data operation and sync action. Specify the cryptographic sharing design: a personal vault's key must not simply be sent to a team member or stored plaintext on the server. Handle member revocation and rekeying, plus offline clients with previously decrypted data. Make visible controls reflect actual capability; avoid treating a no-op promise as success.

**Acceptance checks.**

- [ ] Owner can create a team, invite a member, assign/change a role, and remove that member.
- [ ] Authorized members can access the intended vault; unauthorized users and removed members cannot fetch new encrypted updates.
- [ ] Share/unshare behavior, invitation errors, and role permissions are clear in UI and covered by backend authorization tests.
- [ ] Offline/revocation limitations are documented honestly.

**Dependency.** Complete G01 and the sharing-key design before promising cross-device shared vault behavior.

## G05 — Session history and logs

**Current behavior.** `client/src/stores/sessions/sessionStore.ts` initializes empty sessions/logs and implements fetch/delete methods as empty async functions. The history and log views exist, but this store cannot load actual recorded sessions. This is distinct from a live terminal pane or terminal reconnect behavior, which do have implementations.

**Target behavior.** Define whether this feature stores connection metadata only, commands, terminal output, or full replay. Recording commands/output has significant privacy implications, so make it opt-in or clearly configurable, encrypt sensitive logs, set a retention policy, and ensure users can delete them. Record start/end/disconnect/error transitions reliably, including crashes. Avoid attributing a shell's typed input to a successful command unless the protocol provides that evidence.

**Acceptance checks.**

- [ ] Opening/closing a test SSH session creates correct metadata and duration; abnormal disconnects are represented.
- [ ] The UI loads, filters, and deletes persisted sessions after app restart.
- [ ] Any command/output recording obeys its setting, retention, encryption, and export/delete rules.
- [ ] No password prompt, private key, token, or other sensitive input is accidentally captured as a command log.

## G06 — In-app updates

**Current behavior.** `client/src/stores/update/updateStore.ts` makes `checkForUpdates()` set `updateAvailable` to false; download and install methods are empty. `client/src/components/update/UpdateNotification.tsx` has a modal for progress and installation, but the store cannot drive it.

**Target behavior.** Choose a real signed-update channel and platform packaging strategy for Windows, macOS, and Linux. Expose version/release notes, download progress, signature verification, install/restart behavior, and actionable errors. Treat development builds and unsupported installation formats explicitly. If updates are not in product scope, remove or disable the unfinished UI instead of implying that checks work.

**Acceptance checks.**

- [ ] A newer signed test release is detected; a current version reports no update.
- [ ] Download/install failure preserves the running app and shows a recoverable error.
- [ ] Update signatures, endpoints, rollback/retry behavior, and platform packages are exercised in release CI.

## G07 — Advanced SSH connection/authentication options

**Current behavior.** The current host/SSH implementation supports direct SSH connections, saved credentials, known-host verification, and the new local/remote/dynamic port forwards. This audit found no corresponding implementation for jump-host/host-chain routing, SSH agent forwarding, SSH certificates, or FIDO2 hardware-backed SSH credentials in `client/src-tauri/src/ssh.rs` and the host configuration UI. Termius lists these features in its [feature comparison](https://www.termius.com/pricing). “No implementation found” should be rechecked if the connection architecture changes.

**Recommended sequence.** Start with jump hosts because private infrastructure often requires a bastion. Model a chain of saved hosts, establish each hop with host-key validation, and route terminal/SFTP/forwarding consistently through the chain. Then add agent forwarding as an explicit per-host permission with clear lifetime and trust implications. Certificates and FIDO2 require separate credential storage, enrollment, and platform support decisions. Also assess proxy support, group-level SSH defaults, and global SSH options; `client/src/components/settings/tabs/SshTab.tsx` says global options are future work.

**Acceptance checks.**

- [ ] A host reachable only through a bastion connects in terminal and SFTP; failures identify the failing hop.
- [ ] Every hop validates its host key and cleans up sessions when the pane closes.
- [ ] Agent forwarding is off by default and cannot be enabled for an unrelated host accidentally.
- [ ] Supported key/certificate/hardware types are documented and tested per platform.

## G08 — Telnet, Mosh, and serial connections

**Current behavior.** The audited connection backend contains SSH, SFTP, and local-terminal implementations, but no Telnet, Mosh, or serial connection module or matching host workflow was found. Termius lists them as supported protocols in its [feature matrix](https://www.termius.com/pricing). These are optional parity targets, not evidence that existing SSH is broken.

**Decisions and acceptance checks.** Choose which protocols matter to TermVault users before building them. Telnet is plaintext and should be visibly labeled as such. Mosh needs different transport/network behavior and a server-side installation requirement. Serial needs device enumeration, port permissions, baud/parity/flow-control settings, and per-OS testing. Each selected protocol should support connect/disconnect, error reporting, tab lifecycle, and saved connection settings; do not present SSH-only controls where they do not apply.

## G09 — Context-aware terminal autocomplete

**Current behavior.** `client/src/components/terminal/views/CommandAutocomplete.tsx` filters stored snippets and a fixed set of common Linux commands. That is useful quick insertion, but it does not learn per-host history, inspect the current command line, complete remote paths/arguments, or adapt to the remote shell. Termius advertises command, argument, and file-path suggestions in its [autocomplete description](https://www.termius.com/free-ssh-client-for-ipad).

**Target behavior.** Preserve the current snippet picker, then decide whether autocomplete should use local session history, a remote shell integration, command metadata, or an optional AI service. Make its data collection and privacy model explicit. Do not send terminal contents to an external service without clear opt-in. Distinguish insertion from execution so choosing a suggestion cannot run a dangerous command unexpectedly.

**Acceptance checks.** Suggestions use current context, keyboard navigation works, insertion preserves the cursor/line, and no suggestion executes without the user's normal terminal action. Test Bash, PowerShell, and other claimed shells separately.

## G10 — Tab groups

**Current behavior.** `client/src/stores/sessions/tabGroupStore.ts` returns an empty list, `null` from creation, and no-ops for fetch/rename/delete. This is separate from `client/src/stores/workspaces/workspaceStore.ts` and terminal layout serialization, which have implementations. Before building tab groups, decide whether they are a distinct feature or an obsolete second model for saved workspaces.

**Target behavior.** Either implement persisted named tab/pane collections with a clear relationship to workspaces, or remove the dead store/UI and use one model. Define whether restoring a group also reconnects hosts; respect the user's explicit choice that **saved port forwards do not reconnect automatically**.

**Acceptance checks.** Create, rename, restore, and delete survive restart; restored panes are correct; absent hosts are handled; no duplicate workspace/tab-group concepts confuse users.

## G11 — Imported SSH keys are mislabeled as Ed25519

**Current behavior.** New imports are inspected in Rust; the parsed algorithm, public key, and SHA-256 fingerprint are saved, and a supplied public key is checked against the derived key. Already imported records with wrong metadata are not repaired automatically. Live RSA/ECDSA authentication remains unverified.

**Target behavior.** Parse the private key once in Rust and return algorithm, derived public key, and fingerprint. Reconcile or reject a manually supplied public key that does not match the private key. Populate `key_type` from the parsed result; do not accept a misleading hard-coded type. Consider a migration/repair path for already imported records.

**Acceptance checks.** Import representative Ed25519, RSA, and ECDSA keys; verify stored type/public key/fingerprint and actual SSH authentication. A mismatched supplied public key gets a clear error or correction policy.

## G12 — Key import format and passphrase coverage

**Current behavior.** Pasted and uploaded PEM/OpenSSH private keys can include a passphrase. Rust validates the passphrase and derives metadata before saving; the passphrase is stored inside the encrypted key payload used by native SSH/SFTP. `.ppk` remains unsupported with conversion guidance. File import and live authentication still need manual verification.

**Target behavior.** Decide supported formats and document them accurately. For encrypted keys, request a passphrase only when required and choose whether to store it in encrypted vault data, request it per connection, or disallow persistence. Validate imported private/public pairs and key algorithm before saving. If `.ppk` remains unsupported, preserve the explicit conversion guidance. Ensure errors are actionable without exposing key contents.

**Acceptance checks.** Test paste and file import for unencrypted OpenSSH/PEM keys, encrypted variants, wrong passphrase, public-only input, malformed files, oversized files, and a `.ppk` file. Confirm that a saved key can actually authenticate through the terminal and SFTP paths.

## G13 — README and product claims are ahead of implementation

**Current behavior.** The root `README.md` advertises team collaboration, session logging, mobile platforms, and old quick-start/API/crypto details. The monorepo currently contains `client/`, `server/`, and `terra-web/` submodules, but no `mobile/` directory was found in this audit. The README uses `npm` even though `AGENTS.md` requires `pnpm`, and some example paths/routes/config values do not match the current server. Treat README claims as unverified until reconciled against code and working release builds.

**Target behavior.** Separate “available now,” “experimental,” and “planned.” Update installation commands, submodule setup, supported operating systems, authentication/crypto description, API paths, screenshots, and the feature table from a real release checklist. Do not claim mobile or collaborative features until they ship. This is a documentation accuracy task, not a request to remove the long-term roadmap.

**Acceptance checks.** A new contributor can clone and follow the README on a supported OS; every listed endpoint and command works; unsupported features are clearly marked; the published README matches the packaged release.

## Q01 — End-to-end reliability and platform verification

**Current behavior.** SFTP, file transfer, remote editing, snippets, workspaces, known-host handling, and reconnect flows have substantial code. Their presence does not establish that every operation works across Windows, Linux, and macOS. The user has manually verified all three forwarding modes. This audit did not run live SFTP/editor/SSH protocol tests, so it does **not** label those features broken.

**Recommended verification matrix.** Use disposable SSH test hosts and representative files/keys. Test SFTP upload/download/rename/delete, permissions, symlinks, large files, interrupted transfers, drag-and-drop, remote edit/save/conflict, snippet insertion versus execution, split tabs and reconnect, known-host changes, and account lock/logout. Run on each claimed desktop OS. Add targeted automated integration tests where protocol boundaries or irreversible file operations are involved. Record exact OS, app version, server version, and result in a release checklist. Keep port-forwarding tests (local, remote, SOCKS5; stop; pane close; no automatic reconnect) in that matrix.

## Proposed implementation order

1. **Remove false-success controls now:** G02. This is small and protects user trust while the larger design is decided.
2. **Build the data foundation:** G01, including conflict handling and observable status. Revisit vault bootstrap against the finished sync protocol.
3. **Finish core key management:** G11, G12, then G03. Correct imported metadata and passphrase behavior before expanding generation.
4. **Enable collaboration on that foundation:** G04, after defining encrypted sharing and authorization.
5. **Decide what to ship in the UI:** G05, G06, and G10 should either become real capabilities or be clearly marked unavailable/removed from release surfaces.
6. **Expand connection coverage selectively:** G07 before G08 if bastion access is a common user need; validate product demand for Mosh/Telnet/serial.
7. **Improve terminal productivity and release confidence:** G09, Q01, and G13. Documentation updates should also accompany each completed item rather than waiting until the end.

## Updating this audit

For each item, record the implementation PR/commit, update **Current behavior** and acceptance checks, and mark it complete only after tests and a relevant live workflow pass. If priorities change, preserve the reason. Do not infer “works” from a visible button or a passing unit test alone. This file is an audit/backlog, not a substitute for individual design specs or security review.
