# Implementation Plan: Open in Editor (Remote + Local)

Date: 2026-08-20
Spec: `docs/superpowers/specs/2026-08-20-open-in-editor-design.md`
Status: Ready for implementation

## Scope

1. Remove the "Connect Host" button + host-mode placeholders from the editor module.
2. Add "Open in Editor" to the SFTP context menu (both local and remote panes; file / folder / empty area).
3. Editor gains real remote editing by reusing the SFTP pane's existing session (`sessionId` = `paneId`). No new SSH tunnel.
4. Dirty tracking + confirmation prompts (close dirty tab, replace connection, disconnect).
5. Source Control hidden in remote mode. Explorer / Search / Quick Open fully functional in remote mode.
6. Remote binary/media previews (image/audio/video/pdf via `convertFileSrc`) are **out of scope** — remote shows the existing "Unsupported file type" placeholder for those kinds. Markdown preview works (content is in memory).

## Critical design finding (research)

- The editor mounts under `Layout.tsx`'s `<Outlet />` (`client/src/components/layout/shell/Layout.tsx:170`). Navigating `/editor` ↔ `/sftp` **unmounts** the editor tree.
- `EditorView` keeps `content` and `dirty` in **local component state** (`EditorView.tsx:68-71`), so unsaved edits and dirty flags are already lost on module switch.
- Therefore the approved dirty-confirm behavior is impossible without persisting content + dirty in the editor store. **This plan adds `fileContent` / `fileDirty` maps to `editorStore` (keyed by file path)** — a net UX improvement (unsaved edits survive module switches) and a prerequisite for the confirm gates.

## Key research notes (verified anchors)

| Area | Anchor |
|------|--------|
| `FileProvider` interface | `client/src/lib/sftp/fileTransfer.ts:19-56` (`listFiles`, `readFile→Uint8Array`, `writeFile(path, Uint8Array, onProgress?)`, `moveFile`, `copyFile`, `removeFile`, `exists`, `mkdir`, `mkdirAll`) |
| `LocalFileProvider` | `fileTransfer.ts:58-115` (stateless, `id` defaults `"local"`) |
| `RemoteFileProviderImpl(hostId, sessionId)` | `client/src/lib/sftp/remoteFs.ts:91` (stateless wrapper, `getSessionId()`) |
| Provider registry | `client/src/lib/sftp/providerRegistry.ts` (`registerProvider(paneId, provider)` / `getProvider(paneId)`) |
| Connect pattern to mirror | `client/src/hooks/sftp/useFileOperations.ts:65-116` — `hostId.startsWith("direct_")` → `invoke("sftp_connect", { sessionId: paneId, config: { host, port, username } })`, else `invoke("sftp_connect_saved", { sessionId: paneId, hostId })`; then `new RemoteFileProviderImpl(hostId, paneId)` + `registerProvider(paneId, provider)` |
| Session reuse | `client/src-tauri/src/sftp.rs:93-115` — `sftp_connect` returns existing session for a known `sessionId` (`reused: true`); editor reconnect is just a re-invoke |
| Editor store | `client/src/stores/editor/editorStore.ts` — `connectLocal` :233, `connectHost` :236-245 (remove), `disconnect` :247, `openFile` :249, `openFileInView` :365-399, `closeFileInView` :401, `resetViews()` :199, `activeViewIdFor` :184, `ROOT_VIEW_ID` :14 |
| EditorPane | `client/src/components/editor/views/EditorPane.tsx` — host button :250-253 + `SftpHostPicker` modal :268-278, host placeholder branch :207-241, local sidebar :187-206, `handleConnectHost` :128-130, `handleConnectLocal` :132-139 |
| EditorView I/O | `client/src/components/editor/views/EditorView.tsx` — local state `content`/`dirty` :68-71, read `readLocalFile` :165, save `writeLocalFile` :187 + `setDirty` :188, host placeholder :264-275, tab dirty dot :292, binary/image/video/audio/pdf branches :372-448 |
| EditorExplorer I/O | `client/src/components/editor/panels/EditorExplorer.tsx` — `listLocalFiles` :298, `openFile` calls :409/417/608, `renameLocalFile` :455, `writeLocalFile` :493, `createLocalDir` :513, `removeLocalFile` :525, `revealInExplorer`/`openInSystem` :555-569 |
| QuickOpen | `client/src/components/editor/panels/QuickOpen.tsx` — local-only `collectWorkspaceFiles` :65, remote placeholder :119-139, `openFile` :95-98 |
| EditorSearch | `client/src/components/editor/panels/EditorSearch.tsx` — local-only `searchWorkspace` :238, `handleOpen` :266-275 |
| ActivityBar | `client/src/components/editor/panels/ActivityBar.tsx:9-28` — 3 tools rendered unconditionally; add `hiddenTools` prop |
| Workspace walkers | `client/src/lib/workspaces/workspaceFiles.ts` (`collectWorkspaceFiles(root)` walks via `listLocalFiles`); `client/src/lib/workspaces/workspaceSearch.ts` (`searchWorkspace(root, query, options, inFiles, excludeFiles, onPartial)`) |
| Remote context menu builder | `client/src/components/sftp/browser/shared/buildContextMenuItems.tsx` — `beforeItems` (file/dir at :31-47), `afterItems` (:49-64, always appended) |
| Base menu builder | `client/src/components/sftp/browser/shared/buildBaseContextMenuItems.tsx` — `beforeItems` pushed when `menuFile` :51, `afterItems` pushed always :121 |
| FileBrowserList menu | `client/src/components/sftp/browser/FileBrowserList.tsx:121-151` — builds menu via `buildContextMenuItems(contextMenu.file, clipboard, actions, onRenameStart, selectedFiles)` |
| LocalFileBrowser menu | `client/src/components/sftp/browser/LocalFileBrowser.tsx:577-642` — builds menu inline via `buildBaseContextMenuItems` (two branches: file :580-620, empty :621-641) |
| SftpPane | `client/src/components/sftp/views/SftpPane.tsx` — passes `onFileSelect={() => {}}` :97, pane fields `hostId/hostAddress/hostPort/hostUsername/hostName/localPath/id/connectionType` :90-100, no `useNavigate` present |
| Navigation | SFTP components do **not** navigate (Header.tsx uses `useNavigate`). SftpPane must add `useNavigate` from `react-router`. |
| Confirm modal to generalize | `client/src/components/ui/ConfirmDeleteDialog.tsx` — hardcoded title "Confirm Delete"; generalize into a `ConfirmDialog` with a `title` prop (or add a `DiscardDialog`) |

