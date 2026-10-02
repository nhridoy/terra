# Teams and encrypted shared vaults

**Status:** Design for review. **Scope:** first team release on the current `main` branch. This extends the approved local-first sync system; it does not turn an existing personal vault into a shared vault.

## Outcome and boundaries

An account owner can create a team, invite another existing TermVault account by email, and create dedicated team vaults. An invited user accepts or declines in the app. Accepted members can read and edit the team's vaults on multiple devices, continue editing previously unlocked vaults offline, and synchronize when connected again. Owner and admin roles manage membership; the server enforces every permission. The server stores ciphertext and wrapped vault keys but cannot decrypt SSH credentials, key material, snippets, or other sensitive row payloads.

Only existing accounts can be invited. Pending email invitations to people who have not registered, converting personal vaults, per-vault ACLs within a team, public links, and live co-editing are outside this release. The current `kind: "team"` label on vaults without a real team relationship must not cause automatic sharing. Such vaults remain private until a separate explicit migration feature exists. Teams and invitations are online operations; accepted members' cached vault data remains usable offline.

## Existing constraints

Personal vault data is encrypted with the account-wide DEK. Sharing that DEK would also expose personal data, so team vaults require independent 32-byte keys. The current server sync path authorizes only `vault.owner_id`; its push/pull checks must become membership and role aware. The client validates pulled ciphertext with the account DEK and uses that same key for local row encryption and saved SSH configuration; every team-vault path must select the team vault key instead. The existing account X25519 private key is wrapped under the account DEK and is recoverable on another device after normal login/recovery.

## Roles and membership

| Role | Team settings and invites | Team vault lifecycle | Vault records |
| --- | --- | --- | --- |
| Owner | Create, rename, invite, change roles, remove members, delete team | Create, rename, delete | Read/write |
| Admin | Rename, invite, remove members (not owner or admins) | Create, rename, delete | Read/write |
| Member | View team and own membership, leave | View | Read/write |

There is exactly one owner; ownership transfer is outside this release. Only the owner can promote or demote admins. An owner cannot leave while a team exists. Invites have an explicit recipient user ID, normalized email, requested role, expiry (seven days), and state (`pending`, `accepted`, `declined`, `cancelled`, `expired`). An invite is single-use, recipient-bound, and accepted only by its target account. Team management and key grants are audited as non-secret metadata (actor, operation, target, UTC timestamp). Sensitive payloads and raw keys are never logged.

## Invitation and key grant

1. The inviter enters an existing account's email. The server returns that account's X25519 public key and its fingerprint only to an authorized owner/admin, with rate limiting. The client shows the fingerprint and requires the inviter to confirm it through an out-of-band comparison with the recipient. A server-controlled public-key substitution at first contact otherwise defeats the E2E claim.
2. The inviter's unlocked client loads each team vault key and creates a recipient-specific envelope. It submits the invite and all envelopes atomically; if any grant fails, no usable invite is published. An invite to a team with no vaults carries no envelopes.
3. The recipient sees the pending invite in-app. Acceptance creates active membership and makes the envelopes available in one transaction. Before acceptance, sync push/pull and envelope reads are forbidden. Decline, cancellation, and expiry remove pending grants.
4. On acceptance, the unlocked client uses the account X25519 private key to open each envelope. It wraps each team vault key under the account DEK for the local offline cache. Other devices of that account can retrieve the same server envelope, open it after normal unlock, and cache it independently. Password change and recovery preserve access through the existing account DEK and identity private key.
5. If the recipient account key changed since invitation, acceptance pauses with a key-mismatch error and requires a new grant after fingerprint verification. The server never silently substitutes a new key.

Envelope version 1 uses an ephemeral X25519 sender key, an all-zero shared-secret check, HKDF-SHA256 with a versioned domain separator, and XChaCha20-Poly1305. Its authenticated context binds team ID, vault ID, key epoch, recipient user ID, and recipient public-key fingerprint. The server stores ephemeral public key, nonce, ciphertext, and context; it never receives a raw vault key. This follows the public-key sealed-box pattern while using the project's existing AEAD. The envelope format and known-answer/tamper tests are part of the implementation plan. The client pins the highest observed epoch and recipient fingerprint locally to reject silent rollback or key swaps. Server denial of service and first-contact identity substitution without out-of-band verification remain outside what ciphertext encryption alone can prevent.

## Vault data and synchronization

