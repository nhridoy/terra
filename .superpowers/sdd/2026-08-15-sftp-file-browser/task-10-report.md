# Task 10: SFTP connection UI integration

## What was implemented

### 1. SftpConnectionState interface and store state (`sftpStore.ts`)
- Added `SftpConnectionState` interface with `sessionId`, `hostId`, `host`, `port`, `username`, `connected`, `connecting`, `error`
- Added `sftpConnection` to the `SftpState` interface and initial state
- Added supporting TypeScript interfaces for IPC types: `SftpConnectResult`, `SshConfig`, `SftpTransferProgress`

### 2. Connection methods (`sftpStore.ts`)
- `connectSftp(hostId)` — connects to a saved host via `sftp_connect_saved` IPC, generates session ID `sftp-${hostId}-${Date.now()}`
- `connectSftpDirect(config)` — connects via direct SSH config via `sftp_connect` IPC, generates session ID `sftp-direct-${Date.now()}`
- `disconnectSftp()` — best-effort disconnects via `sftp_disconnect` IPC, cleans up progress listener, resets state

### 3. Progress event listener (`sftpStore.ts`)
- Added `ensureProgressListener()` that lazily sets up a Tauri event listener for `sftp-transfer-progress`
- Listener matches events by `transfer_id` and updates the corresponding `TransferItem` in the store (transferred bytes, size, progress, speed, status)
- Listener is cleaned up on `disconnectSftp()`

### 4. FileBrowser mount wiring (`FileBrowser.tsx`)
- Added `useEffect` that calls `connectSftp(hostId)` on mount and `disconnectSftp()` on unmount

## Files changed

- `client/src/stores/sftp/sftpStore.ts` — +186 lines (interfaces, state, methods, progress listener)
- `client/src/components/sftp/browser/FileBrowser.tsx` — +11 lines (store selectors, mount effect)

## Test results

- All 141 tests passing, output pristine
- Biome lint clean (no errors, no warnings)

## Self-review findings

- The store's `sftpConnection` is global while `useFileOperations` creates per-pane SFTP sessions with different session IDs. This means two sessions could be open to the same host simultaneously. The Rust backend handles SSH session reuse, so this is acceptable. The store-level state is primarily for UI status display.
- The `disconnectSftp` cleanup in FileBrowser's unmount effect disconnects the store's session. Since `useFileOperations` manages its own independent sessions, this doesn't affect file operations in other panes.
