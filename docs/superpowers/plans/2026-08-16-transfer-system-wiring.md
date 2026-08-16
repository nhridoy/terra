# Transfer System Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire remote uploads/downloads to the transfer panel with progress, speed, cancel, and connection survival.

**Architecture:** Modify provider to accept transferIds, create TransferItems in store before operations, replace browser file input with Tauri dialog, add speed/cancel to panel, implement Rust cancel token.

**Tech Stack:** Tauri v2, russh-sftp, Zustand, React, @phosphor-icons/react

## Global Constraints

- pnpm only — never npm
- Biome enforces single quotes, space indent
- Tauri v2 ACL capabilities in `capabilities/default.json`
- GORM AutoMigrate on server startup
- All crypto: Argon2id + ChaCha20Poly1305
- SSH connections are direct client→remote
- Server stores/syncs config only, never sees plaintext credentials

---

## File Structure

| File | Responsibility |
|------|---------------|
| `client/src/lib/sftp/remoteFs.ts` | Add `transferId` param to `upload()` and `download()` |
| `client/src/hooks/sftp/useFileOperations.ts` | Rewrite `handleUpload` (Tauri dialog), wire `handleDownload` to store, remove unmount disconnect |
| `client/src/components/sftp/browser/FileBrowser.tsx` | Replace upload `<label>` with `<Button>` |
| `client/src/components/sftp/transfer/FileTransfer.tsx` | Add speed display, cancel button, byte formatting |
| `client/src-tauri/src/sftp.rs` | Add `sftp_cancel_transfer` with cancellation tokens |
| `client/src-tauri/src/lib.rs` | Register `sftp_cancel_transfer` command |

---

### Task 1: Provider — Accept transferId parameter

**Files:**
- Modify: `client/src/lib/sftp/remoteFs.ts:237-267`

**Interfaces:**
- Consumes: none (standalone change)
- Produces: `RemoteFileProviderImpl.download(remotePath, localPath, onProgress?, transferId?)` and `upload(localPath, remotePath, onProgress?, transferId?)` — later tasks pass transferId

- [ ] **Step 1: Add transferId parameter to download()**

```typescript
async download(
  remotePath: string,
  localPath: string,
  onProgress?: ProgressCallback,
  transferId?: string,
): Promise<void> {
  const invoke = await this.getInvoke();
  const id = transferId ?? crypto.randomUUID();

  await invoke("sftp_download", {
    sessionId: this.sessionId,
    remotePath,
    localPath,
    transferId: id,
  });
}
```

- [ ] **Step 2: Add transferId parameter to upload()**

```typescript
async upload(
  localPath: string,
  remotePath: string,
  onProgress?: ProgressCallback,
  transferId?: string,
): Promise<void> {
  const invoke = await this.getInvoke();
  const id = transferId ?? crypto.randomUUID();

  await invoke("sftp_upload", {
    sessionId: this.sessionId,
    localPath,
    remotePath,
    transferId: id,
  });
}
```

- [ ] **Step 3: Run linter**

Run: `cd client && pnpm biome check src/lib/sftp/remoteFs.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd client && git add src/lib/sftp/remoteFs.ts && git commit -m "feat(sftp): accept transferId param in upload/download providers"
```

---

### Task 2: Rust — Implement sftp_cancel_transfer

**Files:**
- Modify: `client/src-tauri/src/sftp.rs` (add cancel map + command)
- Modify: `client/src-tauri/src/lib.rs` (register command)

**Interfaces:**
- Consumes: `SftpSessions` state, `SftpTransferProgress` struct
- Produces: `sftp_cancel_transfer(session_id, transfer_id)` IPC command

- [ ] **Step 1: Add cancellation token map to SftpSessions**

In `sftp.rs`, add to the `SftpSessions` struct:

```rust
pub struct SftpSessions {
    pub sessions: Mutex<HashMap<String, SftpSession>>,
    pub cancel_tokens: Mutex<HashMap<String, tokio_util::sync::CancellationToken>>,
}
```

Update the initialization in `lib.rs` where `SftpSessions` is created to include `cancel_tokens: Mutex::new(HashMap::new())`.

- [ ] **Step 2: Add sftp_cancel_transfer command**

