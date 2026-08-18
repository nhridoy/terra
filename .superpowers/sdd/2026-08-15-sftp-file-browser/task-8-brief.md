### Task 8: RemoteFileProvider implementation

**Files:**
- Create: `client/src/lib/sftp/remoteFs.ts`

**Interfaces:**
- Consumes: Tauri `invoke` for SFTP IPC commands
- Produces: `RemoteFileProvider` class implementing `FileProvider`

- [ ] **Step 1: Create remoteFs.ts**

```typescript
// client/src/lib/sftp/remoteFs.ts
import type { FileItem, ProgressCallback } from "./fileTransfer";

export interface RemoteFileProvider {
  type: "remote";
  id: string;
  listFiles(path: string): Promise<FileItem[]>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(
    path: string,
    data: Uint8Array,
    onProgress?: ProgressCallback,
  ): Promise<void>;
  moveFile(source: string, dest: string): Promise<void>;
  copyFile(source: string, dest: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  chown(path: string, uid: number, gid: number): Promise<void>;
  symlink(target: string, linkPath: string): Promise<void>;
  readlink(path: string): Promise<string>;
  stat(path: string): Promise<FileItem>;
  search(path: string, query: string): Promise<FileItem[]>;
  download(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback,
  ): Promise<void>;
  upload(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback,
  ): Promise<void>;
}

export class RemoteFileProviderImpl implements RemoteFileProvider {
  type = "remote" as const;
  private invoke: typeof import("@tauri-apps/api/core").invoke;

  constructor(
    public id: string,
    private sessionId: string,
  ) {
    this.invoke = null as any; // Lazy load
  }

  private async getInvoke() {
    if (!this.invoke) {
      const mod = await import("@tauri-apps/api/core");
      this.invoke = mod.invoke;
    }
    return this.invoke;
  }

  async listFiles(path: string): Promise<FileItem[]> {
    const invoke = await this.getInvoke();
    const entries = await invoke<
      Array<{
        name: string;
        path: string;
        is_dir: boolean;
        is_symlink: boolean;
        size: number;
        mode: number;
        uid: number;
        gid: number;
        mtime: number;
        atime: number;
        symlink_target: string | null;
      }>
    >("sftp_list", { sessionId: this.sessionId, path });

    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDirectory: e.is_dir,
      isSymlink: e.is_symlink,
      size: e.size,
      mode: e.mode,
      uid: e.uid,
      gid: e.gid,
      mtime: e.mtime,
      atime: e.atime,
      symlinkTarget: e.symlink_target,
    }));
  }

  async readFile(path: string): Promise<Uint8Array> {
    const invoke = await this.getInvoke();
    // Read in chunks for large files
    const chunkSize = 64 * 1024;
    const chunks: Uint8Array[] = [];
    let offset = 0;

    while (true) {
      const chunk = await invoke<number[]>("sftp_read", {
        sessionId: this.sessionId,
        path,
        offset,
        len: chunkSize,
      });
      if (chunk.length === 0) break;
      chunks.push(new Uint8Array(chunk));
      offset += chunk.length;
    }

    // Combine chunks
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }
    return result;
  }

  async writeFile(
    path: string,
    data: Uint8Array,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const invoke = await this.getInvoke();
    const chunkSize = 64 * 1024;
    const total = data.length;

    for (let offset = 0; offset < total; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);
      await invoke("sftp_write", {
        sessionId: this.sessionId,
        path,
        data: Array.from(chunk),
        offset,
      });
      onProgress?.(Math.min(offset + chunkSize, total), total);
    }
  }

  async moveFile(source: string, dest: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_rename", {
      sessionId: this.sessionId,
      oldPath: source,
      newPath: dest,
    });
  }

  async copyFile(source: string, dest: string): Promise<void> {
    // SFTP doesn't have native copy - read then write
    const data = await this.readFile(source);
    await this.writeFile(dest, data);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_mkdir", { sessionId: this.sessionId, path });
  }

  async chmod(path: string, mode: number): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_chmod", { sessionId: this.sessionId, path, mode });
  }

  async chown(path: string, uid: number, gid: number): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_chown", { sessionId: this.sessionId, path, uid, gid });
  }

  async symlink(target: string, linkPath: string): Promise<void> {
    const invoke = await this.getInvoke();
    await invoke("sftp_symlink", {
      sessionId: this.sessionId,
      target,
      linkPath,
    });
  }

  async readlink(path: string): Promise<string> {
    const invoke = await this.getInvoke();
    return invoke("sftp_readlink", { sessionId: this.sessionId, path });
  }

  async stat(path: string): Promise<FileItem> {
    const invoke = await this.getInvoke();
    const e = await invoke<{
      name: string;
      path: string;
      is_dir: boolean;
      is_symlink: boolean;
      size: number;
      mode: number;
      uid: number;
      gid: number;
      mtime: number;
      atime: number;
      symlink_target: string | null;
    }>("sftp_stat", { sessionId: this.sessionId, path });

    return {
      name: e.name,
      path: e.path,
      isDirectory: e.is_dir,
      isSymlink: e.is_symlink,
      size: e.size,
      mode: e.mode,
      uid: e.uid,
      gid: e.gid,
      mtime: e.mtime,
      atime: e.atime,
      symlinkTarget: e.symlink_target,
    };
  }

  async search(path: string, query: string): Promise<FileItem[]> {
    const invoke = await this.getInvoke();
    const entries = await invoke<
      Array<{
        name: string;
        path: string;
        is_dir: boolean;
        is_symlink: boolean;
        size: number;
        mode: number;
        uid: number;
        gid: number;
        mtime: number;
        atime: number;
        symlink_target: string | null;
      }>
    >("sftp_search", { sessionId: this.sessionId, path, query });

    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDirectory: e.is_dir,
      isSymlink: e.is_symlink,
      size: e.size,
      mode: e.mode,
      uid: e.uid,
      gid: e.gid,
      mtime: e.mtime,
      atime: e.atime,
      symlinkTarget: e.symlink_target,
    }));
  }

  async download(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const invoke = await this.getInvoke();
    const transferId = crypto.randomUUID();

    // Start download in Rust (runs in background)
    await invoke("sftp_download", {
      sessionId: this.sessionId,
      remotePath,
      localPath,
      transferId,
    });
  }

  async upload(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const invoke = await this.getInvoke();
    const transferId = crypto.randomUUID();

    await invoke("sftp_upload", {
      sessionId: this.sessionId,
      localPath,
      remotePath,
      transferId,
    });
  }
}
```

- [ ] **Step 2: Run biome check**

Run: `cd client && pnpm biome check src/lib/sftp/remoteFs.ts`
Expected: Passes (or auto-fixable issues)

- [ ] **Step 3: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): implement RemoteFileProvider"
```
