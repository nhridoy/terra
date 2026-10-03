# Workspaces and quick presets: manual verification

Use two desktop installations signed into the same account and personal vault for the sync checks. Use disposable SSH hosts. Do not save commands or terminal output in these layouts; only connection references and split geometry belong in the encrypted row.

## Quick presets

1. Open a terminal tab, connect to a saved SSH host, split the pane, and connect another saved host or local shell. Click **Save as Quick Preset**, enter a name, and save. Confirm the name appears in the empty-pane host browser.
2. Disconnect/close the tab, restart the app, open a new empty tab, and choose the preset. Confirm the pane split and host labels return, with no duplicated pane IDs or orphaned old sessions. Saved port forwards must remain stopped until started manually.
3. Change the split arrangement and click **Save preset changes**. Restart and restore again; confirm the new arrangement is saved. A connect/disconnect status change alone must not show the preset as dirty.
4. Rename the preset, restart, and confirm the new name. Delete it, restart, and confirm it stays deleted. Repeated clicks should not create duplicate presets.
5. Disconnect Wi-Fi, create or edit a preset, restart offline, and confirm it remains available. Reconnect and sync on device A, then sync device B and verify the same layout and name. Repeat for deletion.
6. Delete one of the saved hosts, then restore the preset. Its pane should say **Missing host** and offer host selection rather than attempting the old address. Other panes should still restore.

## Workspaces

1. Open at least two terminal tabs with saved hosts and split panes. Save a named workspace. Confirm it appears on the Workspaces page.
2. Open the workspace. Confirm the app navigates to the terminal, restores the expected tabs and splits, and starts no saved port forward automatically.
3. Change its layout and click **Save workspace changes**. Restart and reopen it; confirm the edited layout remains. Rename, restart, and confirm the name remains. Delete, restart, and confirm it stays deleted.
4. With unsaved workspace changes, try opening a different workspace. Cancel the discard prompt and confirm the original tabs remain intact. Confirming should replace them with the selected workspace.
5. Repeat the offline-create, reconnect, and second-device sync check for a workspace. Delete a referenced host and confirm that the restored pane identifies it as missing rather than dialing stale connection details.

## Failure and vault isolation

1. Lock the vault or make its local database unavailable, then attempt to save a preset/workspace. The save dialog should show an error and remain open; no false success or clean-state indicator should appear.
2. Switch vaults and confirm the first vault's presets/workspaces do not appear in the second. Switch back and confirm they return.
3. Verify that saved rows on the server contain encrypted layout payloads, and that synced rows retain stable IDs after edits and tombstones after deletion.