```rust
#[tauri::command]
pub async fn sftp_cancel_transfer(
    session_id: String,
    transfer_id: String,
    sftp_sessions: tauri::State<'_, SftpSessions>,
) -> Result<(), String> {
    let tokens = sftp_sessions.cancel_tokens.lock().map_err(|e| e.to_string())?;
    if let Some(token) = tokens.get(&transfer_id) {
        token.cancel();
    }
    Ok(())
}
```

- [ ] **Step 3: Register command in lib.rs**

Add `sftp::sftp_cancel_transfer` to the `.invoke_handler(tauri::generate_handler![...])` list.

- [ ] **Step 4: Add cancellation checks to sftp_download loop**

In `sftp_download`, before each chunk read:

```rust
let token = {
    let tokens = sftp_sessions.cancel_tokens.lock().map_err(|e| e.to_string())?;
    let token = tokio_util::sync::CancellationToken::new();
    tokens.insert(transfer_id.clone(), token.clone());
    token
};

loop {
    if token.is_cancelled() {
        let _ = app_handle.emit("sftp-transfer-cancelled", /* ... */);
        break;
    }
    // ... existing read/write logic
}
// Cleanup: remove token from map when done
```

- [ ] **Step 5: Add cancellation checks to sftp_upload loop**

Same pattern as download.

- [ ] **Step 6: Add tokio-util dependency**

In `client/src-tauri/Cargo.toml`, add:

```toml
tokio-util = "0.7"
```

- [ ] **Step 7: Run cargo check**

Run: `cd client/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd client && git add src-tauri/src/sftp.rs src-tauri/src/lib.rs src-tauri/Cargo.toml && git commit -m "feat(sftp): implement cancel transfer with cancellation tokens"
```

---

### Task 3: Store — Add formatSpeed helper

**Files:**
- Modify: `client/src/components/sftp/transfer/FileTransfer.tsx`

**Interfaces:**
- Consumes: `TransferItem.speed` (bytes/sec)
- Produces: formatted speed string

- [ ] **Step 1: Add formatSpeed helper**

```typescript
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "";
  if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
  if (bytesPerSecond < 1024 * 1024)
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 2: Add speed display to active transfers**

In the active transfer section, after the progress bar:

```tsx
{t.status === "active" && (
  <div className="flex items-center gap-2">
    <div className="w-16 bg-dark-700 rounded-full h-1">
      <div
        className="bg-primary-500 h-1 rounded-full transition-all"
        style={{ width: `${t.progress}%` }}
      />
    </div>
    <span className="text-dark-400 w-8 text-right">
      {t.progress}%
    </span>
    {t.speed ? (
      <span className="text-dark-500 w-20 text-right">
        {formatSpeed(t.speed)}
      </span>
    ) : null}
  </div>
)}
```

- [ ] **Step 3: Add bytes transferred display**

After the filename, show bytes:

```tsx
<span className="text-white truncate flex-1">{t.fileName}</span>
{t.status === "active" && t.size > 0 && (
  <span className="text-dark-500 text-[10px] shrink-0">
    {formatBytes(t.transferred)} / {formatBytes(t.size)}
  </span>
)}
```

- [ ] **Step 4: Run linter**

Run: `cd client && pnpm biome check src/components/sftp/transfer/FileTransfer.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd client && git add src/components/sftp/transfer/FileTransfer.tsx && git commit -m "feat(sftp): add speed and bytes display to transfer panel"
```

---

### Task 4: Store — Add cancel to transfer panel

**Files:**
- Modify: `client/src/components/sftp/transfer/FileTransfer.tsx`

**Interfaces:**
- Consumes: `sftp_cancel_transfer` IPC command
- Produces: cancel button per active transfer

- [ ] **Step 1: Add cancel handler**

```typescript
import { invoke } from "@tauri-apps/api/core";

