# Terra local-first sync: manual test suite

**Purpose:** Verify that two independently installed clients converge through the server while remaining usable offline, that sensitive data stays encrypted in both databases, and that saved port forwards do not start on another device.

**Scope:** This tests the current sync implementation. It does not test collaborative/team-vault permissions, SSH transport reliability, or the correctness of the three forwarding network modes themselves. Run it first on Linux; repeat the core cases on Windows and macOS before claiming support there.

## Test record

| Field | Fill in before starting |
| --- | --- |
| Date and tester | |
| Client A OS and client commit/build | |
| Client B OS and client commit/build | |
| Server commit/build and database (SQLite/PostgreSQL/MySQL) | |
| Server URL | |
| Account used (identifier only; never record passwords/codes) | |
| Result for each case (Pass/Fail/Blocked) | |

Record a failed step with its case ID, exact action, expected and actual result, whether A/B were online, the visible sync label, and relevant client/server logs with credentials removed. Do not paste passwords, recovery codes, private keys, tokens, or full encrypted payloads into an issue.

## Preparation

1. Use **two separate app-data directories**: ideally two computers, A and B. Two windows sharing one OS profile and `terra.db` are **not** two devices. Both clients must reach the same server URL. If the server runs on A, configure B with A's reachable LAN address, not `localhost`. The sign-in screen's **Server URL** control can set the endpoint.
2. Use a **disposable test account** and a server database that you can reset. Save its recovery kit securely. Use a test SSH host that you own if you want to verify connecting or starting a forward. The sync tests need only saved host definitions; they do not require an SSH connection.
3. Start the server with a persistent database. Sign up/sign in online on A, then sign in with the **same account** on B. Confirm both show the server-created **Personal** vault. If B cannot sign in or shows a different account/vault, stop and fix setup first.
4. Open **Settings → Security** on each client. Leave **Ask for password every time** off for the first pass. Keep both apps open and online. The header's sync label is a button: click it to request a sync. Automatic sync is debounced and also runs periodically; for deterministic checks, click the label on each device and wait for it to stop saying **Syncing…**. A count such as **Pending (1)** means work remains.
5. Use unique names such as `sync-A-host-01` so a pre-existing item cannot look like a successful sync. Do not use production private keys or host credentials. Record which device created each item.

A case passes only if the stated result is visible **after closing and reopening the receiving app** where the case calls for it. If a sync label says **Sync error**, **Offline**, or **Sign in to sync**, do not count the case as passed just because the source device still shows its local data.

## Core cases

### S01 — Initial vault discovery and new vault

1. On both clients, select **Vaults** and open the vault selector. Verify **Personal** appears once on each device.
2. On A, create a custom vault named `sync-A-vault-01` from the vault selector. Verify it appears immediately, even before the header says **Synced**.
3. Click A's sync label and wait for **Synced** with no pending count. Click B's sync label; check that the new vault appears. Close and reopen B; check again.
4. On B, rename the custom vault to `sync-B-vault-01`. Sync B and then A.

**Pass:** Both devices have one Personal vault and the same custom vault with B's new name. Closing B does not lose it. A vault created locally does not require a successful server call before it appears on A.

### S02 — Every saved record type

Use the custom vault from S01. On A, create one of each item below with a recognizable name/value. Save one item at a time; the local UI should update immediately. If a control is unavailable in this build, mark that row **Blocked** with the control you expected rather than silently skipping it.

| Type | Example action on A | What to check on B after syncing A then B |
| --- | --- | --- |
| Group | **Hosts → New Group**, name `sync-group-01` | Group exists in the same vault. |
| Host | **Hosts → New Host**, name `sync-host-01`, put it in the test group, enter a harmless test username/secret | Name, group, and saved connection fields are intact. Do not require a live SSH connection. |
| Key | **Keys**, import or manually add a disposable test key named `sync-key-01` | Key appears and its public key/fingerprint, when provided, remain usable. Never use a production key. |
| Snippet | **Snippets**, save `sync-snippet-01` with command `printf sync-test-01` | Exact command is present and editable. |
| Workspace | Create/save `sync-workspace-01` using the workspace controls | Workspace appears with its saved layout. |
| Preset | Save a test terminal/tab preset named `sync-preset-01` if the preset control is available | Preset appears and can be reopened. |
| Port-forward definition | See S03 | Name, mode, and endpoint fields arrive; state is stopped. |

After all items arrive on B, close and reopen **both** apps. Check the items again. **Pass:** Each saved item survives restart on both devices, with the correct vault and relationship (host→group/key, forward→host). No duplicate appears after clicking sync again on A and B.

### S03 — Saved forwards sync, but never start automatically

