# Terra Teams and encrypted shared vaults: manual verification

This suite checks the actual two-account, two-device behavior. Automated unit and API tests cannot prove that two installed clients hydrate the right key, survive offline use, and recover cleanly from interruption. Run the existing [sync suite](SYNC_MANUAL_VERIFICATION.md) first for personal-vault sync.

## Test record

| Field | Value |
| --- | --- |
| Date and tester | |
| Device A OS, client build, app-data location | |
| Device B OS, client build, app-data location | |
| Server build, database engine, server URL | |
| Owner account identifier | |
| Member account identifier | |
| Optional third account identifier | |

Use disposable accounts, keys, and host credentials. Record Pass, Fail, or Blocked for each case with observed behavior and sanitized logs. Never paste passwords, recovery codes, tokens, private keys, or plaintext host secrets into the test record. A and B must have separate app-data directories; two windows sharing the same SQLite file do not test cross-device sync. Configure both clients to use the same reachable server URL, not `localhost` on B unless the server also runs there.

## Preparation

1. Sign up or sign in as **Owner** on A and **Member** on B. Both must unlock their own account. Save each disposable recovery kit securely.
2. On each device, open **Teams** and copy **Your identity fingerprint**. Compare each fingerprint directly with the account owner, outside the server response. Use this comparison when the invite form asks for confirmation.
3. Confirm both accounts can reach the server. Create no production host/key records in this suite. Use unique names beginning `team-test-` so old data cannot masquerade as a received change.
4. When a step says “sync,” click the header sync status on the named device and wait for the state to settle. A pending count means the operation has not yet converged. If the app does not expose a sync button for the selected vault, leave the vault selected until its automatic sync finishes.

## T01 — Team creation and role controls

1. On A, create `team-test-ops`. Confirm it appears in the team list and Owner has the `owner` role.
2. Rename it to `team-test-operations`. Refresh or reopen Teams; the new name should persist.
3. On B before an invitation, verify the team is absent. Attempting to guess its API URL or vault ID must not expose members, grants, or sync changes.

**Pass:** Only Owner initially sees and manages the team. The rename survives restart. Unauthorized API requests return 403/404 rather than data.

## T02 — Existing-account invitation and fingerprint

1. On A, invite Member by their existing account email. Compare the displayed recipient fingerprint against the value read directly on B. Confirm it, choose `member`, and send the invitation.
2. On B, open Teams and confirm a pending invitation appears. Before accepting, verify B cannot open any of A's shared vaults.
3. Accept on B. Confirm the team and Member's role appear. Restart B and unlock; the membership should remain.
4. Try an unknown email and a mismatched fingerprint on A. Neither attempt should create a usable invitation. Invite the same account again; the app should report that membership/invitation already exists.
5. With a fresh disposable invite, test **Decline** and owner **Cancel** separately. The recipient must not gain team access. If practical, expire a test invite by changing its expiration in a disposable server DB and verify it disappears from pending invitations and can be reissued.

**Pass:** Only the intended existing account can accept, once. Fingerprint mismatch, unknown recipient, decline, cancellation, expiry, and replay cannot grant access. Do not treat a server-returned fingerprint alone as independent verification.

## T03 — Create and rename a dedicated shared vault

1. On A, inside `team-test-operations`, create `team-test-shared`. Confirm it appears with a **Shared** badge in the vault selector. A legacy personal vault labeled “team” must remain private.
2. On B, refresh Teams, select `team-test-shared`, and verify it opens after B unlocks. Restart B and repeat while disconnected from the network.
3. On A, rename the shared vault to `team-test-renamed`. Sync both devices and verify the new label on B. Test that Member cannot rename or delete it; Owner/Admin can.
4. Create a new private vault on A and confirm B cannot see it merely because both accounts belong to the team.

**Pass:** Shared vaults are created only from the Teams page, hydrate on another member's device, remain accessible offline after caching, and sync their new name. Personal and legacy `kind=team` vaults do not become shared.

## T04 — Encrypted records and two-way changes

1. In the shared vault on A, create a group, host with a disposable username/password, SSH key with disposable private material, snippet with a recognizable command, workspace, and saved port-forward definition. Sync A then B.
2. On B, open each item and verify the intended values, group/host/key relationships, and vault scope. A received port-forward definition must be stopped until B explicitly starts it.
3. On B, edit the host and snippet, add a second host, and delete one disposable record. Sync B then A. Restart both clients and verify convergence with no duplicates or plaintext-looking unreadable fields.
4. On A, switch to a personal vault and confirm the shared records are absent there. On B, switch back to the shared vault and confirm the records remain.

**Pass:** Authorized edits travel both directions, every item survives restart, and no record crosses into another vault. An unauthorized account cannot push/pull by knowing a vault UUID.

## T05 — Offline member edits and recovery

1. After T04 has synced, disconnect B from all network access. Edit `team-test-renamed` on B: create a snippet, edit a host, delete a disposable group or host. Confirm changes appear locally and sync shows pending/offline.
2. Quit and reopen B while offline; unlock according to its password-on-open setting. Confirm the edits are still present. Make one more edit.
3. Reconnect B. Sync B then A, then sync B again. Restart A.