## Task breakdown

### Phase A — Editor store foundation

- **A1.** Generalize `ConfirmDeleteDialog` into `ConfirmDialog` (`client/src/components/ui/ConfirmDialog.tsx`) with `title` prop (default "Confirm"); keep `ConfirmDeleteDialog` as a thin wrapper or migrate its 3 call sites. Update call sites: SFTP delete confirms + any others (grep `ConfirmDeleteDialog`).
- **A2.** Add store fields to `editorStore.ts`: `fileContent: Record<string, string>`, `fileDirty: Record<string, boolean>`. Actions: `setFileContent(path, value)`, `setFileDirty(path, dirty)`, `clearFileBuffers()`. Wire `clearFileBuffers()` into `resetViews()`.
- **A3.** Add `connectRemote(payload)` action where payload = `{ hostId, hostName, hostAddress, hostPort, hostUsername, sessionId, rootPath, fileToOpen? }`. Sets `connectionType: "host"`, stores config + `explorerRootPath` + `sessionId`, calls `resetViews()`, then if `fileToOpen` → `openFile(fileToOpen.path, fileToOpen.name, false)`. Remove `connectHost`.
- **A4.** Add `getEditorProvider()` helper (`client/src/lib/editor/editorProvider.ts`): returns a `FileProvider` — local → `new LocalFileProvider()`; remote → `getProvider(sessionId) ?? new RemoteFileProviderImpl(hostId, sessionId)` + `registerProvider(sessionId, provider)`. Export `providerReadText(provider, path)` (`TextDecoder` on `readFile` bytes) and `providerWriteText(provider, path, text)` (`TextEncoder` → `writeFile`).
- **A5.** Add `ensureRemoteSession()` helper: mirrors `useFileOperations.ensureProvider` (direct_ → `sftp_connect` with config; else `sftp_connect_saved` with hostId), stores provider via A4, rethrows on failure with message.
- **A6.** Add `reconnect()` action: calls `ensureRemoteSession()` for the stored connection; on failure → toast error + return `false`; on success → return provider.
- **Tests (vitest):** `editorStore` — `connectRemote` sets connection + root; `openFromSftp`-style payload opens `fileToOpen`; `setFileDirty`/`setFileContent` persist; `resetViews` clears buffers. `editorProvider` — provider selection (local vs remote) with a stubbed registry; `providerReadText`/`providerWriteText` round-trip a known string.

### Phase B — EditorView provider-aware I/O

