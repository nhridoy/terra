# TermVault local-first encrypted synchronization

**Date:** 2026-09-27
**Status:** Implemented in working tree; automated tests pass, live cross-device/platform verification pending
**Supersedes for this feature:** `2026-08-09-offline-first-design.md` where it conflicts with this document
**Baseline:** monorepo `b17b6a1`, client `7edda97`, server `88f5f5e`

## 1. Product contract

A user signs in online at least once per device. Thereafter that device can restart without internet, unlock its locally cached vault, browse saved data, and make changes. The device writes every change locally first. Once connectivity and a valid server session are available, it uploads pending changes and downloads changes from the user's other devices. Multiple devices can remain signed in simultaneously.

A setting already controls whether the app requests the password at each launch. Keep that behavior offline: when enabled, request the password on every launch; otherwise use the existing OS-keychain auto-unlock policy. A new-device login, account creation, password reset, and server-side authentication still require internet. Explicit logout removes the device's locally cached account data and credentials.

Sensitive record fields are encrypted before either database stores them. The same client-generated data-encryption key (DEK), wrapped by a password-derived key and by the recovery mechanism, remains the basis for access on all devices. The server authenticates and authorizes sync but never receives the DEK, password, or decrypted sensitive fields. Non-sensitive metadata may remain plaintext, per the user's decision. This is **field-level encryption**, not whole-file SQLite encryption. An OS user with access to the database file may inspect allowed metadata, even while the app is locked.

Saved vaults, groups, hosts, SSH keys, snippets, workspaces, presets, and port-forward definitions synchronize. Live terminal/SFTP sessions, local files, session logs, and device-specific preferences do not. Receiving a port-forward definition never starts a tunnel. Existing locally saved forwards remain stopped after app restart unless the user presses Start.

For simultaneous edits of the same record, choose the latest device edit timestamp automatically. Persist all timestamps in both databases and the wire protocol as canonical UTC ISO 8601 with fixed millisecond precision (`YYYY-MM-DDTHH:mm:ss.SSSZ`). Use `(edited_at, device_id, operation_id)` as a deterministic total-order key. UTC formatting removes timezone ambiguity; an incorrectly set device clock can still select the wrong edit. The user accepts that limitation. A losing edit is not exposed in a conflict picker in this scope.

## 2. Current state and required corrections

The existing client already has local SQLite tables, tombstones, an outbox, a conflict table, and encryption of each row's sensitive `data` payload. The Rust HTTP proxy owns tokens and refreshes them. The server has typed vault/group/host/key/snippet models and a default-vault endpoint. `client/src/lib/api/sync.ts` is empty; there are no server sync endpoints. The server also lacks models for workspaces, presets, and port forwards. Existing outbox rows identify a table and record but do not carry a durable operation ID or an acknowledgement guard.

Offline restart does **not** work yet. `restoreSession()` in `client/src/stores/auth/authStore.ts` requires a server refresh, and `unlock()` fetches the keyring from the server. The local `user_keys` table exists but is not populated by the current auth flow. The new design must cache a verified profile, salt, and wrapped keyring locally after successful online login, and must distinguish local vault access from a currently valid server token.

The earlier offline-first draft treats per-row revisions as a whole-vault pull watermark. That is incorrect: a new change to one row could share or fall below another row's revision. Use a separate server-assigned, globally increasing change cursor instead. The earlier draft also specified interactive conflict retention; this design replaces it with the user's chosen automatic last-write-wins rule.

## 3. Boundaries and components

```text
React stores and views
  ├─ local reads/writes via Tauri DB commands
  ├─ auth state: local access vs online server session
  └─ sync status / manual retry / connectivity signals
                    │
                    ▼
Rust Tauri
  ├─ local SQLite: records + durable outbox + pull cursor + cached wrapped keyring
  ├─ crypto: password-derived KEK, DEK unwrap, AEAD encrypt/decrypt
  ├─ sync coordinator: single runner per vault, transactional apply/ack
  └─ HTTP proxy: access-token custody, refresh, authenticated requests
                    │ encrypted row envelopes only
                    ▼
Go server
  ├─ JWT auth and per-vault authorization
  ├─ typed current-record tables
  ├─ operation-id deduplication
  └─ append-only change feed with server cursor
```

