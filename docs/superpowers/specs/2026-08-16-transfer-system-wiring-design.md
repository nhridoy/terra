# Transfer System Wiring — Design Spec

## Problem

The SFTP transfer infrastructure exists but is disconnected:
- Rust emits `sftp-transfer-progress` events for upload/download
- Store listens and updates `TransferItem` entries
- `FileTransfer.tsx` panel renders from the store
- **But nothing creates `TransferItem` entries for remote operations**
- `handleUpload` uses `provider.writeFile()` (no Rust progress events)
- `handleDownload` uses `provider.download()` but never creates a `TransferItem`
- Transfer panel has no speed display or real cancel

## Design

### 1. Upload flow — Tauri file dialog

Replace `<input type="file">` with Tauri's `open()` dialog from `@tauri-apps/plugin-dialog`.

**In `useFileOperations.ts` `handleUpload`:**
1. Call `open({ multiple: true, title: "Select files to upload" })` — returns `string[]` of file paths
2. For each path, extract filename, create `TransferItem` in store (status: pending, direction: upload)
3. Call `provider.upload(localPath, remotePath, transferId)` — Rust streams with progress events
4. Progress listener updates the `TransferItem` automatically
5. On completion: mark complete, refresh directory
6. On error: mark error on the `TransferItem`

**In `FileBrowser.tsx`:**
- Replace the `<label>` upload button with a `<Button>` that calls `ops.handleUpload`
- Remove the hidden `<input type="file">`

### 2. Download flow

**In `useFileOperations.ts` `handleDownload`:**
1. Show save dialog (already done)
2. Generate `transferId` (UUID)
3. Create `TransferItem` in store (status: pending, direction: download)
4. Call `provider.download(remotePath, localPath, transferId)`
5. Progress listener updates automatically

**Provider change (`remoteFs.ts`):**
- `download()` and `upload()` accept optional `transferId: string` parameter
- If not provided, generate UUID (backward compatible)

### 3. Transfer panel enhancements (`FileTransfer.tsx`)

- Add speed display next to progress bar (format: `1.2 MB/s`)
- Add cancel button per active transfer
- Format bytes transferred as human-readable (`1.2 MB / 5.0 MB`)

### 4. Cancel transfer

**Rust (`sftp.rs`):**
- Add `sftp_cancel_transfer(session_id, transfer_id)` command
- Maintain a `CancellationToken` map: `HashMap<String, CancellationToken>`
- Upload/download loops check `token.is_cancelled()` before each chunk
- On cancel: stop loop, clean up, return error

**Frontend:**
- Cancel button calls `sftp_cancel_transfer` then removes from store

### 5. Connection survival

**In `useFileOperations.ts`:**
- Remove the `useEffect` cleanup that calls `sftp_disconnect` on unmount
- Connections persist until user clicks disconnect button or closes the pane

### 6. Speed display format

```
1.2 KB/s
3.4 MB/s
567 B/s
```

Use `formatSpeed(bytesPerSecond)` helper in `transferToast.tsx` (already exists).

## Files to modify

| File | Change |
|------|--------|
| `client/src/lib/sftp/remoteFs.ts` | Add `transferId` param to `upload()` and `download()` |
| `client/src/hooks/sftp/useFileOperations.ts` | Rewrite `handleUpload` (Tauri dialog), wire `handleDownload` to store, remove unmount disconnect |
| `client/src/components/sftp/browser/FileBrowser.tsx` | Replace upload `<label>` with `<Button>` |
| `client/src/components/sftp/transfer/FileTransfer.tsx` | Add speed display, cancel button, byte formatting |
| `client/src-tauri/src/sftp.rs` | Add `sftp_cancel_transfer` with cancellation tokens |
| `client/src-tauri/src/lib.rs` | Register `sftp_cancel_transfer` command |

## Testing

1. Upload a single file via the Upload button — should appear in transfer panel with progress
2. Upload multiple files — all appear in panel, progress updates
3. Download a file — appears in panel with progress
4. Cancel an active transfer — transfer stops, removed from panel
5. Disconnect while transfers active — transfers cancelled
6. Navigate away from SFTP tab and back — connection persists