1. On A, open a **remote SSH host's terminal pane** and its **Port Forwarding** panel. Select **+ Add Forward**. Save one definition in each mode: **Local**, **Remote**, and **Dynamic**, using distinct names such as `sync-local-01`. Use valid, non-conflicting test ports. Do not press **Start** yet.
2. Sync A then B. On B, open the same host's Port Forwarding panel.
3. Check that all three definitions, modes, and endpoints match A, and each offers **Start** rather than appearing active. Restart B and check again.
4. Optionally start one forward on A using a reachable test SSH host. Confirm the matching definition on B stays stopped. Stop it on A; the saved definition should remain on both devices.
5. Edit one definition's name/port on B, sync B then A, and verify the edit reaches A. Delete one definition on A, sync A then B, and verify it disappears on B.

**Pass:** Definitions synchronize; runtime Start/Stop state does not; no listener starts merely because a definition was received or the app reopened. A changed/deleted definition converges.

### S04 — Fully offline edits and restart, auto-unlock setting off

1. Ensure A has successfully signed in online at least once and **Ask for password every time** is off. Disconnect **A's** network entirely (for example, disable Wi-Fi and Ethernet). Leave B online so the server remains reachable from B.
2. On A, create `offline-host-01` and `offline-snippet-01`; edit the group name; delete a disposable item created for this case. Verify the changes appear locally. The header should indicate pending/offline work, not **Synced**.
3. Quit A fully and reopen it **while still offline**. Verify it opens without server access and, while its keychain entry is eligible, auto-unlocks. Check that all offline edits and deletions are still visible. Click the sync label; it must not erase the edits.
4. Reconnect A. Click sync on A, then B. Close and reopen B.

**Pass:** A remains usable offline across restart. B gets all edits and tombstones after reconnect. A and B show no duplicate items and no pending count after successful sync. If auto-unlock is blocked by the documented 14-day inactivity/90-day age policy, record that separately and repeat with a fresh keychain entry.

### S05 — Offline restart, password required

1. While A is online and unlocked, open **Settings → Security** and enable **Ask for password every time**. Disconnect A's network and fully quit/reopen it.
2. Enter a wrong password. Then enter the correct account password.
3. Before reconnecting, inspect the saved data and make a new snippet edit. Quit/reopen once more offline and unlock again. Reconnect and sync A then B.

**Pass:** A prompts on each launch, rejects the wrong password, unlocks with the correct password without contacting the server, retains the offline edit, and later uploads it. The setting must not make an enrolled device depend on online login for local access.

### S06 — Offline-created vault deleted before its first upload

1. Disconnect A. Create custom vault `temporary-offline-vault` and a host or snippet inside it. Before reconnecting, delete that vault in A's UI. Confirm it disappears from A's vault selector.
2. Quit/reopen A offline; it must still be absent. Reconnect A and click sync. Click sync on B.

**Pass:** The temporary vault and its child never appear on B. A's visible pending count clears; it does not show a permanent error or retry loop for that cancelled vault.

### S07 — Synced vault deletion and child tombstones

1. Create `delete-me-vault` on A with a group, host, snippet, and one saved forward. Sync A then B and confirm B has every item.
2. Delete `delete-me-vault` on A. Sync A then B. Restart both apps.

**Pass:** The vault and all its children disappear on both devices. No child is left visible in another vault, and no forwarding listener starts. Use only the disposable vault; do not delete Personal or a production vault.

### S08 — Different-record offline edits

1. Start with `conflict-host-A` and `conflict-host-B` visible on both devices. Disconnect A and B from the server.
2. Edit host A only on device A and host B only on device B. Reconnect A, sync it; reconnect B, sync it; sync A again.
3. Repeat with the reconnect order reversed using two fresh items.

**Pass:** Both independent changes exist on both devices after either order. Neither edit is discarded because it was made offline.

### S09 — Same-record conflict and delete-versus-edit

1. Start with one test host visible on both devices. Disconnect both from the server. Edit its name on A to `host-from-A`, then at least several seconds later edit the **same host** on B to `host-from-B` (or reverse the order for the second run). Reconnect/sync both, then restart both.
2. Repeat with a fresh host: while both are offline, edit on A and delete on B. Sync both. Repeat once more with delete/edit order reversed.

**Pass:** Both devices converge to the **same** result and remain consistent after restart. The documented winner is the maximum `(edited_at, device_id, operation_id)` tuple in canonical UTC ISO milliseconds. With edits several seconds apart, the later edit should win if device clocks are reasonably aligned. A deleted record may win over an edit; it must not remain different on A and B. Record each device's clock and edit order if the winner is surprising.

### S10 — Interrupted network and safe retry

1. On A, disconnect the network and create `retry-snippet-01`. Reconnect, initiate sync, and interrupt A's network while sync is in progress if possible. Alternatively, stop the test server briefly before clicking sync.
2. Verify A still shows the snippet locally and displays pending/offline/error status. Restore network/server, click sync again on A and B; then click sync a second time on both.

**Pass:** Exactly one `retry-snippet-01` appears on B. A's pending state clears only after successful delivery. A failed attempt never deletes the local edit or creates duplicates after retry.

### S11 — Expired session and reauthentication

