### Task 10: SFTP connection UI integration

**Files:**
- Modify: `client/src/components/sftp/browser/FileBrowser.tsx`
- Modify: `client/src/stores/sftp/sftpStore.ts`

**Interfaces:**
- Consumes: `sftp_connect_saved`, `sftp_connect`, `sftp_disconnect` IPC commands
- Produces: SFTP connection state management

- [ ] **Step 1: Add SFTP connection state to sftpStore.ts**

Add to `sftpStore.ts`:
```typescript
interface SftpConnectionState {
  sessionId: string | null;
  hostId: string | null;
  host: string;
  port: number;
  username: string;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

// Add to SftpState:
sftpConnection: SftpConnectionState;
connectSftp: (hostId: string) => Promise<void>;
connectSftpDirect: (config: SshConfig) => Promise<void>;
disconnectSftp: () => Promise<void>;
```

- [ ] **Step 2: Implement connection methods in sftpStore.ts**

```typescript
connectSftp: async (hostId: string) => {
  set({ sftpConnection: { ...get().sftpConnection, connecting: true, error: null } });
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const sessionId = `sftp-${hostId}-${Date.now()}`;
    const result = await invoke<SftpConnectResult>("sftp_connect_saved", {
      sessionId,
      hostId,
    });
    set({
      sftpConnection: {
        sessionId: result.session_id,
        hostId,
        host: result.host,
        port: result.port,
        username: result.username,
        connected: true,
        connecting: false,
        error: null,
      },
    });
  } catch (err) {
    set({
      sftpConnection: {
        ...get().sftpConnection,
        connecting: false,
        error: String(err),
      },
    });
  }
},
```

- [ ] **Step 3: Wire FileBrowser.tsx to connect on mount**

In `FileBrowser.tsx`, add effect to connect SFTP when component mounts with hostId.

- [ ] **Step 4: Add progress event listener**

In `sftpStore.ts`, add Tauri event listener for `sftp-transfer-progress` to update transfer state.

- [ ] **Step 5: Run tests**

Run: `cd client && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): wire SFTP connection UI and progress events"
```
