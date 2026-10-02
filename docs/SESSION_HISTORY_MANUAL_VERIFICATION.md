# Session history and encrypted recordings: manual verification

Use two installations signed in to the same account (A and B), plus an SSH host and a local shell. Keep the server running. This suite exercises the personal vault; a team host may be used to confirm that its history remains private. Recording is initially off on both devices. Do not use real secrets in test terminal output.

## Basic lifecycle and privacy

1. On A, open History before connecting. It should be empty or show only prior attempts. Set retention to 30 days.
2. Connect to a local shell and disconnect. Connect to an SSH host and disconnect. History should show two separate attempts with their start/end times, type, and outcome. Both should say output was not recorded.
3. Start an SSH connection that fails authentication. The failed attempt should appear; it should not interrupt the terminal error flow.
4. Reconnect to the SSH host. The reconnect must be a new attempt rather than an edit to the previous attempt.
5. Disconnect A from the network, make another local-shell attempt, then reconnect. Wait for sync and open History on B. The metadata should appear there. Terminal output should be absent because recording was off.
6. If using a team host, connect to it on A. Its history should sync only to this account's personal vault and must not appear for a different team member.

## Opt-in output and sync

1. On A, turn on **Record terminal output** in Terminal settings. Verify B's setting remains off; this is a device setting.
2. Open a new local shell and print a unique harmless marker. Close it. History on A should show recorded output and the marker. Existing non-recorded attempts must remain non-recorded.
3. Wait for sync, then open the same attempt on B. Its output should match. Check that typed input which was not echoed by the terminal is absent.
4. While A is offline, record another attempt. Reconnect A; it should upload. B should receive both metadata and output.
5. Produce more than 64 KiB of UTF-8 output including multibyte characters. Verify it reads back in the right order without split or replacement characters.
6. Produce more than 10 MiB of output. The session should remain usable, the recording should stop at the cap, and History should show a truncation label.
7. Disable recording on A. New attempts should contain metadata only; prior recordings should remain available.

## Restart, deletion, and retention

1. Start a connection on A, then force-close the app. Reopen and unlock. The previous attempt should become **interrupted**; an active connection on B must not be marked interrupted by A.
2. Delete one recorded session on A while online. After sync, it and its output should disappear on B. Repeat while A is offline, reconnect, and check propagation.
3. Change retention on A to 7 days. After sync, B should show the same choice. Older history and chunks should be removed when each client next applies retention; recently created attempts should remain. Restore 30 days afterward.
4. Switch to another account or lock the app. Previously decrypted history/output should disappear from the UI. Return to the original account and unlock to retrieve it again.

## Ciphertext and platform checks

1. With the app closed, inspect A's local SQLite `session_history`, `session_output_chunks`, and `session_preferences` rows. The `data` columns should be encrypted envelopes; host labels, output markers, and retention values must not appear as plaintext in those columns or generic metadata fields.
2. Inspect matching server rows. They should contain ciphertext, fixed neutral names, timestamps, IDs, and sync metadata only. Search the DB for the unique output marker and host label; neither should be present in plaintext.
3. Repeat the local-shell, SSH, recording, restart, and cross-device checks on Linux, Windows, and macOS before claiming platform-wide manual verification.

If a step fails, capture the app version, device/OS, exact step, sync status, and the relevant Tauri or server error without including terminal secrets or key material.
