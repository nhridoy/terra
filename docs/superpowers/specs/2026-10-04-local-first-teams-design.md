# Local-First Teams Design

**Status:** Draft for review
**Date:** 2026-10-04

## Problem

The Teams UI bypasses the app's local-first data path. `teamStore` and `sharedVaultStore` call `teamsApi` directly from the webview, and `team-cache.json` is only read after a failed request. The app also preloads team vaults after unlock and fetches them again when the Teams page mounts. These requests share the server's protected API rate limit with ordinary vault sync, so opening Teams repeatedly can cause 429 responses.

## Goal

Make local SQLite the Teams UI's source of truth. The webview reads and writes team state through Tauri IPC. A Rust team-sync coordinator exchanges pending local changes and server updates in the background. Opening or switching to the Teams page performs no network request.

## Requirements

- Persist teams, members, invitations, team-vault metadata, sync cursors, and pending team operations in the existing local SQLite database.
- Remove ongoing reads and writes of `team-cache.json`. Import its existing cached snapshots once into SQLite, then stop using the file.
- Expose typed IPC commands for listing and mutating local team data; the webview must not call team API endpoints.
- Queue locally supported changes while offline and display their pending-sync state. The sync worker retries safely and applies server results back into SQLite.
- Keep server authorization authoritative for membership, roles, invites, and key-envelope access. A queued local change is not represented as effective remotely until the server accepts it.
- Resolve the recipient public key online only when it is not already available in local SQLite. Once resolved, invitation creation can be queued locally with its recipient fingerprint and encrypted key envelopes.
- Fetch team-vault key envelopes only when the local key epoch is behind the server's current epoch or the key is absent.
- Keep existing shared-vault records, host/key data, and team-key material in their current SQLite/sync and encryption paths.
- Reconcile server-side member removal or role changes during background sync. Local offline copies cannot be remotely erased; local revocation takes effect when the device learns of it.
- Retain retries and 429 backoff in the sync coordinator rather than in page components.

## Non-goals

- Changing team authorization rules or weakening server role checks.
- Making the server an SSH proxy or placing plaintext credentials on the server.
- Promising immediate remote revocation while a device is offline.
- Using the generic vault-row sync endpoint to mutate team memberships. Those writes require server-side authorization and dedicated team-operation handling.

## Proposed architecture

### Local SQLite and IPC

Add normalized local tables for team records, member snapshots, invite snapshots, team sync state, and a team operation outbox. Reuse the existing `team_vaults` metadata and `team_vault_keys` wrapped-key tables, adding only fields needed for local list views or epoch comparison. Team identifiers are client-generated UUIDs so offline-created teams, their vaults, and queued operations can refer to stable IDs before upload.

Add Rust database functions and Tauri commands to list teams, members, invitations, and shared vaults; create or edit them locally; mark mutations pending; apply server snapshots/acknowledgements; and expose pending/error state. `teamStore` and `sharedVaultStore` become IPC-backed Zustand stores. They hydrate from SQLite synchronously/asynchronously on entry and never wait for the network to render cached state.

On first run after upgrade, a one-time importer reads `team-cache.json` entries, validates them, stores them in SQLite, and records a migration marker. Subsequent app use does not read or write that file.

### Background synchronization

Add a Rust `team_sync` coordinator built on the existing authenticated `HttpClient`. It is triggered with ordinary app sync on unlock/connectivity restoration and by the existing periodic sync scheduler. It also supports an explicit IPC request for retry. A per-account lock prevents overlapping team syncs.

To keep the number of HTTP requests bounded, add a dedicated authenticated team sync exchange that returns the caller's current team/member/invite/shared-vault snapshot and accepts a bounded batch of queued operations. The server applies each operation transactionally, checks the actor's current role and membership, and returns per-operation accepted/rejected results plus the authoritative snapshot. Stable operation IDs make retries idempotent. Existing fine-grained team endpoints remain for compatibility with already released clients; the Terra webview no longer calls them.

The sync exchange returns key-envelope metadata for the caller's shared vaults. The client requests or receives a full envelope only where the server epoch is newer than the locally stored epoch or no local key exists. The client imports it through the existing Rust key-envelope verification/decryption path and stores only the wrapped team key.

### Mutation and conflict behavior

Local changes update SQLite and add an outbox operation in one transaction. The UI immediately shows the new state with a `Pending sync` indication. Sync sends operations in dependency order and preserves stable operation IDs across retries. Server authorization or validation failures mark the operation as rejected, retain the local record for review where safe, and surface a useful error; they do not silently overwrite local data.

Membership removal, role changes, invite acceptance/decline, and team deletion are especially sensitive. A local pending change is shown as pending; it does not imply server enforcement until acknowledgement. If the server reports that the current user was removed, the client revokes local team-vault access and keys using the existing revocation path.

## Server sync exchange

Add a protected team sync endpoint using the existing bearer authentication. The request contains a client sync cursor and a bounded list of `{operation_id, operation_type, payload}` entries. The response contains per-operation results, a consistent caller-scoped snapshot, a next cursor, and key-envelope epoch metadata. The server validates UUIDs, payload size, operation type, recipient fingerprint, and current role for every mutation. The endpoint must not accept caller-supplied member roles or owners without checking authorization.

The batch size is bounded to protect the server. Oversized work is continued on the next sync cycle. Replays of an accepted `operation_id` return the original result rather than applying the mutation twice. Snapshot pagination uses a stable cursor so large teams can synchronize incrementally.

## Rate limiting

The webview no longer performs team GET requests on route mount. Background team sync uses one bounded exchange per cycle instead of one request per team, vault, and envelope. Rate-limit handling honors `Retry-After` if supplied and schedules a later sync without turning a successful local edit into a UI failure. The server's existing protected API limit continues to apply to the consolidated sync endpoint.

## Migration and compatibility

- Existing `team-cache.json` snapshots are imported once to SQLite and never used as the ongoing source of truth.
- Existing server team endpoints and database schema remain supported for older clients.
- The new sync endpoint and operation IDs are additive. Existing team and key-envelope records remain unchanged.
- Existing local `team_vaults`, `team_vault_keys`, and generic synced vault rows are retained. Migration does not delete team rows, cached wrapped keys, or pending generic sync edits.
- Local team names/member/invite metadata is not secret key material. Private identity keys and raw team keys remain protected by existing crypto/keychain paths; team vault keys remain wrapped at rest.

## Acceptance criteria

1. Team list, member list, invites, and shared-vault list render from SQLite while offline after a prior successful sync.
2. Opening and revisiting Teams causes no webview-to-server team API requests.
3. Local team edits appear immediately, survive app restart, and are retried after connectivity returns.
4. Duplicate delivery of the same operation ID does not create duplicate teams, invitations, vaults, or member changes.
5. Rejected or conflicting operations remain visible with an actionable status; server authorization remains enforced.
6. Team sync requests are bounded per cycle and no longer scale as one envelope request per vault on every page visit.
7. A changed server team membership is reconciled during background sync; removed users have cached team access revoked when the change is received.
8. Existing `team-cache.json` data is imported once without losing its teams/vault labels; no new file is created or written afterward.
9. Tests cover offline reads/writes, operation retries/idempotency, permission rejection, team snapshot application, stale key epochs, and outbox preservation on network failures.

## Review focus

- Offline removal/role changes are pending locally and not remotely effective until the server acknowledges them.
- A member removed elsewhere can retain offline plaintext until their client reconnects and receives revocation.
- Sync retries must be idempotent even when the server commits but the client loses the response.
- Switching accounts must isolate local team rows and outbox operations by user ID.
- Large teams and many shared vaults must paginate without exceeding request/body limits.