- **B1.** Replace local `content`/`dirty` state with store-backed reads: `content = fileContent[activePath]`; `dirty = fileDirty[path] === true`. Keep local `content` only as a transient working buffer synced to the store on every `onChange` (`setFileContent` + `setFileDirty(path, true)`).
- **B2.** Read path: `readLocalFile` → `providerReadText(await getEditorProvider(), activePath)`. Guard against stale results by path (reuse the existing `cancelled` pattern). If read fails → `setReadError` + `toast` with `action: { label: "Reconnect", onClick: reconnect }` for remote connections (not for local).
- **B3.** Save path: `handleSave` → `providerWriteText(await getEditorProvider(), activePath, content)`; on success `setFileDirty(activePath, false)` + `toast.success`. Save failure on remote → same Reconnect toast action.
- **B4.** Remove the host-mode placeholder branch (`isHost` block :264-275) — render the normal tab bar + content area for both modes.
- **B5.** Media/binary rendering: when `connectionType === "host"` and `effectiveKind` is `image`/`audio`/`video`/`pdf` → render the existing "Unsupported file type" placeholder (reuse the `binary` branch markup at :425-448). Markdown keeps working.
- **Tests:** component-level vitest with a mocked provider + store (`renderEditorView`): typing sets `fileDirty`; save calls `writeFile` and clears dirty; read failure shows error; stale read discarded when path changes.

### Phase C — EditorExplorer provider I/O

- **C1.** `loadDir` (`EditorExplorer.tsx:294-314`): `listLocalFiles(path)` → `(await getEditorProvider()).listFiles(path)`.
- **C2.** `commitRename` (:455): `renameLocalFile` → `provider.moveFile(old, new)`.
- **C3.** `confirmNewFile` (:493): `writeLocalFile(path, "")` → `provider.writeFile(path, new Uint8Array(0))`.
- **C4.** `confirmNewFolder` (:513): `createLocalDir` → `provider.mkdir`.
- **C5.** `confirmDelete` (:525): `removeLocalFile` → `provider.removeFile`.
- **C6.** Menu gating: hide `revealInExplorer` / `openInSystem` items when `connectionType === "host"` (buildMenuItems, ~:593-660). Root node always from store `explorerRootPath`.
- **Tests:** unit-test the menu-builder branch (file vs dir vs remote gating); I/O fns are thin wrappers — covered by integration/manual.

### Phase D — QuickOpen + EditorSearch provider-aware

- **D1.** Generalize `collectWorkspaceFiles` (`workspaceFiles.ts:21`) to accept a `listDir: (path) => Promise<FileItem[]>` param (default `listLocalFiles`). Export `collectProviderWorkspaceFiles(root, provider)`.
- **D2.** QuickOpen: replace local-only gate (`connectionType !== "local"` placeholder :119-139) — use `explorerRootPath` + provider walker for remote; keep `collectWorkspaceFiles` for local. Remove the "SFTP transport phase" placeholder.
- **D3.** Generalize `searchWorkspace` (`workspaceSearch.ts`) to accept injected `listDir` + `readText` (or a provider); add `searchProviderWorkspace(provider, root, ...)`. EditorSearch: pick walker/reader by `connectionType`. Keep the partial-results callback contract.
- **D4.** Remove the host-mode Search placeholder branch in `EditorPane` (see E3) — real search renders.
- **Tests:** `collectProviderWorkspaceFiles` walker with a fake provider (depth cap + file limit honored, ignored dirs skipped). Search helper with a fake reader (basic hit/miss + partial callback).

### Phase E — EditorPane UI

- **E1.** Remove `connectHost`/`handleConnectHost`/`SftpHostPicker` modal + "Connect Host" button (:250-253, :268-278). Empty state shows only "Connect Local" with copy updated to "Open a local folder or use Open in Editor from SFTP".
- **E2.** Host branch: replace the placeholder sidebar (`EditorPane.tsx:207-241`) with real content: `sidebarTool === "explorer"` → `<EditorExplorer rootPath={explorerRootPath ?? "/"} />`; `"search"` → `<EditorSearch />`; `"source-control"` → hidden (see E4).
- **E3.** `ActivityBar`: add optional `hiddenTools` prop; pass `["source-control"]` when `connectionType === "host"`. When switching to host while `sidebarTool === "source-control"`, reset to `"explorer"` (in `connectRemote`).
- **E4.** PaneHeader close: gate on dirty — if any `fileDirty`, open a `ConfirmDialog` ("Discard unsaved changes?") before `disconnect()`.

### Phase F — SFTP context menu + navigation