The Rust local DB/crypto boundary owns atomic write, encryption, outbox, and merge decisions. React stores continue to present local rows immediately. React requests sync and displays status; it does not hold decrypted data in a network upload buffer or invent server revisions. The Go server validates metadata, IDs, ownership, envelope shape/size, and operation order but treats encrypted `data` as opaque. Authentication and sync are separate: a locally unlocked vault is usable without a server token, but no upload/download occurs until server authentication succeeds.

Do not introduce a second way to write synced records that bypasses the outbox. Existing `db_upsert`, `db_delete`, host reorder, OS metadata update, and new forwarding-definition writes must use the same transactional mutation path. Account keyring/profile caching is separate from ordinary record sync and is never uploaded through the outbox.

## 4. Data model and encryption boundary

Each synced record has a stable UUID, vault ID (or owner ID for a vault), type, allowed metadata, encrypted `data` blob, deletion tombstone, canonical `edited_at`, editing device ID, operation ID, and a server-assigned row version. The server stores the latest accepted row plus a change event. The change event contains the resulting row envelope or tombstone and a server cursor; it does not contain decrypted data.

Allowed plaintext is limited to structural IDs, owner/vault relationships, type, ordering, deletion status, edit/sync timestamps, and user-approved non-sensitive display metadata such as vault/group/host/key/snippet/workspace names. Existing public SSH keys and fingerprints may remain plaintext because they are not secret; private keys, passwords, usernames/address fields currently encrypted in `data`, commands, workspace layouts, and other sensitive content remain encrypted. Before implementation, enumerate every serialized field per table and enforce the whitelist in server request validation and tests. A field's existing local plaintext status is not by itself authorization to expose it remotely.

Local rows use the existing AEAD mechanism and account DEK. The server receives the same ciphertext, not a separately decrypted representation. The cached offline keyring contains only the password-wrapped DEK, recovery-wrapped DEK as needed, account salt, and wrapped account private-key material; never a raw DEK. On online login, signup, successful recovery, and password change, update the cache atomically. Preserve the current recovery-key semantics: password change rewraps the existing DEK; recovery supplies access to that same DEK and rotates recovery material. A new device downloads the account keyring online before any record decryption.

The current server uses SQLite through GORM. This feature must work with that actual driver first. Claims about other SQL engines require their drivers and integration tests. Timestamp migration covers all time-valued persisted fields touched by auth/sync and all synced tables, including old SQLite integer epochs and existing server date formats. New persisted datetime fields use the canonical UTC ISO form, with a parser/migration for legacy values. Do not compare mixed legacy and canonical timestamp strings lexicographically.

## 5. Offline identity and unlock

After a successful online login, enroll the device for offline use by atomically caching: account ID/profile, salt and wrapped keyring, last verified account identity, and the existing refresh-token/keychain policy metadata. Keep the raw refresh token in the OS keychain as today. On startup, attempt online refresh in the background but do not make local access depend on it. If the network is unavailable, load the enrolled account and show a locked local state. `AuthGuard` must permit that state without mistaking it for a fresh server-authenticated session.

If `alwaysAsk` is on, require password input every app launch and derive the KEK locally from the cached salt. Otherwise, attempt the existing OS-keychain password path and its renewal/expiry rules; if unavailable or invalid, show the password prompt. Unwrap the cached DEK locally. A wrong password fails without contacting the server or corrupting the cache. Once unlocked, all local CRUD operations and local terminal/file workflows operate without sync. Online signup/login on a new device first downloads the keyring and records; offline access cannot bootstrap an unknown account.

Explicit logout clears the local cache, local records/outbox, keychain credentials, and in-memory keys under the existing logout semantics. A server-side revocation, password reset elsewhere, or remote logout cannot be detected while offline; the previously enrolled device may still access its cached data until reconnection or local logout. On reconnect, a rejected session stops sync, locks or reauthenticates according to the auth policy, and **retains pending edits** until the user successfully signs in to the same account. Never upload those edits under another account. Do not silently wipe pending edits on token-refresh failure. Explain this offline revocation limit in security documentation.