Team vault creation is online and atomic with an initial key epoch and envelopes for every active member. Every vault record continues using the existing typed local/server tables and sync change feed; `vault.team_id` identifies team ownership and the key epoch identifies the decryption key. Personal vaults keep the account DEK and existing ciphertext format. Team vault rows use the independent vault key, with authenticated data binding the table, vault ID, and epoch. The local key selector must cover CRUD, imported/generated SSH keys, saved host connection resolution, SFTP, forwarding definitions, pull validation, and any other row encryption/decryption path. A locked or missing key makes the team vault unavailable; it must never fall back to the account DEK or accept unreadable pulled rows.

The server authorizes each sync push/pull using an active membership and the vault's team ID. Owners/admins/members may edit records; only owner/admin may change vault metadata, and team/key/envelope state changes use dedicated endpoints. The server rejects client attempts to change `team_id`, `owner_id`, epoch, or membership through ordinary sync payloads. Revoked or pending users receive 403 before any change feed or envelope data. Existing device-bound operation IDs, cursors, conflict rules, and transactional local outbox behavior remain in place. A recipient's first hydration includes authorized team vault metadata and key envelope before its encrypted rows; missing keys must not advance the pull cursor.

Offline edits to an already accepted vault stay encrypted locally and queued. Reconnection refreshes membership and key epoch before pushing. If authorization was revoked, the client stops the vault's sync and quarantines its pending edits without assigning them to another account or silently discarding them. The UI explains that the server rejected those edits and offers explicit local export/discard. It cannot erase copies a formerly authorized member kept while offline.

## Member removal and key rotation

Removing a member is an online, owner/admin-only operation. The server atomically revokes membership and marks every team vault as rotation-required, rejecting the removed member's further envelope, push, and pull requests immediately. Remaining members can read their local cache, but team-vault writes/sync pause until rotation finishes. The unlocked owner/admin client generates a fresh key epoch per vault, creates envelopes for every remaining active member, and re-encrypts the current live rows. This is a staged operation: the server records encrypted staged rows and envelopes separately, verifies the complete row set and expected revision/epoch, then atomically publishes the new epoch and change-feed boundary. It never publishes a partly rotated vault. A crash or network loss leaves the vault in a visible rotation-required state that another authorized owner/admin device can resume from its last committed state; old epoch ciphertext remains available only to remaining members during recovery.

Pending offline edits from remaining members are kept locally. After the new envelope arrives, their clients decrypt old local pending payloads with the retained old key, re-encrypt under the new key, and rebase/retry through the existing conflict protocol. Old-key pushes are rejected after cutover. Removed members cannot receive the new key or future server updates, but previously decrypted or cached data cannot be clawed back. The UI states this limitation before removal. Team deletion is a separate explicit destructive operation with confirmation and server-side authorization; it tombstones team vaults and ends access, without claiming to erase prior offline copies.

## UI and error behavior

The Teams route shows teams, member roles, outstanding invitations, and dedicated shared vaults. Invite actions await server success and show errors in the form; they do not close optimistically. Invitation acceptance shows key download/unlock progress and a clear fingerprint/key mismatch state. Vault selection distinguishes private and shared vaults, including offline, pending sync, access revoked, and rotation-required states. Team management controls follow server permissions, while the server remains authoritative. Existing fake or no-op team-store actions and the "unavailable in sync-only mode" placeholder are replaced as part of the feature.

No success is shown for partially created invites, vaults, grants, or rotations. The user can retry idempotent operations after a network interruption. Key material is never exposed in logs, UI error messages, or plaintext database columns. UTC ISO-8601 timestamps are stored in both databases; ordering/conflict behavior must not depend on local timezone.

## Verification and release gates

Automated tests cover envelope round trips and tampering, wrong recipient, key swap and epoch rollback, owner/admin/member authorization on every team and sync endpoint, invite expiry/replay/cancellation, accepted versus pending access, offline outbox replay, partial creation failure, removed-member 403s, staged rotation crash/retry, and team/personal encryption separation. Client tests verify decrypted data does not enter list-safe state or logs. Server tests use at least two accounts and device-bound tokens.

Manual two-device checks create a team and vault, invite an existing account, verify fingerprints, accept, edit both online and offline, restart, change password/recover, and confirm convergence. Repeat removal with an offline former member and a remaining member, inspect server/local databases for plaintext secrets, and test interrupted rotation. The existing personal-vault sync suite must pass before the team feature is considered release-ready. Windows and macOS remain unverified until their platform runs are recorded.