// Inside the component:
const handleCancel = useCallback(async (transferId: string, sessionId?: string) => {
  if (sessionId) {
    await invoke("sftp_cancel_transfer", {
      sessionId,
      transferId,
    }).catch(() => {});
  }
  removeTransfer(transferId);
}, [removeTransfer]);
```

Note: We need to store `sessionId` on `TransferItem`. Add `sessionId?: string` to the `TransferItem` interface in `sftpStore.ts`.

- [ ] **Step 2: Add sessionId to TransferItem interface**

In `client/src/stores/sftp/sftpStore.ts`, add to `TransferItem`:

```typescript
export interface TransferItem {
  id: string;
  fileName: string;
  localPath?: string;
  remotePath?: string;
  direction: "upload" | "download";
  status: "pending" | "active" | "complete" | "error";
  progress: number;
  size: number;
  transferred: number;
  speed?: number;
  error?: string;
  sessionId?: string;  // NEW
}
```

- [ ] **Step 3: Replace X button with cancel for active transfers**

```tsx
{t.status === "active" || t.status === "pending" ? (
  <Button
    variant="ghost"
    size="icon-xs"
    onClick={() => handleCancel(t.id, t.sessionId)}
    title="Cancel transfer"
  >
    <XIcon className="w-3 h-3 text-red-400" weight="bold" />
  </Button>
) : (
  <Button
    variant="ghost"
    size="icon-xs"
    onClick={() => removeTransfer(t.id)}
  >
    <XIcon className="w-3 h-3" weight="bold" />
  </Button>
)}
```

- [ ] **Step 4: Run linter**

Run: `cd client && pnpm biome check src/components/sftp/transfer/FileTransfer.tsx src/stores/sftp/sftpStore.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd client && git add src/components/sftp/transfer/FileTransfer.tsx src/stores/sftp/sftpStore.ts && git commit -m "feat(sftp): add cancel button to transfer panel"
```

---

### Task 5: Hook — Wire handleDownload to transfer panel

**Files:**
- Modify: `client/src/hooks/sftp/useFileOperations.ts:360-380`

**Interfaces:**
- Consumes: `provider.download(remotePath, localPath, onProgress, transferId)`, `useSftpStore.addTransfer`
- Produces: downloads appear in transfer panel with progress

- [ ] **Step 1: Add import for useSftpStore**

```typescript
import { useSftpStore } from "@/stores/sftp/sftpStore";
```

(This import already exists at line 12.)

- [ ] **Step 2: Rewrite handleDownload**

```typescript
const handleDownload = useCallback(
  async (file: FileItem) => {
    try {
      const provider = await ensureProvider();
      const { save } = await import("@tauri-apps/plugin-dialog");
      const localPath = await save({
        defaultPath: file.name,
        title: "Save File",
      });
      if (!localPath) return;

      const transferId = crypto.randomUUID();
      useSftpStore.getState().addTransfer({
        id: transferId,
        fileName: file.name,
        remotePath: file.path,
        localPath,
        direction: "download",
        status: "pending",
        progress: 0,
        size: file.size,
        transferred: 0,
        sessionId: paneId,
      });

      await provider.download(file.path, localPath, undefined, transferId);
      clearError();
    } catch (err: unknown) {
      const message = `Download failed: ${extractError(err)}`;
      setError(message, "transfer");
      toast.error(message);
    }
  },
  [paneId, ensureProvider, clearError, setError],
);
```

- [ ] **Step 3: Run linter**

Run: `cd client && pnpm biome check src/hooks/sftp/useFileOperations.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd client && git add src/hooks/sftp/useFileOperations.ts && git commit -m "feat(sftp): wire handleDownload to transfer panel"
```

---

### Task 6: Hook — Rewrite handleUpload with Tauri dialog

**Files:**
- Modify: `client/src/hooks/sftp/useFileOperations.ts:295-332`
- Modify: `client/src/components/sftp/browser/FileBrowser.tsx:339-351`

**Interfaces:**
- Consumes: `provider.upload(localPath, remotePath, onProgress, transferId)`, `useSftpStore.addTransfer`, Tauri `open()` dialog
- Produces: uploads appear in transfer panel with progress

- [ ] **Step 1: Rewrite handleUpload**

```typescript
const handleUpload = useCallback(
  async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const paths = await open({
        multiple: true,
        title: "Select files to upload",
      });
      if (!paths || (Array.isArray(paths) && paths.length === 0)) return;

      const filePaths = Array.isArray(paths) ? paths : [paths];
      const provider = await ensureProvider();

      for (const filePath of filePaths) {
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        const remotePath =
          currentPath === "/"
            ? `/${fileName}`
            : `${currentPath}/${fileName}`;
        const transferId = crypto.randomUUID();

        useSftpStore.getState().addTransfer({
          id: transferId,
          fileName,
          localPath: filePath,
          remotePath,
          direction: "upload",
          status: "pending",
          progress: 0,
          size: 0,
          transferred: 0,
          sessionId: paneId,
        });

        try {
          await provider.upload(filePath, remotePath, undefined, transferId);
        } catch {
          // Error handled by progress listener marking transfer as error
        }
      }

      clearError();
      await refreshFiles();
    } catch (err: unknown) {
      const message = `Upload failed: ${extractError(err)}`;
      setError(message, "transfer");
      toast.error(message);
    }
  },
  [currentPath, paneId, ensureProvider, refreshFiles, setError, clearError],
);
```

- [ ] **Step 2: Update FileBrowser.tsx upload button**

Replace the `<label>` with a `<Button>`:

```tsx
// Remove:
<label className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded text-sm cursor-pointer transition-colors">
  Upload
  <input
    type="file"
    className="hidden"
    multiple
    onChange={(e) =>
      e.target.files && ops.handleUpload(e.target.files)
    }
  />