## 6. Local mutation and outbox

A local mutation is one SQLite transaction: encrypt sensitive payload if needed; write the record or tombstone; assign a new operation UUID, canonical `edited_at`, and device ID; then insert/replace the pending outbox state. The UI reads the resulting row immediately. Repeated edits of the same record may coalesce to the latest local state, but a captured in-flight operation must remain distinguishable from a newer edit. Persist the outbox across crashes and app restarts. Local reads never wait for the network.

The current outbox schema `(table_name, record_id, queued_at)` must evolve to include operation ID and an edit generation/version (or equivalent). An acknowledgement may remove a pending entry **only if** it still matches the operation that was sent. A later local edit must remain queued. Imported default-vault metadata must not be mistaken for a new user-created vault: initial hydration writes local rows without creating an outbound mutation, or marks a matching seed as acknowledged.

Deletes produce tombstones and sync just like updates. Keep tombstones and change-log events long enough that a device returning after an extended offline period does not resurrect deleted rows; indefinite retention is the safe initial policy. Whole-vault deletion requires special authorization and descendant behavior; do not let SQL cascades silently erase records needed by other devices' cursors. Sync port-forward **definitions** as vault/host-linked encrypted records, but keep running state, bound sockets, SSH sessions, and pane ownership local only.

## 7. Server protocol and ordering

Use authenticated, versioned endpoints (for example `POST /api/v1/sync/pull` and `/push`) through the existing Rust HTTP proxy. Requests specify a vault, device ID, and bounded batch size. Every endpoint verifies that the authenticated user owns or is allowed to access that vault. Team-vault authorization is reserved for the separate sharing feature; do not grant team access merely because a client labels a vault `team`. Validate each row's type, relationship IDs, size, and allowed plaintext fields. Reject client attempts to change server-owned owner/authorization fields.

**Push.** Each operation carries an immutable operation ID, record identity, encrypted envelope/tombstone, and edit-order tuple `(edited_at, device_id, operation_id)`. In one server transaction, deduplicate the operation ID, compare the tuple to the stored winning tuple, apply the newer state or return the current winner, increment the server row version on an accepted state change, and append one change-feed event with a globally increasing server cursor. An identical retry returns the same result without another event. A stale loser is acknowledged as superseded and returns the canonical winning row so the client can converge automatically.

**Pull.** The client sends its last committed server cursor. The server captures an upper cursor and returns authorized change events with `cursor > last_cursor AND cursor <= upper_cursor`, ordered by cursor and paginated. The cursor is a server sequence, **not** a row revision or edit timestamp. Gaps caused by other vaults are harmless. A pull page includes a next cursor; after the final page, the client can retain the upper cursor. The server must never advertise a cursor past events not yet visible to this transaction. Append event and update current row atomically. The server retains enough history for every supported offline interval; the initial version retains history without automatic pruning.

**Client convergence.** Apply a pull page and its cursor in one local transaction. If the incoming record and a pending local mutation conflict, compare their edit-order tuples. The winner becomes the visible local row. If the remote row wins, clear the superseded local operation only when its ID still matches; if the local row wins, keep it queued for push. After a push response, apply the returned canonical row/version and acknowledge only the exact sent operation. A single runner per vault prevents overlapping pull/push cycles. A cycle pulls, resolves against pending local edits, pushes the remaining batch, then pulls again until caught up or bounded by work/time limits. Background scheduling resumes later if more work remains.

This last-write-wins policy intentionally discards the losing value from the active record. There is no interactive conflict screen in this release. The server change log and bounded diagnostics can support troubleshooting, but they are not a user-facing history/recovery guarantee. Clock skew is accepted as stated above; avoid claiming this algorithm always finds the chronologically last human action.

## 8. Scheduling, errors, and UI

Request sync after successful online auth/unlock and initial hydration, after local edits with a short debounce, after confirmed reconnection, periodically while pending, and via a manual “Sync now” action. `navigator.onLine` is a hint only; actual HTTP success/failure determines reachability. Use retry with bounded exponential backoff and jitter. Avoid retry storms and keep per-vault jobs serialized. Do not sync decrypted content in logs or browser network diagnostics.