- **F1.** `buildContextMenuItems.tsx`: add optional `onOpenInEditor?: (file: FileItem | null) => void` to `FileBrowserActions`. Push items: directory → beforeItems "Open in Editor" (icon `CodeIcon`); file → beforeItems "Open in Editor"; empty area (`menuFile === null`) → afterItems "Open in Editor" (with separator).
- **F2.** `FileBrowserList.tsx:121-151`: pass `onOpenInEditor: actions.onOpenInEditor` into the builder; add it to the `actions` prop type (forward from FileBrowser).
- **F3.** `FileBrowser.tsx`: add `onOpenInEditor?: (file) => void` prop, forward into `listActions` (:391-423).
- **F4.** `LocalFileBrowser.tsx`: add `onOpenInEditor?: (file) => void` prop; add the same menu items to both branches of its inline `contextMenuItems` (:577-642).
- **F5.** `SftpPane.tsx`: implement `handleOpenInEditor(file)`; add `useNavigate` from `react-router`. Compute root: `file === null` → current pane `currentPath` (from `fileBrowserStore.panes[pane.id]`); directory → `file.path`; file → parent dir. Call `useEditorStore.getState().connectRemote({...pane host fields, sessionId: pane.id, rootPath, fileToOpen: file})` for host panes, or `connectLocal` semantics via a new `connectLocalFromPath(rootPath, fileToOpen?)` for local panes; then `navigate("/editor")`. Remote panes call `ensureRemoteSession()` first (A5) so a fresh or reconnected session is live. Pass `handleOpenInEditor` into `FileBrowser` (:91) and `LocalFileBrowser` (:100).
- **Tests:** `buildContextMenuItems` — items present for file/dir/empty cases; `openInEditor` invoked with the right arg.

### Phase G — Dirty gates + disconnect/reconnect

- **G1.** Tab close (`closeFileInView` / `closeFile`): if `fileDirty[path]` → `ConfirmDialog`; discard proceeds, cancel aborts. Gate lives in `EditorView`'s tab `onClose` and Explorer/QuickOpen-adjacent close paths.
- **G2.** `connectLocal`/`connectRemote` replace: if any `fileDirty` → `ConfirmDialog` ("Discard unsaved changes and switch connection?").
- **G3.** SFTP pane disconnect while editor remote-connected: `EditorView` op failures (B2/B3) toast with Reconnect action; store keeps `connectionType`/config/openFiles/content so tabs survive. `reconnect()` (A6) re-invokes `sftp_connect_saved`/`sftp_connect`, rebuilds provider, clears error.
- **Tests:** gate logic in store (pure helpers): `hasDirtyFiles(state)`, `discardAllConfirm(state) -> bool` guarded in component tests.

### Phase H — Verification & manual QA

- **H1.** `cd client && pnpm biome check .` and `pnpm tsc --noEmit` clean; `pnpm vitest` green.
- **H2.** `cd server && go vet ./...` + `go test ./...` (server untouched, but run to confirm no regression).
- **H3.** Commit + push per phase: `feat(editor): ...` on client; `chore: bump client to <sha> (...)` on superproject.
- **H4.** Manual test checklist (see below).

## Manual test checklist

1. SFTP remote pane → right-click a file → "Open in Editor" → editor opens in remote mode with that file, root = its parent folder.
2. SFTP remote pane → right-click a folder → "Open in Editor" → editor root = that folder, empty tree until expanded.
3. SFTP remote pane → right-click empty area → "Open in Editor" → editor root = current directory.
4. Same three on a **local** SFTP pane.
5. Editor remote mode: expand tree, open nested file, edit, Ctrl+S → verify file changed on server (cat via SFTP pane or SSH).
6. Editor remote mode: create file/folder, rename, delete → reflected in SFTP pane after refresh.
7. Dirty dot appears on edit; close dirty tab → prompt appears; Cancel keeps tab, Discard closes.
8. Edit remote file → SFTP pane disconnect → save/read fails → Reconnect toast → click Reconnect → session restored, file readable/saveable, tabs/content intact.
9. Editor remote mode: Source Control icon absent from ActivityBar; Search + Quick Open work over remote.
10. Editor empty state: no "Connect Host" button; "Connect Local" still opens a folder.
11. Remote binary/image/pdf → unsupported placeholder (no crash).
12. Switch editor → SFTP → back to editor with unsaved edits → content + dirty dot still present (new persistence behavior).

## Commit cadence

- One commit per phase (A–G) on client; one `chore: bump client to <sha>` on superproject after each.
- Run biome + vitest before every client commit; tsc at Phase B boundary and before H1.

## Open questions for the user

- None blocking. (Note: `onFileSelect` on SFTP double-click stays a no-op per spec — "Open in Editor" is context-menu only.)