**Pass:** B can read and edit its cached shared vault offline. Every queued change eventually appears on A once, and B's pending count clears only after acknowledgement.

## T06 — Removal and immediate denial

1. Create a disposable third **Member** account if available. Ensure it has already opened the shared vault once. Disconnect that device and queue an offline edit.
2. On A, remove the third member. Confirm the warning states that previously cached offline copies cannot be erased. The shared vault should show **Rotate keys** and pause new writes/sync until rotation.
3. While the removed account remains signed in with its old token, try the vault key endpoint and sync pull/push. Both must return 403. Reconnect its device; its queued edit must remain locally recoverable and must not be uploaded.
4. On that device, open Teams. Confirm **Unsynced team edits** offers **Export edits** and **Discard queue**. Export to a disposable location and check that the JSON contains the queued edit; the file is plaintext and must be secured or deleted afterward. Export must not silently discard. Confirm discard explicitly, then check pending operations clear while the encrypted local cache remains.

**Pass:** Removal blocks fresh server data immediately, even with an old valid token. Pending edits are retained until the user explicitly discards them. The app never claims to erase an offline copy held by a removed user.

## T07 — Atomic key rotation, interruption, and remaining-member rebase

1. After removal, on A choose **Rotate keys**. If possible, interrupt A's network while staging and retry after reconnect. Before commit, B must not receive a partially re-encrypted vault. The vault remains visibly rotation-required until a successful commit.
2. Retry rotation on A. Confirm the vault becomes ready and B can download the new envelope. Compare a host and snippet created before rotation on A and B; neither should become unreadable or duplicated.
3. Repeat removal using a third account while **B**, a remaining member, is offline with a queued edit made under the old epoch. Rotate on A while B is disconnected. Reconnect B, refresh team data, and sync. B's queued edit should be re-encrypted under the new epoch and arrive on A exactly once.
4. Try a pending invitation created before the rotation. It should be invalidated; the owner must issue a fresh invitation after rotation with a newly verified fingerprint/grant.

**Pass:** No mixed-epoch records appear, committed rotation is atomic, interrupted attempts can be retried, remaining members retain access, removed members get no new key, and old-epoch offline edits from remaining members rebase without data loss.

## T08 — Password/recovery and another device

1. Sign in as Member on a third, clean device or app-data directory. After unlocking, open the shared vault and check the records. This device must obtain its own locally wrapped copy of the team key, not copy A/B's SQLite file.
2. Change Member's password, restart, and unlock. Repeat using Member's recovery flow on a disposable account if available. Reopen the shared vault after each flow.

**Pass:** The account's keyring and identity private key remain usable after password change/recovery; the shared vault opens on each authorized device without exposing raw vault keys to the server.

## T09 — Team/vault deletion and account isolation

1. Create a second disposable shared vault. On A, make one unsynced edit in it, then delete the vault as Owner. Confirm A immediately marks its cached vault **Access denied**, blocks further edits and sync, and offers export or explicit discard of the unsynced edit. The encrypted cached row must remain until the user chooses how to handle it. Check that the vault is inaccessible via server routes and no longer appears as active to another online member. An offline member's cached copy may remain until it reconnects; confirm it becomes access denied after reconnect.
2. Create another disposable shared vault and an unsynced edit, then delete the disposable team as Owner. Confirm A immediately marks every cached vault in that team **Access denied** and preserves queued edits for export or explicit discard. Verify former members cannot fetch vault envelopes or sync changes. Sign out and sign in with another account on one device; cached teams/keys from the previous account must not appear.

**Pass:** Server access ends, the UI does not imply cached offline copies were remotely erased, and account switching does not mix local teams, vault keys, or records.

## T10 — Ciphertext and failure inspection

1. Using **disposable** secrets, inspect the server database rows for `hosts`, `keys`, `snippets`, `port_forwards`, and `vault_key_envelopes`. Inspect local `terra.db` for the same records and `team_vault_keys`. Search for the test password/private-key text; do not record the text in logs.
2. Confirm sensitive row `data` is a version-2 AEAD envelope with the correct vault ID and epoch; local team keys are account-DEK-wrapped. Team names, member IDs, roles, email addresses, and UTC ISO-8601 timestamps may remain plaintext.
3. Inspect server/client logs and failed API responses for accidental plaintext secrets or raw keys. Inspect the exported T06 file separately; it is intentionally plaintext only after the user chose export.

**Pass:** No sensitive plaintext or raw team key is stored in the server/local database or routine logs. Ciphertext remains bound to its team vault and epoch. Record the DB engine and inspection commands used, without copying secrets into the report.

## Release record

The feature is **not live-verified** until T01–T10 have results on two separate app-data directories, including a removal/rotation run. Record Linux results first; repeat the core invitation, sync, offline, and rotation flows on Windows and macOS before claiming those platform paths are verified. Document any blocked case with the exact build, OS, action, and expected/actual result.