Expose `local-only`/not-yet-enrolled, `pending`, `syncing`, `synced`, `offline`, `auth-required`, and `error` states with a pending count and last successful sync time. “Synced” means all acknowledged local operations are committed and the pull cursor is current for the last completed cycle, not that another disconnected device has uploaded its work. A network/server failure leaves local data and the outbox untouched. An auth failure pauses sync and routes to reauthentication without assigning queued edits to a different account. A malformed encrypted payload or decryption failure stops application of that record, reports an actionable error, and does not advance the pull cursor beyond it.

Re-downloading a saved port-forward definition updates the settings/card only. It never invokes Start or reopens an SSH connection. Any design for other auto-reconnect features must respect this explicit user choice.

## 9. Migration and rollout

1. Add canonical UTC ISO timestamp codecs/migrations for affected local and server tables; prove old records remain readable. Keep auth and recovery compatibility throughout.
2. Implement offline enrollment/cache and local unlock; verify both `alwaysAsk` settings, expiry rules, logout, and reconnect behavior before enabling sync.
3. Add server models for missing synced types (workspaces, presets, port-forward definitions), operation deduplication, and the change feed. Add authenticated, authorized push/pull APIs.
4. Extend local outbox and add transactional remote apply/ack/cursor operations. Route every synced store mutation through them. Hydrate default and existing vaults without generating false outbound edits.
5. Add the Rust sync coordinator and client status UI; enable background scheduling and manual retry.
6. Roll out incrementally to test accounts/devices; verify migrations, offline data preservation, and failure recovery before broad release.

These are implementation phases within one architecture. Each phase must leave existing local records usable; do not deploy a server schema that rejects an older released client without an explicit compatibility policy. Existing local port-forward definitions need a migration to their new synced representation without automatically starting them.

## 10. Required verification

- **Crypto/DB:** encrypted sensitive fields at rest locally and server-side; allowed plaintext whitelist only; password and recovery paths decrypt the same cross-device data; wrong password fails; no raw keys in logs. Legacy timestamp and local-row migration preserves data.
- **Offline startup:** enroll online, quit, disable network, reopen, unlock with `alwaysAsk` on and off, edit every synced record type, quit/reopen still offline, verify edits remain. A device never enrolled cannot create an offline account session.
- **Two devices:** create, edit, reorder, and delete all synced record types on A; hydrate B. Edit different items offline on A/B and verify both survive. Edit the same item offline and verify the later edit-order tuple wins on both devices after reconnection, including deterministic equal-timestamp tie breaks.
- **Crash/retry:** interrupt between local write/outbox insertion, after server accepts push but before acknowledgement, during paginated pull, and after a newer local edit while an older push is in flight. Verify no lost or duplicate visible records and no cursor advance without applied data.
- **Auth/authorization:** one account cannot read/write another account's vault or spoof owner IDs. Expired/revoked tokens pause sync without discarding pending work. Explicit logout clears enrolled local data. Recovery/password change refreshes cached wrapping material and preserves decryption of existing records.
- **Port forwards:** definitions appear on B, but no listener or SSH tunnel starts until Start is pressed. Stop and pane-close behavior remain local and correct.
- **Platform:** run the offline restart, keychain-policy, and crash-recovery scenarios on Linux, Windows, and macOS. Manual UI testing complements unit/integration tests.

## 11. Scope boundaries and known limitations

- No interactive conflict picker or “keep both” copies; latest edit-order tuple wins.
- No offline first-time login, signup, password reset, or revocation discovery.
- Non-sensitive metadata stays readable in both databases; whole-file database encryption is not part of this design.
- No sync of local files, running sessions, device preferences, or session logs.
- No automatic start of port forwards after download, restart, or reconnection.
- No guarantee that device timestamps reflect true event order when a clock is incorrect.
- Initial server implementation targets the repository's actual SQLite driver; other SQL engines need separate validation before being claimed as supported.
