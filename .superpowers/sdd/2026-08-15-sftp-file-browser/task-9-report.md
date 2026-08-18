# Task 9: Wire into useFileOperations stubs

## What I Implemented

Wired the `RemoteFileProvider` into `useFileOperations.ts`, replacing all TODO stubs with real SFTP calls.

### Changes Made

1. **`client/src/lib/sftp/remoteFs.ts`**
   - Added `delete(path: string, recursive?: boolean): Promise<void>` to `RemoteFileProvider` interface
   - Added `delete` implementation to `RemoteFileProviderImpl` that calls the Rust `sftp_delete` command

2. **`client/src/hooks/sftp/useFileOperations.ts`**
   - Added imports: `useEffect`, `invoke`, `RemoteFileProviderImpl`
   - Added SFTP provider connection logic:
     - `providerRef` stores the `RemoteFileProviderImpl` instance
     - `connectingRef` prevents duplicate connection attempts
     - `ensureProvider()` lazily connects to SFTP on first use (calls `sftp_connect_saved` for saved hosts or `sftp_connect` for direct connections)
     - Cleanup effect calls `sftp_disconnect` on unmount
   - Added `refreshFiles()` helper to reload file list after mutations
   - Replaced all TODO stubs:
     - **Rename**: `provider.moveFile(oldPath, newPath)` → refresh
     - **New Folder**: `provider.mkdir(newPath)` → refresh
     - **New File**: `provider.writeFile(newPath, new Uint8Array(0))` → refresh
     - **Delete**: `provider.delete(path, true)` for each file → refresh
     - **Upload**: Read `FileList` via `arrayBuffer()`, write via `provider.writeFile()` → refresh
     - **Download**: Show save dialog via `@tauri-apps/plugin-dialog`, download via `provider.download()` → toast
     - **Paste**: `provider.moveFile()` for cut, `provider.copyFile()` for copy → refresh
     - **File Drop**: Same as paste with override handling
     - **Paste with Overrides**: Same as paste with conflict resolution

## What I Tested

- `pnpm biome check src/hooks/sftp/useFileOperations.ts` — passes (with formatting fix applied)
- `pnpm biome check src/lib/sftp/remoteFs.ts` — passes
- `pnpm vitest run` — 141/141 tests passing

## Files Changed

- `client/src/lib/sftp/remoteFs.ts` (added delete method)
- `client/src/hooks/sftp/useFileOperations.ts` (wired provider into all stubs)

## Self-Review Findings

### Completeness
- All 9 TODO stubs replaced with real SFTP calls
- Connection lifecycle managed (connect on first use, disconnect on unmount)
- Error handling preserved (toast messages for success/failure)

### Quality
- Code follows existing patterns from `useLocalFileOperations.ts`
- `ensureProvider()` pattern prevents duplicate connections
- `refreshFiles()` helper avoids code duplication
- Biome formatting applied

### Concerns
- **Direct connections** (`hostId.startsWith("direct_")`): The `sftp_connect` command requires credentials (password/private key), but the hook only receives `hostAddress`, `hostPort`, `hostUsername`. Direct connections without saved credentials may fail authentication. This is a limitation that should be addressed in a future task.
- **Upload performance**: Uses `arrayBuffer()` which loads entire file into memory. For large files, streaming upload via Tauri's native file dialog would be more efficient.