This case needs a disposable account and a way to invalidate its refresh session (for example, server-side test tooling). Do **not** sign out through the app to simulate expiry: explicit logout intentionally clears local data.

1. Make an offline edit on A. Invalidate A's server refresh session, then reconnect A.
2. Click sync. Check the status and local item. Use the app's sign-in flow to reauthenticate **as the same account**, then click sync on A and B.

**Pass:** A shows **Sign in to sync** or an equivalent auth-required state while keeping local work. After same-account reauthentication, the item reaches B. If the test setup cannot invalidate a session safely, mark **Blocked** and record why.

### S12 — Account isolation on sign-out

1. After all pending work is synced, sign out on A. Sign in as a **different disposable account** on A. Do not reuse the first account's password or recovery material.
2. Check vaults, hosts, keys, snippets, and workspaces. Create a record in the second account and sync it. Check the first account on B.

**Pass:** A cannot see or decrypt the first account's local records; B does not receive the second account's records. Signing out is a destructive local-cache operation, so perform it only after pending work has been synchronized and verified on B.

### S13 — Password change and recovery across devices

Use disposable accounts and preserve the recovery kit. Password change/reset is an **online auth operation**; local reads/edits after enrollment are the offline part.

1. With a synced test host/key/snippet on A and B, change the account password through **Settings → Security** on A. Save the newly shown recovery material if the UI provides it. Reauthenticate B using the new password if required, sync both, and verify the records can still be decrypted.
2. In a separate disposable run, use **Forgot password / Recovery** with the saved recovery code and a new password. Enroll or reauthenticate a clean device, then verify the already-synced test records can be read and edited. Check that a recovery code invalidated by reset is rejected.

**Pass:** Existing encrypted records remain readable to the legitimate account after password change/recovery, and new edits still sync. If any record becomes unreadable, stop testing that account and preserve its database/recovery material for diagnosis.

## Optional database and scale checks

### S14 — At-rest encryption inspection

This check is useful if you can safely inspect a **copy** of each database. Tauri stores `terra.db` under its app-data directory on each device; the server uses `DATABASE_URL`. Do not edit a live database. With `sqlite3`, query only the **shape** of the sensitive column, not the whole blob:

```sql
SELECT id, json_valid(data) AS json_ok,
       json_extract(data, '$.alg') AS algorithm,
       length(data) AS bytes
FROM hosts LIMIT 5;
```

Repeat for `keys`, `snippets`, `workspaces`, `presets`, and `port_forwards` in both client and server databases. Non-sensitive names, IDs, timestamps, and relationship fields may be plaintext by design. A newly created custom vault can also have encrypted `data`; a seeded default vault may use `{}` because it has no sensitive payload. Inspect `sync_changes.envelope` on the server carefully: it may include plaintext approved metadata, but sensitive `data` must still be an AEAD envelope (`xchacha20poly1305`), never the host password, private key, snippet command, or forwarding endpoint secret in cleartext. Use a recognizable **disposable** test secret and search a database copy for it without sharing the copy or its output publicly.

**Pass:** Every saved sensitive payload is an AEAD envelope locally and on the server. The server database contains no plaintext test secret. If you use PostgreSQL/MySQL, adapt the SQL JSON expression to that database.

### S15 — Pagination and repeated sync

Create or edit **more than 100** small snippets in one vault on A, then sync A and B. Count them on B, restart B, and sync again. **Pass:** Every item arrives once, including items beyond the first 100-change page; later syncs do not duplicate or lose them. This is optional because it takes longer, but it exercises cursor pagination that small tests cannot.

### S16 — Cross-platform smoke run

When Windows and macOS builds are available, repeat at least S01, S02 (host/key/snippet), S03 (definition remains stopped), S04, S05, S10, and S12 with one of those platforms as device B. Record each OS/build separately. A Linux-only pass must not be reported as Windows/macOS verification.

## Results

| Case | Result (Pass/Fail/Blocked) | Device/build | Notes or issue link |
| --- | --- | --- | --- |
| S01 Initial vault | | | |
| S02 Record types | | | |
| S03 Port forwards | | | |
| S04 Offline auto-unlock | | | |
| S05 Offline password unlock | | | |
| S06 Unsynced vault cancellation | | | |
| S07 Synced vault deletion | | | |
| S08 Independent edits | | | |
| S09 Same-record conflict | | | |
| S10 Retry | | | |
| S11 Reauthentication | | | |
| S12 Account isolation | | | |
| S13 Password/recovery | | | |
| S14 Encryption inspection | | | |
| S15 Pagination | | | |
| S16 Platform smoke | | | |

**Release decision:** Core cases S01–S10 and S12 should pass on Linux for the local-first sync claim. S11 and S13 must pass before claiming robust session-expiry and recovery behavior. S14 is required before claiming verified at-rest secrecy. S15 and S16 gate pagination and platform claims, respectively. Any failed case is an implementation bug to investigate; a blocked case is unverified, not passed.
