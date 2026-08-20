# Open in Editor (SFTP → Editor) with Real Remote Editing

Date: 2026-08-20
Status: Approved design (pending implementation plan)

## Summary

Add an "Open in Editor" context-menu item to the SFTP module (both local and
remote panes) that hands the target file/folder/directory over to the editor
module. The editor gains real remote support by reusing the SFTP pane's
existing session — no new connection is created. The editor's "Connect Host"
button is removed, and the editor gets per-tab dirty tracking with
confirmation prompts before any connection replacement.

## 1. Editor Connection Model (`client/src/stores/editor/editorStore.ts`)

Replace `connectionType: "host" | "local" | null` plus the separate host
fields with a single connection descriptor:

```ts
type EditorConnection =
  | { kind: "local"; rootPath: string }
  | {
      kind: "remote";
      sessionId: string;      // = the SFTP pane's sessionId (paneId)
      hostId: string;
      hostName: string;
      hostAddress: string;
      hostPort: number;
      hostUsername: string;
      rootPath: string;       // the folder the editor is rooted at
    }
  | null;
```

- `connectLocal(path)` keeps its signature; `connectHost` is removed.
- New action `openFromSftp(request)` adopts a connection (details in §3).
- New factory `getEditorProvider(connection)` returns `LocalFileProvider` or
  `RemoteFileProviderImpl(hostId, sessionId)` — the latter is keyed by the
  same `sessionId` as the SFTP pane, so both modules share one SSH session.
- Provider-aware I/O migration (editor components stop calling `localFs`
  directly and use the provider):
  - `EditorView` read/write → `provider.readFile` / `provider.writeFile`
  - `EditorExplorer` list/expand, new file/folder, rename, delete →
    `provider.listFiles` / `mkdir` / `rename` / `delete`
  - `QuickOpen` workspace collect → `provider.listFilesRecursive`
  - `EditorSearch` file reads → `provider.readFile`
  - `SourceControlPanel` hidden in remote mode (git is local-only).

## 2. Remove Connect Host from the Editor

- Delete the "Connect Host" button + `SftpHostPicker` modal from the
  `EditorPane` empty state (`EditorPane.tsx` ~249–278).
- Delete the host-mode placeholder branches in `EditorPane` (~207–241) and
  `EditorView` (~264–275) — real remote mode replaces them.
- Remove the `connectHost` action from `editorStore`.
- "Connect Local" stays as the editor's only self-initiated connection.

## 3. "Open in Editor" (SFTP context menu, both panes)

New menu item **Open in Editor** in both `LocalFileBrowser` and `FileBrowser`
context menus (`beforeItems` for file/folder, `afterItems` for empty area):

| Right-click target | Local pane | Remote pane |
|---|---|---|
| File | root = parent dir, open the file | root = parent dir, open the file |
| Folder | root = the folder | root = the folder |
| Empty area | root = current directory | root = current directory |

Flow:

1. Menu click → `editorStore.openFromSftp(request)` where `request` carries
   the connection descriptor (for remote: `sessionId`, host metadata from the
   pane) plus optional `openFile` path — then `navigate("/editor")`.
2. If the editor currently has dirty tabs → confirmation dialog
   ("Discard unsaved changes and open <target>?") rendered where the click
   happened (the SFTP pane). Cancel aborts; confirm replaces.
3. On adoption: replace the connection (reset views), then `openFile(target)`
   if a file was requested.
4. Works whether the editor is mounted or not — the store persists across
   route changes.

## 4. Dirty Tracking (new)

- `EditorOpenFile` gains `dirty: boolean` (cleared on open/save, set when
  CodeMirror content changes).
- Modified-dot indicator on tabs.
- Ctrl+S writes via the provider, clears dirty, toasts success.
- Confirmation prompts when dirty tabs exist:
  - closing a dirty tab,
  - replacing the connection (`openFromSftp` / editor's own `Connect Local`),
  - disconnecting.
- The editor's own `Connect Local` also goes through the same dirty gate.

## 5. Disconnect / Reconnect (remote)

- When the SFTP pane disconnects, the shared session dies; remote editor ops
  fail with a "Connection closed" error shown as a toast with a **Reconnect**
  action button (sonner toast action): reconstructs
  `RemoteFileProviderImpl(hostId, sessionId)` (re-establishes the session)
  and retries the failed operation.
- Implementation note: verify Rust `sftp_connect` semantics when the
  `sessionId` already exists (replace vs. error) — if it errors, the
  reconnect path must disconnect first.

## 6. Verification

- Vitest: new `editorStore` logic — dirty flag lifecycle, `openFromSftp`
  replace/confirm flow.
- Manual test cases: local file/folder/empty-area, remote file/folder/
  empty-area, dirty-tab confirmations (close/replace/disconnect), SFTP pane
  disconnect → editor error → reconnect → retry, editor persistence across
  module switches.
- Regression: existing local editor flows (open, save, explorer ops, search,
  quick open, split views) unchanged.

## Out of Scope

- Multi-root workspaces (single connection, replace semantics).
- Auto-save / save-back batching; upload progress UI for editor saves.
- Editing remote files through multiple SFTP sessions simultaneously
  (replacing the connection is the only supported transition).