</label>

// Replace with:
<Button size="sm" onClick={() => ops.handleUpload()}>
  Upload
</Button>
```

- [ ] **Step 3: Update handleUpload signature**

The function no longer takes `FileList` — it opens the dialog internally. Update the call site in FileBrowser.tsx accordingly.

- [ ] **Step 4: Run linter**

Run: `cd client && pnpm biome check src/hooks/sftp/useFileOperations.ts src/components/sftp/browser/FileBrowser.tsx`
Expected: PASS

- [ ] **Step 5: Run tests**

Run: `cd client && pnpm vitest run`
Expected: All tests pass (some tests may reference the old handleUpload signature — update them)

- [ ] **Step 6: Commit**

```bash
cd client && git add src/hooks/sftp/useFileOperations.ts src/components/sftp/browser/FileBrowser.tsx && git commit -m "feat(sftp): rewrite handleUpload with Tauri dialog and transfer panel"
```

---

### Task 7: Remove unmount disconnect — connection survival

**Files:**
- Modify: `client/src/hooks/sftp/useFileOperations.ts:108-112`

**Interfaces:**
- Consumes: none
- Produces: connections survive component unmount

- [ ] **Step 1: Remove the useEffect cleanup**

Delete this block:

```typescript
useEffect(() => {
  return () => {
    invoke("sftp_disconnect", { sessionId: paneId }).catch(() => {});
  };
}, [paneId]);
```

- [ ] **Step 2: Verify disconnect button still works**

The disconnect button in the toolbar calls `ops.disconnect` which calls `sftp_disconnect`. Confirm it's still wired.

- [ ] **Step 3: Run linter**

Run: `cd client && pnpm biome check src/hooks/sftp/useFileOperations.ts`
Expected: PASS

- [ ] **Step 4: Run tests**

Run: `cd client && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
cd client && git add src/hooks/sftp/useFileOperations.ts && git commit -m "feat(sftp): keep connections alive on component unmount"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Start dev server**

Run: `cd client && pnpm tauri dev`

- [ ] **Step 2: Test upload flow**
- Connect to a remote host
- Click Upload button
- Tauri file dialog opens, select a file
- File appears in transfer panel with "Queued" status
- Progress bar fills, speed displays
- File appears in remote directory after completion

- [ ] **Step 3: Test download flow**
- Right-click a file, click Download
- Save dialog opens, choose location
- File appears in transfer panel with progress
- File saved to chosen location

- [ ] **Step 4: Test cancel**
- Start a large file upload
- Click cancel (X) on the transfer in the panel
- Transfer stops, removed from panel

- [ ] **Step 5: Test connection survival**
- Connect to a host
- Navigate to a different tab/page
- Navigate back to SFTP
- Connection is still active, files still shown

- [ ] **Step 6: Test disconnect**
- Click disconnect button
- Pane resets to picker state (Connect Host / Connect Local)

- [ ] **Step 7: Final commit if any fixes needed**

```bash
cd client && git add -A && git commit -m "fix(sftp): transfer system e2e fixes"
```
