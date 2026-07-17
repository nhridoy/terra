# TermVault Architecture Plan: Server-Hosted → Local-First (Termius Model)

## Tracking Instructions

Every task has a checkbox `- [ ]`. When a task is completed, mark it `- [x]` **and push a git commit**. The plan is designed to be executed sequentially — complete Phase 0 before starting Phase 1, etc.

**Rules:**
- Work through phases in order (0 → 1 → 2 → 3 → 4 → 5 → 6 → 7)
- For each task: implement → verify (`cargo build`, `go build`, `npx tsc --noEmit` as applicable) → mark `[x]` → commit
- Never skip verification commands
- If blocked, note the reason next to the task and ask the user for guidance
- After all tasks in a phase are done, mark the phase header as done and commit

**Commit message format:**
```
phase-0: migrate from Tauri v1 to v2
- Cargo.toml: upgrade tauri/tauri-build to v2, add plugin crates, add [lib] section
- lib.rs: create with mobile_entry_point, register plugins
- main.rs: reduce to app_lib::run()
- tauri.conf.json: rewrite to v2 format
- capabilities: add default.json with plugin permissions
- localFs.ts: migrate to @tauri-apps/plugin-fs and plugin-dialog
- updateStore.ts: update __TAURI__ checks to __TAURI_INTERNALS__
- package.json: upgrade @tauri-apps/api and @tauri-apps/cli to v2
```
or shorter:
```
phase-0: migrate Tauri v1 to v2
```

---

## Overview

Shift from **server-proxied SSH** (browser → our server → remote) to **local-first native app** (Tauri app → direct SSH → remote, server only for sync). Targets: **Windows, macOS, Linux, Android, iOS**.

### Current Architecture

```
Browser → WebSocket → Our Server (SSH proxy + connection pool) → Remote Server
                           ↑
                    All users share server DB
                          All SSH traffic proxied
```

### Target Architecture

```
┌──────────────────────────────────────────┐
│ Tauri v2 App (Desktop + Mobile)         │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ React UI     │  │ Rust Core        │ │
│  │ (xterm.js,   │←─┤ (ssh2 crate,     │ │
│  │  Zustand)    │  │  SQLite, Crypto) │ │
│  │              │  │                  │ │
│  └──────────────┘  └──────┬───────────┘ │
│                           │              │
│                    ┌──────▼───────────┐  │
│                    │ Sync Engine      │  │
│                    │ (push/pull)      │  │
│                    └──────┬───────────┘  │
└───────────────────────────┼──────────────┘
                            │ HTTPS (sync + auth only)
                            ▼
┌──────────────────────────────────────────────┐
│ Server (Go) — sync + auth only               │
│  REST API: CRUD + push/pull sync             │
│  NO SSH proxy, NO connection pool            │
└──────────────────────────────────────────────┘
```

### Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| SSH connection path | Browser → Server → Remote | Tauri → Remote (direct) |
| Server role | SSH proxy + sync + CRUD | Sync + CRUD only |
| Data storage | Server DB | Local SQLite (encrypted) |
| Offline support | None | Full |
| Web UI | Yes | Removed (native app only) |
| Authentication | SRP6a over HTTP | SRP6a over HTTP (kept) |
| Framework | Tauri v1 (Win/Mac/Linux only) | Tauri v2 (Win/Mac/Linux/Android/iOS) |
| File system API | `@tauri-apps/api/fs` (v1 built-in) | `@tauri-apps/plugin-fs` (v2 plugin) |
| Dialog API | `@tauri-apps/api/dialog` (v1 built-in) | `@tauri-apps/plugin-dialog` (v2 plugin) |
| Permission model | `allowlist` in tauri.conf.json | Capability files in `src-tauri/capabilities/` |
| IPC invoke import | `@tauri-apps/api/tauri` | `@tauri-apps/api/core` |
| Window type | `Window` | `WebviewWindow` |
| Rust entry point | `main.rs` only | `lib.rs` + `main.rs` (mobile support) |
| Mobile support | ❌ | ✅ Android + iOS via Tauri v2 |

---

## Phase 0: Tauri v1 → v2 Migration [x]

**Goal**: Upgrade from Tauri v1 to v2 so we can target desktop + mobile from a single codebase. All Phase 1-6 work depends on this — complete before anything else.

**Key changes in v2** (from official Tauri migration guide):
- `package.productName` → top-level `productName`; `tauri` key → `app`
- `allowlist` removed → replaced by `capabilities/` files with ACL-based permissions
- `devPath` → `devUrl`; `distDir` → `frontendDist`
- `build.withGlobalTauri` → `app.withGlobalTauri`
- `tauri::api::*` modules removed → all moved to plugins (`tauri-plugin-*`)
- `@tauri-apps/api/tauri` → `@tauri-apps/api/core`
- `@tauri-apps/api/fs` → `@tauri-apps/plugin-fs`
- `@tauri-apps/api/dialog` → `@tauri-apps/plugin-dialog`
- `Window` → `WebviewWindow`; `get_window()` → `get_webview_window()`
- `WindowBuilder` → `WebviewWindowBuilder`; `WindowUrl` → `WebviewUrl`
- Windows origin URL: `https://tauri.localhost` → `http://tauri.localhost` (IndexedDB/LocalStorage will reset unless `app.windows[].useHttpsScheme: true`)
- Linux: requires `libwebkit2gtk-4.1-0` (not `4.0-37`)
- Must add `[lib]` section to Cargo.toml and create `lib.rs` with `#[cfg_attr(mobile, tauri::mobile_entry_point)]`
- Global `__TAURI__` → `__TAURI_INTERNALS__`
- Event system redesigned: `emit()` = all listeners, `emit_to()` = specific target, `listen_global` → `listen_any`

**Files Modified:**

| File | Change |
|------|--------|
| `client/src-tauri/Cargo.toml` | Upgrade to tauri 2, remove feature flags, add plugin crates, add `[lib]` section |
| `client/src-tauri/src/main.rs` | Reduce to `app_lib::run()` |
| `client/src-tauri/src/lib.rs` | **NEW** — Tauri Builder + mobile_entry_point + plugin registration |
| `client/src-tauri/tauri.conf.json` | Rewrite to v2 config format |
| `client/src-tauri/capabilities/default.json` | **NEW** — Plugin permissions replacing `allowlist` |
| `client/src-tauri/build.rs` | Update (minimal change) |
| `client/package.json` | Upgrade @tauri-apps/api and cli to v2, add plugin packages |
| `client/src/lib/localFs.ts` | Migrate fs + dialog imports to plugins, update `__TAURI__` checks |
| `client/src/stores/updateStore.ts` | Update `__TAURI__` checks to `__TAURI_INTERNALS__` |

### Task 0.1 — Update Cargo.toml [x]

File: `client/src-tauri/Cargo.toml`

New content:
```toml
[package]
name = "termvault"
version = "1.0.0"
description = "TermVault - Self-hosted SSH client"
edition = "2021"

[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-http = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
ssh2 = "0.9"
reqwest = { version = "0.12", features = ["json"] }
anyhow = "1.0"
uuid = { version = "1.0", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
log = "0.4"
env_logger = "0.11"
rusqlite = { version = "0.32", features = ["bundled"] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

Key changes from v1:
- `tauri` version `1.6` → `2` (no feature flags — they're now individual plugins)
- `tauri-build` version `1.5` → `2`
- Remove all v1 feature flags: `shell-open`, `fs-all`, `path-all`, `http-all`, `dialog-all`
- Add plugin crates: `tauri-plugin-shell`, `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-http`, `tauri-plugin-updater`, `tauri-plugin-process`
- Add `[lib]` section with `crate-type = ["staticlib", "cdylib", "rlib"]` — required for mobile
- Add `uuid`, `chrono`, `log`, `env_logger`, `rusqlite` (needed in later phases)
- Upgrade `reqwest` from `0.11` to `0.12`

**Verify**: `cargo build` succeeds with new dependencies.

### Task 0.2 — Create lib.rs with mobile entry point [x]

File: `client/src-tauri/src/lib.rs` (NEW — replaces the body of main.rs)

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ssh;
mod vault;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to TermVault!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("TermVault")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            ssh::connect,
            ssh::disconnect,
            ssh::send_input,
            ssh::resize,
            vault::derive_key,
            vault::encrypt,
            vault::decrypt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TermVault");
}
```

Key v2 changes:
- Uses `#[cfg_attr(mobile, tauri::mobile_entry_point)]` on the `run()` function — this macro prepares the function for mobile execution
- Registers plugins with `.plugin(tauri_plugin_shell::init())` etc. — each v1 feature flag becomes a plugin
- Uses `app.get_webview_window("main")` instead of `app.get_window("main")`
- Commands defined directly in `lib.rs` (like `greet`) **cannot** be `pub`
- Commands in separate modules (like `ssh::connect`) **must** be `pub`

**Verify**: `cargo build` succeeds.

### Task 0.3 — Update main.rs [x]

File: `client/src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run();
}
```

The `main.rs` is now a thin wrapper that calls the shared `run()` function from `lib.rs`. This pattern is required for mobile support — mobile builds compile to a shared library (`cdylib` for Android, `staticlib` for iOS) rather than a desktop executable.

**Verify**: `cargo build` succeeds.

### Task 0.4 — Rewrite tauri.conf.json to v2 [x]

File: `client/src-tauri/tauri.conf.json`

New content:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "TermVault",
  "version": "1.0.0",
  "mainBinaryName": "TermVault",
  "identifier": "com.termvault.app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "TermVault",
      "width": 1200,
      "height": 800,
      "minWidth": 800,
      "minHeight": 600,
      "resizable": true,
      "fullscreen": false,
      "decorations": true,
      "dragDropEnabled": true
    }],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "windows": {
      "nsis": {
        "installMode": "both",
        "license": "../../LICENSE",
        "headerImage": "../../assets/header.bmp",
        "sidebarImage": "../../assets/sidebar.bmp"
      }
    },
    "macOS": {
      "dmg": {
        "appPosition": {"x": 180, "y": 170},
        "applicationFolderPosition": {"x": 480, "y": 170}
      }
    },
    "linux": {
      "deb": {
        "depends": ["libgtk-3-0", "libwebkit2gtk-4.1-0", "libappindicator3-1"]
      }
    }
  },
  "plugins": {
    "updater": {
      "endpoints": ["https://releases.termvault.app/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "dW50cnVzdGVkIGZvciBkZXZlbG9wbWVudCwgbm90IHByb2R1Y3Rpb24="
    }
  }
}
```

Key changes from v1:
- `$schema` added pointing to Tauri v2 schema
- `package.productName` → top-level `productName`
- `package.version` → top-level `version`
- `package` key removed entirely
- `tauri` key → `app`
- `tauri.allowlist` completely removed (now handled by `capabilities/` files)
- `tauri.updater` → `plugins.updater`
- `tauri.updater.active` removed
- `tauri.windows[].fileDropEnabled` → `app.windows[].dragDropEnabled`
- `build.distDir` → `build.frontendDist`
- `build.devPath` → `build.devUrl`
- `bundle` moved from `tauri.bundle` to top-level
- `bundle.identifier` → top-level `identifier`
- `bundle.dmg` → `bundle.macOS.dmg`
- `bundle.deb` → `bundle.linux.deb`
- `linux.deb.depends`: `libwebkit2gtk-4.0-37` → `libwebkit2gtk-4.1-0` (Tauri v2 requires newer webkit)
- Add `mainBinaryName` matching `productName` (v2 no longer auto-renames binary)
- Add top-level `identifier` (required in v2)

**Verify**: `cargo build` succeeds (config is parsed by Tauri build).

### Task 0.5 — Create capabilities/default.json [x]

File: `client/src-tauri/capabilities/default.json` (NEW — directory also needs creation)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:window:allow-set-title",
    "core:event:default",
    "shell:allow-open",
    "dialog:default",
    "fs:default",
    "http:default",
    "updater:default",
    "process:default"
  ]
}
```

In v2, the old `allowlist` in `tauri.conf.json` is replaced by the capabilities system. Each permission is granted using the `plugin-name:permission-name` format. Capabilities can be scoped to specific windows, platforms, or remote URLs.

Mapping from v1 allowlist to v2 capabilities:
- `shell:allow-open` ← `allowlist.shell.open`
- `dialog:default` ← `allowlist.dialog.all`
- `fs:default` ← `allowlist.fs.all`
- `http:default` ← `allowlist.http.all`
- `updater:default` ← `allowlist.updater`
- `core:window:allow-set-title` ← `window.set_title()` in Rust

The `$schema` path `../gen/schemas/desktop-schema.json` is auto-generated by `tauri-build` on first compile, providing IDE autocompletion.

**Verify**: `cargo build` succeeds.

### Task 0.6 — Update package.json [x]

File: `client/package.json`

Changes needed:
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-process": "^2.0.0",
    "@tauri-apps/plugin-updater": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    ...
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    ...
  }
}
```

Migration steps:
- `@tauri-apps/api`: `^1.5.0` → `^2.0.0`
- `@tauri-apps/cli`: `^1.5.0` → `^2.0.0`
- Add `@tauri-apps/plugin-fs` (was built into v1 core as `@tauri-apps/api/fs`)
- Add `@tauri-apps/plugin-dialog` (was built into v1 core as `@tauri-apps/api/dialog`)
- Add `@tauri-apps/plugin-shell` (was built into v1 core as a feature flag)
- Keep `@tauri-apps/plugin-process` (already at v2 — verify version compatibility)
- Keep `@tauri-apps/plugin-updater` (already at v2 — verify version compatibility)

**Verify**: `pnpm install` succeeds. `npx tsc --noEmit` passes.

### Task 0.7 — Update localFs.ts [x]

File: `client/src/lib/localFs.ts`

Changes needed:

1. **Import paths**:
   - `import('@tauri-apps/api/fs')` → `import('@tauri-apps/plugin-fs')`
   - `import('@tauri-apps/api/dialog')` → `import('@tauri-apps/plugin-dialog')`

2. **API renames** (as per Tauri v2 migration guide):
   - `createDir(path, opts)` → `mkdir(path, opts)`
   - `removeFile(path)` → `remove(path)`
   - `removeDir(path)` → `remove(path)`
   - `renameFile(old, new)` → `rename(old, new)`
   - `writeBinaryFile(path, content)` → `writeFile(path, content)`
   - `readBinaryFile(path)` → `readFile(path)`
   - `Dir` enum alias → `BaseDirectory`

3. **Feature detection**:
   - `window.__TAURI__` → `window.__TAURI_INTERNALS__`
   - The `isTauriAvailable()` function or similar checks need updating

```typescript
// v1 → v2 API mapping:
// readDir(path) → readDir(path, { recursive })  [different return type too]
// createDir(path) → mkdir(path)
// removeFile(path) → remove(path)
// removeDir(path) → remove(path)
// renameFile(old, new) → rename(old, new)
// readTextFile(path) → readTextFile(path)  [same signature]
// writeTextFile(path, content) → writeTextFile(path, content)  [same signature]
// exists(path) → exists(path)  [same signature]
// open({ title }) → open({ title })  [dialog API, same signature]
// save({ title }) → save({ title })  [dialog API, same signature]
```

**Verify**: `npx tsc --noEmit` passes.

### Task 0.8 — Update updateStore.ts [x]

File: `client/src/stores/updateStore.ts`

Changes:
- `window.__TAURI__` check → `window.__TAURI_INTERNALS__`

No import changes needed — this file already uses v2 plugin packages (`@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`). The v2 updater plugin API:

```typescript
import { check } from '@tauri-apps/plugin-updater'

const update = await check()
if (update?.available) {
  console.log(`Update to ${update.version} available!`)
  await update.downloadAndInstall()
  // Then relaunch via process plugin
}

import { relaunch } from '@tauri-apps/plugin-process'
await relaunch()
```

The current code references `{ event, data: { contentLength, chunkLength } }` for download progress events — this matches the v2 API. Verify no breaking changes in the download event payload structure.

**Verify**: `npx tsc --noEmit` passes.

### Task 0.9 — Update build.rs [x]

File: `client/src-tauri/build.rs`

```rust
fn main() {
    tauri_build::build()
}
```

No changes needed for basic usage. If we want to restrict custom commands via permissions later (so not all custom commands are allowed by default), we can use `try_build` with `AppManifest`:

```rust
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["your_command"])),
    )
    .unwrap();
}
```

**Verify**: `cargo build` succeeds.

### Task 0.10 — Build verification [x]

```bash
cd client/src-tauri && cargo build
cd client && pnpm install && npx tsc --noEmit
pnpm tauri dev  # Launch and verify app works
```

- [x] `cargo build` succeeds
- [x] `npx tsc --noEmit` passes
- [ ] `pnpm tauri dev` launches without errors
- [ ] App window appears with title "TermVault"
- [ ] File system operations work (localFs.ts)
- [ ] Update checker works (updateStore.ts)

---

## Phase 1: Rust SSH/SFTP Core [x]

**Goal**: Replace Go server SSH proxy with direct SSH/SFTP from Tauri Rust backend.

**Files Modified:**

| File | Change |
|------|--------|
| `client/src-tauri/src/ssh.rs` | Rewrite with real SSH2 connections, sessions, PTY, resize |
| `client/src-tauri/src/lib.rs` | Register new commands, add SSH state management |
| `client/src/components/terminal/sessionManager.ts` | Replace WebSocket with Tauri invoke + events |
| `client/src/lib/api.ts` | Replace SFTP HTTP calls with Tauri invoke |
| `client/src/hooks/useSFTP.ts` | Fix to call new API |

### Task 1.1 — Rewrite ssh.rs with real SSH2 [x]

File: `client/src-tauri/src/ssh.rs`

Implementation details:
- Use `ssh2` crate (already in Cargo.toml)
- `SSHConfig` struct: host, port, username, password?, private_key?, passphrase?
- `SSHSession` struct holds: id, `ssh2::Session`, channel for PTY I/O, cols/rows
- `SSHState` with `Mutex<HashMap<String, SSHSession>>` (accessed via `tauri::State<'_, SSHState>`)
- Commands:
  - `connect(config: SSHConfig, app: tauri::AppHandle, state: tauri::State<'_, SSHState>)` — Connect, authenticate (password or key), create session, spawn reader thread emitting events
  - `disconnect(session_id: String, state)` — Close session, remove from state
  - `send_input(session_id: String, data: String, state)` — Write to PTY channel
  - `resize(session_id: String, cols: u32, rows: u32, state)` — Resize PTY
- Output reading: Spawn a reader thread per session that emits `ssh-output` events via `app_handle.emit("ssh-output", payload)`. Frontend listens via `listen('ssh-output', callback)`.
- PTY: Use `session.request_pty()` with `"xterm-256color"`, then `session.shell()`

```rust
// Key structure:
use std::sync::Mutex;
use std::collections::HashMap;

pub struct SSHSession {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub connected: bool,
    session: Option<ssh2::Session>,
    channel: Option<ssh2::Channel>,
    reader_stop: Option<std::sync::Arc<std::sync::atomic::AtomicBool>>,
}

pub struct SSHState {
    pub sessions: Mutex<HashMap<String, SSHSession>>,
}
```

**Verify**: `cargo build` succeeds. Can call `connect` and `disconnect` from frontend.

### Task 1.2 — Add SFTP commands to ssh.rs [x]

Add to `client/src-tauri/src/ssh.rs`:

- `SFTPFileItem` struct: name, path, type (file/dir/symlink), size, permissions, modified_at
- Commands:
  - `sftp_list(session_id: String, path: String, state)` — List directory via `sftp.readdir()`, return `Vec<SFTPFileItem>`
  - `sftp_read(session_id: String, path: String, state)` — Read file content via `sftp.open() + file.read_to_string()`
  - `sftp_write(session_id: String, path: String, content: String, state)` — Write file via `sftp.create() + file.write()`
  - `sftp_delete(session_id: String, path: String, state)` — Delete file or empty dir
  - `sftp_mkdir(session_id: String, path: String, state)` — Create directory
  - `sftp_rename(session_id: String, old_path: String, new_path: String, state)` — Rename/move
  - `sftp_chmod(session_id: String, path: String, mode: u32, state)` — Change permissions
  - `sftp_readdir(session_id: String, path: String, state)` — Like sftp_list but returns raw DirEntry for more detail

**Verify**: `cargo build` succeeds.

### Task 1.3 — Register SSH/SFTP commands in lib.rs [x]

File: `client/src-tauri/src/lib.rs`

Add to `invoke_handler`:
- `ssh::sftp_list`
- `ssh::sftp_read`
- `ssh::sftp_write`
- `ssh::sftp_delete`
- `ssh::sftp_mkdir`
- `ssh::sftp_rename`
- `ssh::sftp_chmod`

Existing handlers to keep:
- `greet`
- `ssh::connect`
- `ssh::disconnect`
- `ssh::send_input`
- `ssh::resize`
- `vault::derive_key`
- `vault::encrypt`
- `vault::decrypt`

Add `SSHState` management:
```rust
.manage(SSHState {
    sessions: Mutex::new(HashMap::new()),
})
```

**Verify**: `cargo build` succeeds.

### Task 1.4 — Update sessionManager.ts [x]

File: `client/src/components/terminal/sessionManager.ts`

Replace WebSocket-based SSH with Tauri `invoke()` + event system.

Changes:
- Remove `connectWs()` WebSocket logic
- Add `async function connectViaTauri(session: Session)` that:
  1. Calls `invoke('connect', { config })` (import from `@tauri-apps/api/core`)
  2. Sets up event listener via `listen('ssh-output', callback)` (import from `@tauri-apps/api/event`)
  3. Updates session status

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const unlisten = await listen<{ sessionId: string; data: string }>('ssh-output', (event) => {
  const { sessionId, data } = event.payload
  if (sessionId === session.params.paneId) {
    xterm.write(data)
  }
})
```

Key changes to function signatures:
- `connectWs(session)` → `connectViaTauri(session)`
- `onData` handler calls `invoke('send_input', { sessionId, data })`
- `onResize` handler calls `invoke('resize', { sessionId, cols, rows })`
- `destroySession` calls `invoke('disconnect', { sessionId })` and `unlisten()` for cleanup

**Verify**: `npx tsc --noEmit` passes.

### Task 1.5 — Update api.ts SFTP methods [x]

File: `client/src/lib/api.ts`

Replace all SFTP methods in `ApiClient` class with Tauri invoke wrappers:

- `listFiles(hostId, path)` → `invoke('sftp_list', { sessionId: hostId, path })`
- `readFile(hostId, path)` → `invoke('sftp_read', { sessionId: hostId, path })`
- `writeFile(hostId, path, content)` → `invoke('sftp_write', ...)`
- `uploadFile(hostId, remotePath, fileName, content)` → `invoke('sftp_write', ...)`
- `uploadFileWithProgress(hostId, remotePath, file, onProgress)` → Need to implement streaming upload via Tauri. Use `invoke('sftp_upload_file', { sessionId, remotePath, fileContent })` where file is read as base64 in JS.
- `downloadFileBlob(hostId, path, fileName)` → `invoke('sftp_read', ...)` then create blob from result
- `deleteFile(hostId, path)` → `invoke('sftp_delete', ...)`
- `moveFile(hostId, oldPath, newPath)` → `invoke('sftp_rename', ...)`
- `createDirectory(hostId, parentPath, name)` → `invoke('sftp_mkdir', ...)`
- `copyFile(hostId, srcPath, dstPath)` → `invoke('sftp_copy', ...)` (need Rust-side copy implementation)
- `crossHostCopy` / `crossHostMove` — Need both source and destination sessions. Either:
  - Rust-side: invoke with two session IDs, Rust does the copy
  - JS-side: download from source, upload to destination (fallback)
  - **Chosen**: Rust-side for efficiency. `invoke('sftp_cross_copy', { srcSessionId, srcPath, dstSessionId, dstPath })`

Also need to add `getSFTPClient(sessionId)` helper that returns a wrapper object for components that use `api.listFiles(...)` style calls.

**Verify**: `npx tsc --noEmit` passes.

### Task 1.6 — Fix useSFTP.ts hook [x]

File: `client/src/hooks/useSFTP.ts`

Read this file and update to use new invoke-based SFTP methods. The hook likely wraps `api.listFiles` etc — change to call `api` methods directly (which now use Tauri invoke).

**Verify**: `npx tsc --noEmit` passes.

### Task 1.7 — Build verification [x]

- [ ] `cd client/src-tauri && cargo build` succeeds
- [ ] `cd client && npx tsc --noEmit` passes
- [ ] `pnpm tauri dev` starts without errors
- [ ] Can connect to SSH host
- [ ] Terminal output displays in xterm.js
- [ ] Can list files via SFTP
- [ ] Can upload/download files via SFTP
- [ ] Cross-host copy works

---

## Phase 2: Local Database [x]

**Goal**: All config data stored locally in SQLite. Server-independent CRUD.

**Files Modified:**

| File | Change |
|------|--------|
| `client/src-tauri/src/db.rs` | **NEW** — SQLite module with migrations |
| `client/src-tauri/src/crud.rs` | **NEW** — CRUD commands |
| `client/src-tauri/src/lib.rs` | Register CRUD commands, init DB on setup |
| `client/src/stores/hostStore.ts` | Replace API calls with invoke |
| `client/src/stores/vaultStore.ts` | Replace API calls with invoke |
| `client/src/stores/keyStore.ts` | Replace API calls with invoke |
| `client/src/stores/snippetStore.ts` | Replace API calls with invoke |
| `client/src/stores/workspaceStore.ts` | Replace API calls with invoke |
| `client/src/stores/tabGroupStore.ts` | Replace API calls with invoke |
| `client/src/stores/settingsStore.ts` | Replace API calls with invoke |
| `client/src/stores/sessionStore.ts` | Replace API calls with invoke |
| `client/src/stores/authStore.ts` | Add set_user_id after login |
| `client/src/lib/api.ts` | Remove old CRUD HTTP calls (keep auth endpoints) |

### Task 2.1 — Add SQLite dependencies [x]

File: `client/src-tauri/Cargo.toml` (already done in Task 0.1 — `rusqlite` is included)

Add `once_cell` if not using std's `LazyLock`:
- `once_cell = "1.19"` — for `Lazy` static (Rust <1.80) or use `std::sync::LazyLock` (Rust 1.80+)

**Chosen**: `rusqlite` directly in Rust. We need encryption at rest in Phase 3. The `bundled` feature compiles SQLite from source, avoiding system dependency issues.

**Verify**: `cargo build` succeeds.

### Task 2.2 — Create db.rs module [x]

File: `client/src-tauri/src/db.rs` (NEW)

Module structure:
- `pub fn init(db_path: &str) -> Result<()>` — Initialize DB, run migrations
- `pub fn get_connection() -> rusqlite::Connection` — Get connection (from Mutex global)
- `pub fn run_migrations(conn: &Connection) -> Result<()>` — Create tables

```rust
use rusqlite::{Connection, params};
use std::sync::Mutex;

pub static DB: once_cell::sync::Lazy<Mutex<Connection>> = once_cell::sync::Lazy::new(|| {
    panic!("DB not initialized before first use. Call db::init() first.");
});

pub fn init(db_path: &str) -> Result<(), String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    run_migrations(&conn).map_err(|e| e.to_string())?;
    unsafe { *DB.as_ptr() = Mutex::new(conn); }
    Ok(())
}
```

Use `app.path().app_data_dir()` for the DB path (v2 API — replaces `app.path_resolver().app_data_dir()`):

```rust
// In lib.rs setup:
let app_data_dir = app.path().app_data_dir().expect("failed to get app dir");
std::fs::create_dir_all(&app_data_dir).ok();
let db_path = app_data_dir.join("termvault.db");
db::init(db_path.to_str().unwrap()).expect("Failed to init DB");
```

**Verify**: `cargo build` succeeds.

### Task 2.3 — Create local schema [x]

In `db.rs`, `run_migrations()`:

```sql
-- Hosts table
CREATE TABLE IF NOT EXISTS hosts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vault_id TEXT,
    group_id TEXT,
    name TEXT NOT NULL,
    hostname TEXT,
    address TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT,
    private_key TEXT,
    passphrase TEXT,
    auth_method TEXT DEFAULT 'password',
    tags TEXT DEFAULT '[]',
    color TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vault_id TEXT,
    parent_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vaults table
CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    encrypted_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Keychain table
CREATE TABLE IF NOT EXISTS keychain (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vault_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    key_type TEXT NOT NULL,
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT,
    fingerprint TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Snippets table
CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vault_id TEXT,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    description TEXT,
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vault_id TEXT,
    name TEXT NOT NULL,
    layout TEXT NOT NULL,
    host_ids TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tab Groups (Quick Presets)
CREATE TABLE IF NOT EXISTS tab_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    vault_id TEXT,
    name TEXT NOT NULL,
    layout TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    theme TEXT DEFAULT 'dark',
    font_family TEXT DEFAULT 'JetBrains Mono',
    font_size INTEGER DEFAULT 14,
    cursor_style TEXT DEFAULT 'block',
    keybindings TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Session Logs table
CREATE TABLE IF NOT EXISTS session_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    host_id TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    data TEXT,
    size_bytes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Command Logs table
CREATE TABLE IF NOT EXISTS command_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    command TEXT NOT NULL,
    output TEXT,
    exit_code INTEGER,
    executed_at TEXT NOT NULL,
    duration_ms INTEGER DEFAULT 0
);

-- Sync state table
CREATE TABLE IF NOT EXISTS sync_state (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    last_sync_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Sync tracking per record
CREATE TABLE IF NOT EXISTS sync_tracking (
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    PRIMARY KEY (table_name, record_id)
);

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
```

**Verify**: Run migration on app startup. DB file created with all tables.

### Task 2.4 — Implement local CRUD commands [x]

File: `client/src-tauri/src/crud.rs` (NEW)

Commands for each entity type (hosts, groups, vaults, keychain, snippets, workspaces, tab_groups, settings):

Each command:
1. Takes entity data as parameter
2. Validates required fields
3. Gets DB connection from Mutex
4. Executes SQL (INSERT/UPDATE/DELETE/SELECT)
5. Updates `sync_tracking` table with `updated_at` (for sync engine)
6. Returns result

Example commands pattern:
```rust
#[tauri::command]
pub fn create_host(host: HostData, state: State<'_, AppState>) -> Result<Host, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO hosts (id, user_id, vault_id, group_id, name, address, port, username, auth_method, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![id, host.user_id, host.vault_id, host.group_id, host.name, host.address, host.port, host.username, host.auth_method, now, now],
    ).map_err(|e| e.to_string())?;

    // Update sync tracking
    conn.execute(
        "INSERT OR REPLACE INTO sync_tracking (table_name, record_id, updated_at, device_id)
         VALUES ('hosts', ?1, ?2, ?3)",
        params![id, now, state.device_id],
    ).map_err(|e| e.to_string())?;

    Ok(Host { id, ..host })
}
```

Commands to create (one function per operation):

**Hosts:**
- `create_host(host: HostData)` → Host
- `get_host(id: String)` → Host
- `list_hosts(user_id: String)` → Vec<Host>
- `update_host(id: String, host: HostData)` → Host
- `delete_host(id: String)` → ()
- `list_hosts_by_group(group_id: String)` → Vec<Host>

**Groups:**
- `create_group(group: GroupData)` → Group
- `get_group(id: String)` → Group
- `list_groups(user_id: String)` → Vec<Group>
- `update_group(id: String, group: GroupData)` → Group
- `delete_group(id: String)` → ()

**Vaults:**
- `create_vault(vault: VaultData)` → Vault
- `list_vaults(user_id: String)` → Vec<Vault>
- `update_vault(id: String, vault: VaultData)` → Vault
- `delete_vault(id: String)` → ()
- `get_vault_data(id: String)` → VaultData (encrypted blob content)

**Keychain:**
- `create_key(key: KeyData)` → Key
- `list_keys(user_id: String)` → Vec<Key>
- `delete_key(id: String)` → ()
- `get_key(id: String)` → Key

**Snippets:**
- `create_snippet(snippet: SnippetData)` → Snippet
- `list_snippets(user_id: String)` → Vec<Snippet>
- `update_snippet(id: String, snippet: SnippetData)` → Snippet
- `delete_snippet(id: String)` → ()
- `search_snippets(query: String)` → Vec<Snippet>

**Workspaces:**
- `create_workspace(workspace: WorkspaceData)` → Workspace
- `list_workspaces(user_id: String)` → Vec<Workspace>
- `update_workspace(id: String, workspace: WorkspaceData)` → Workspace
- `delete_workspace(id: String)` → ()

**Tab Groups:**
- `create_tab_group(group: TabGroupData)` → TabGroup
- `list_tab_groups(user_id: String)` → Vec<TabGroup>
- `update_tab_group(id: String, group: TabGroupData)` → TabGroup
- `delete_tab_group(id: String)` → ()

**Settings:**
- `get_settings(user_id: String)` → Settings
- `update_settings(user_id: String, settings: SettingsData)` → Settings

**Session Logs:**
- `create_session_log(log: SessionLogData)` → SessionLog
- `list_session_logs(user_id: String)` → Vec<SessionLog>
- `get_session_log(id: String)` → SessionLog
- `delete_session_log(id: String)` → ()
- `end_session_log(id: String)` → () (sets ended_at)

**Command Logs:**
- `log_command(log: CommandLogData)` → CommandLog
- `list_command_logs(session_id: String)` → Vec<CommandLog>

**AppState** struct:
```rust
pub struct AppState {
    pub device_id: String,
    pub user_id: Mutex<Option<String>>,
}
```

Initialize in `lib.rs`:
```rust
.manage(AppState {
    device_id: get_or_create_device_id(),
    user_id: Mutex::new(None),
})
```

**Verify**: `cargo build` succeeds.

### Task 2.5 — Update stores to use local DB [x]

For each Zustand store, replace HTTP API calls with Tauri `invoke()` calls:

**hostStore.ts** (`client/src/stores/hostStore.ts`):
```typescript
import { invoke } from '@tauri-apps/api/core'

// Before:
const hosts = await api.listHosts(vaultId)

// After:
const hosts = await invoke('list_hosts', { userId: authStore.userId })
```

Stores to update:
- `hostStore.ts` — `listHosts`, `createHost`, `updateHost`, `deleteHost`
- `vaultStore.ts` — `listVaults`, `createVault`, `updateVault`, `deleteVault`
- `keyStore.ts` — `listKeys`, `importKey`, `generateKey`, `deleteKey`
- `snippetStore.ts` — `listSnippets`, `createSnippet`, `updateSnippet`, `deleteSnippet`
- `workspaceStore.ts` — `listWorkspaces`, `createWorkspace`, `updateWorkspace`, `deleteWorkspace`
- `tabGroupStore.ts` — `listTabGroups`, `createTabGroup`, `updateTabGroup`, `deleteTabGroup`
- `settingsStore.ts` — `getSettings`, `updateSettings`
- `sessionStore.ts` — `listSessions`, `getSession`, `deleteSession`
- `terminalStore.ts` — Any API calls for workspace/session saving

**Important**: The auth flow stays the same (SRP6a login via server API). After login, store `userId` in `AppState` on the Rust side.

**Verify**: `npx tsc --noEmit` passes.

### Task 2.6 — Build verification [x]

- [ ] `cargo build` succeeds
- [ ] SQLite file created at app data directory
- [ ] All tables created
- [ ] Can create host in UI → persists in SQLite
- [ ] Can edit host → persists
- [ ] Can delete host → removed
- [ ] All CRUD operations work offline

---

## Phase 3: Local Encryption [x]

**Goal**: All sensitive data encrypted at rest with master password.

**Files Modified:**

| File | Change |
|------|--------|
| `client/src-tauri/Cargo.toml` | Add argon2, chacha20poly1305, hex, rand |
| `client/src-tauri/src/vault.rs` | Rewrite with Argon2id + ChaCha20Poly1305 |
| `client/src-tauri/src/lib.rs` | Add encryption_key to AppState, register new commands |
| `client/src-tauri/src/db.rs` | Add encryption wrappers for sensitive fields |

### Task 3.1 — Rewrite vault.rs with Argon2id + XSalsa20+Poly1305 [x]

File: `client/src-tauri/src/vault.rs`

Add to `Cargo.toml`:
- `argon2 = "0.5"` — Argon2id key derivation
- `chacha20poly1305 = { version = "0.10", features = ["aead"] }` — XSalsa20+Poly1305
- `hex = "0.4"` — Hex encoding
- `rand = "0.8"` — Random nonce/salt generation

```rust
use argon2::{self, Algorithm, Argon2, Params, Version};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce, aead::{Aead, NewAead}};
use rand::RngCore;
use serde::{Deserialize, Serialize};

const OPS_LIMIT: u32 = 2;  // OPSLIMIT_INTERACTIVE
const MEM_LIMIT: u32 = 67108864;  // 64 MiB
const KEY_LENGTH: usize = 32;  // 256-bit key
const NONCE_LENGTH: usize = 12;  // 96-bit nonce for ChaCha20Poly1305
const SALT_LENGTH: usize = 16;  // 128-bit salt

#[derive(Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: String,
    pub nonce: String,
}

#[tauri::command]
pub fn generate_salt() -> String {
    let mut salt = [0u8; SALT_LENGTH];
    rand::thread_rng().fill_bytes(&mut salt);
    hex::encode(salt)
}

#[tauri::command]
pub fn derive_key(password: String, salt_hex: String) -> Result<String, String> {
    let salt_bytes = hex::decode(&salt_hex).map_err(|e| e.to_string())?;
    let argon2 = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(MEM_LIMIT, OPS_LIMIT, 1, Some(KEY_LENGTH))
            .map_err(|e| e.to_string())?,
    );
    let mut key = [0u8; KEY_LENGTH];
    argon2
        .hash_password_into(password.as_bytes(), &salt_bytes, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(hex::encode(key))
}

#[tauri::command]
pub fn encrypt(plaintext: String, key_hex: String) -> Result<EncryptedData, String> {
    let key_bytes = hex::decode(&key_hex).map_err(|e| e.to_string())?;
    let key = Key::from_slice(&key_bytes);
    let cipher = ChaCha20Poly1305::new(key);

    let mut nonce_bytes = [0u8; NONCE_LENGTH];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(EncryptedData {
        ciphertext: hex::encode(ciphertext),
        nonce: hex::encode(nonce_bytes),
    })
}

#[tauri::command]
pub fn decrypt(ciphertext_hex: String, nonce_hex: String, key_hex: String) -> Result<String, String> {
    let key_bytes = hex::decode(&key_hex).map_err(|e| e.to_string())?;
    let key = Key::from_slice(&key_bytes);
    let cipher = ChaCha20Poly1305::new(key);

    let nonce_bytes = hex::decode(&nonce_hex).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = hex::decode(&ciphertext_hex).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8(plaintext).map_err(|e| e.to_string())?)
}
```

**Verify**: `cargo build` succeeds. Can encrypt/decrypt a string round-trip.

### Task 3.2 — Encrypt sensitive fields in DB [x]

In `db.rs` / `crud.rs`, encrypt/decrypt sensitive fields automatically:

Sensitive fields to encrypt:
- `hosts.password` — SSH password
- `hosts.private_key` — SSH private key content
- `hosts.passphrase` — SSH key passphrase
- `keychain.encrypted_private_key` — Already encrypted but double-encrypt at rest
- `vaults.encrypted_data` — Already encrypted blob

Approach:
1. App starts, user enters master password → derive key → store derived key in `AppState` (in-memory only)
2. Before writing sensitive fields to DB → encrypt with derived key
3. After reading from DB → decrypt with derived key

Create wrapper functions:
```rust
fn encrypt_field(plaintext: &str, state: &AppState) -> Result<String, String> {
    let key = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key.as_ref().ok_or("Encryption key not set")?;
    vault::encrypt(plaintext.to_string(), key.clone())
}

fn decrypt_field(ciphertext_json: &str, state: &AppState) -> Result<String, String> {
    let key = state.encryption_key.lock().map_err(|e| e.to_string())?;
    let key = key.as_ref().ok_or("Encryption key not set")?;
    let encrypted: EncryptedData = serde_json::from_str(ciphertext_json).map_err(|e| e.to_string())?;
    vault::decrypt(encrypted.ciphertext, encrypted.nonce, key.clone())
}
```

Add `encryption_key` to `AppState`:
```rust
pub struct AppState {
    pub device_id: String,
    pub user_id: Mutex<Option<String>>,
    pub encryption_key: Mutex<Option<String>>,
}
```

**Verify**: Data in SQLite file is encrypted (cannot read plaintext passwords). App can still read data correctly.

---

## Phase 4: Sync Engine [ ]

**Goal**: Synchronize data between local DB and server.

**Files Modified:**

| File | Change |
|------|--------|
| `server/internal/db/models.go` | Add SyncState + SyncTracking models |
| `server/internal/db/db.go` | Add new tables to AutoMigrate |
| `server/internal/api/sync.go` | **NEW** — Sync push/pull endpoints |
| `server/cmd/termvault-server/main.go` | Add sync routes |
| `client/src-tauri/src/sync.rs` | **NEW** — Client sync engine |
| `client/src-tauri/src/lib.rs` | Register sync commands |
| `client/src/components/settings/SyncSettings.tsx` | **NEW** — Sync UI |

### Task 4.1 — Add sync tables to server DB [ ]

File: `server/internal/db/models.go`

Add new models:
```go
type SyncState struct {
    ID          string    `gorm:"primaryKey"`
    UserID      string    `gorm:"index;not null"`
    DeviceID    string    `gorm:"not null"`
    LastSyncAt  time.Time
    CreatedAt   time.Time
    UpdatedAt   time.Time
}

type SyncTracking struct {
    TableName string    `gorm:"primaryKey"`
    RecordID  string    `gorm:"primaryKey"`
    UserID    string    `gorm:"index;not null"`
    UpdatedAt time.Time `gorm:"not null"`
    DeviceID  string    `gorm:"not null"`
    IsDeleted bool      `gorm:"default:false"`
}
```

Add to `db.go` AutoMigrate.

### Task 4.2 — Create sync API endpoints [ ]

File: `server/internal/api/sync.go` (NEW)

```go
package api

import (
    "encoding/json"
    "net/http"
    "time"
    "github.com/gin-gonic/gin"
    "github.com/termvault/termvault/internal/db"
)

type SyncPushRequest struct {
    Records    []SyncRecord `json:"records"`
    DeviceID   string       `json:"deviceId"`
    LastSyncAt *time.Time   `json:"lastSyncAt,omitempty"`
}

type SyncRecord struct {
    TableName string    `json:"tableName"`
    RecordID  string    `json:"recordId"`
    Data      string    `json:"data"` // JSON string of the full record
    UpdatedAt time.Time `json:"updatedAt"`
    DeviceID  string    `json:"deviceId"`
    IsDeleted bool      `json:"isDeleted,omitempty"`
}

type SyncPullResponse struct {
    Records   []SyncRecord `json:"records"`
    SyncToken string       `json:"syncToken"`
    HasMore   bool         `json:"hasMore"`
}

// POST /api/sync/push
// Client sends all records that changed since last sync.
// Server applies last-write-wins: if server's updatedAt < client's updatedAt, accept client version.
// If server's updatedAt >= client's updatedAt, reject and return server's version as conflict.
func SyncPush(c *gin.Context) {
    userID := c.GetString("userId")
    var req SyncPushRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    conflicts := []SyncRecord{}
    for _, record := range req.Records {
        // Check if record exists on server
        var existing db.SyncTracking
        result := db.DB.Where("table_name = ? AND record_id = ? AND user_id = ?",
            record.TableName, record.RecordID, userID).First(&existing)

        if result.Error == nil {
            // Record exists → compare timestamps (last-write-wins)
            if !existing.UpdatedAt.Before(record.UpdatedAt) {
                // Server has newer or equal version → conflict
                fullRecord := fetchFullRecord(record.TableName, record.RecordID, userID)
                conflicts = append(conflicts, SyncRecord{
                    TableName: record.TableName,
                    RecordID:  record.RecordID,
                    Data:      fullRecord,
                    UpdatedAt: existing.UpdatedAt,
                    DeviceID:  existing.DeviceID,
                    IsDeleted: existing.IsDeleted,
                })
                continue
            }
        }

        // Upsert the record (INSERT or UPDATE)
        upsertRecord(userID, record)
    }

    // Update sync state for this device
    var syncState db.SyncState
    db.DB.Where("user_id = ? AND device_id = ?", userID, req.DeviceID).First(&syncState)
    syncState.UserID = userID
    syncState.DeviceID = req.DeviceID
    syncState.LastSyncAt = time.Now()
    db.DB.Save(&syncState)

    c.JSON(http.StatusOK, gin.H{
        "status":    "ok",
        "accepted":  len(req.Records) - len(conflicts),
        "conflicts": conflicts,
    })
}

// GET /api/sync/pull?since=<timestamp>&deviceId=<id>
// Returns all records updated since given timestamp for the authenticated user.
func SyncPull(c *gin.Context) {
    userID := c.GetString("userId")
    since := c.Query("since")
    deviceID := c.Query("deviceId")

    sinceTime, err := time.Parse(time.RFC3339, since)
    if err != nil {
        sinceTime = time.Now().Add(-24 * time.Hour) // default: last 24h
    }

    records := []SyncRecord{}
    var tracking []db.SyncTracking
    db.DB.Where("user_id = ? AND updated_at > ?", userID, sinceTime).Find(&tracking)

    for _, t := range tracking {
        fullData := fetchFullRecord(t.TableName, t.RecordID, userID)
        records = append(records, SyncRecord{
            TableName: t.TableName,
            RecordID:  t.RecordID,
            Data:      fullData,
            UpdatedAt: t.UpdatedAt,
            DeviceID:  t.DeviceID,
            IsDeleted: t.IsDeleted,
        })
    }

    c.JSON(http.StatusOK, SyncPullResponse{
        Records:   records,
        SyncToken: time.Now().Format(time.RFC3339),
        HasMore:   false,
    })
}

// GET /api/sync/full
// Returns ALL records for the user (used for first-time migration from server to local DB).
func SyncFull(c *gin.Context) {
    userID := c.GetString("userId")
    records := []SyncRecord{}

    type tableDef struct {
        Name  string
        Model interface{}
    }

    tables := []tableDef{
        {"hosts", &[]db.Host{}},
        {"groups", &[]db.Group{}},
        {"vaults", &[]db.Vault{}},
        {"keychain", &[]db.Key{}},
        {"snippets", &[]db.Snippet{}},
        {"workspaces", &[]db.Workspace{}},
        {"tab_groups", &[]db.TabGroup{}},
        {"settings", &[]db.Setting{}},
    }

    for _, table := range tables {
        db.DB.Where("user_id = ?", userID).Find(table.Model)
        data, _ := json.Marshal(table.Model)
        // Parse as array of records
        var items []map[string]interface{}
        json.Unmarshal(data, &items)
        for _, item := range items {
            recordID, _ := item["ID"].(string)
            updatedAt, _ := item["UpdatedAt"].(string)
            itemData, _ := json.Marshal(item)
            records = append(records, SyncRecord{
                TableName: table.Name,
                RecordID:  recordID,
                Data:      string(itemData),
                UpdatedAt: parseTime(updatedAt),
                IsDeleted: false,
            })
        }
    }

    c.JSON(http.StatusOK, SyncPullResponse{
        Records:   records,
        SyncToken: time.Now().Format(time.RFC3339),
        HasMore:   false,
    })
}

func parseTime(t string) time.Time {
    parsed, err := time.Parse(time.RFC3339, t)
    if err != nil {
        return time.Now()
    }
    return parsed
}

func upsertRecord(userID string, record SyncRecord) {
    // Parse record.Data JSON into a map
    var data map[string]interface{}
    if err := json.Unmarshal([]byte(record.Data), &data); err != nil {
        return
    }
    data["user_id"] = userID

    // Serialize back for raw SQL or use GORM Save
    // GORM approach: attempt to find existing, update or create
    switch record.TableName {
    case "hosts":
        var host db.Host
        json.Unmarshal([]byte(record.Data), &host)
        host.UserID = userID
        db.DB.Save(&host)
    case "groups":
        var group db.Group
        json.Unmarshal([]byte(record.Data), &group)
        group.UserID = userID
        db.DB.Save(&group)
    // ... handle other tables
    }

    // Update sync_tracking
    var tracking db.SyncTracking
    db.DB.Where("table_name = ? AND record_id = ?", record.TableName, record.RecordID).First(&tracking)
    tracking.TableName = record.TableName
    tracking.RecordID = record.RecordID
    tracking.UserID = userID
    tracking.UpdatedAt = record.UpdatedAt
    tracking.DeviceID = record.DeviceID
    tracking.IsDeleted = record.IsDeleted
    db.DB.Save(&tracking)
}

func fetchFullRecord(tableName, recordID, userID string) string {
    var data interface{}
    switch tableName {
    case "hosts":
        var host db.Host
        db.DB.Where("id = ? AND user_id = ?", recordID, userID).First(&host)
        data = host
    case "groups":
        var group db.Group
        db.DB.Where("id = ? AND user_id = ?", recordID, userID).First(&group)
        data = group
    // ... handle other tables
    default:
        return "{}"
    }
    bytes, _ := json.Marshal(data)
    return string(bytes)
}
```

### Task 4.3 — Add sync routes to main.go [ ]

File: `server/cmd/termvault-server/main.go`

Add:
```go
import (
    "github.com/termvault/termvault/internal/api"
)

// In the route setup, after other route groups:
syncGroup := protected.Group("/sync")
{
    syncGroup.POST("/push", api.SyncPush)
    syncGroup.GET("/pull", api.SyncPull)
    syncGroup.GET("/full", api.SyncFull)
}
```

Also add sync tables to AutoMigrate in `db.go`:
```go
db.DB.AutoMigrate(
    // ... existing models ...
    &db.SyncState{},
    &db.SyncTracking{},
)
```

### Task 4.4 — Create client sync engine [ ]

File: `client/src-tauri/src/sync.rs` (NEW)

Logic:
1. On startup, check if user is logged in
2. If yes, push local changes since `lastSyncAt`
3. Pull remote changes since `lastSyncAt`
4. Apply remote changes (last-write-wins)
5. Run sync periodically (every 5 minutes) and on relevant CRUD operations

```rust
use crate::db;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
struct SyncRecord {
    table_name: String,
    record_id: String,
    data: String,
    updated_at: String,
    device_id: String,
    is_deleted: bool,
}

#[derive(Serialize, Deserialize)]
struct SyncPushRequest {
    records: Vec<SyncRecord>,
    device_id: String,
    last_sync_at: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SyncPullResponse {
    records: Vec<SyncRecord>,
    sync_token: String,
    has_more: bool,
}

#[tauri::command]
pub async fn sync_push(state: State<'_, AppState>) -> Result<i32, String> {
    let device_id = state.device_id.clone();
    let user_id = state.user_id.lock().map_err(|e| e.to_string())?;
    let user_id = user_id.as_ref().ok_or("Not logged in")?.clone();
    drop(user_id);

    // Get all changed records from sync_tracking
    let conn = db::DB.lock().map_err(|e| e.to_string())?;
    let last_sync: Option<String> = conn
        .query_row(
            "SELECT last_sync_at FROM sync_state WHERE device_id = ?1",
            params![device_id],
            |row| row.get::<_, String>(0),
        )
        .ok();

    // Query sync_tracking for records changed since last sync
    let mut stmt = if let Some(ref since) = last_sync {
        conn.prepare(
            "SELECT table_name, record_id, updated_at, device_id, is_deleted FROM sync_tracking
             WHERE updated_at > ?1 AND device_id != ?2"
        ).map_err(|e| e.to_string())?
    } else {
        conn.prepare(
            "SELECT table_name, record_id, updated_at, device_id, is_deleted FROM sync_tracking"
        ).map_err(|e| e.to_string())?
    };

    // Fetch full record data for each changed record
    let mut records = Vec::new();
    // ... iterate and fetch full records from their respective tables ...

    // POST to server /api/sync/push
    let client = reqwest::Client::new();
    let resp = client.post(format!("{}/api/sync/push", get_server_url()))
        .json(&SyncPushRequest {
            records,
            device_id,
            last_sync_at: last_sync,
        })
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Handle conflicts returned by server
    if resp.status().is_success() {
        let result: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let accepted = result["accepted"].as_i64().unwrap_or(0) as i32;
        // Apply conflicts if any (server's version wins for last-write-wins)
        if let Some(conflicts) = result["conflicts"].as_array() {
            for conflict in conflicts {
                apply_remote_record(conflict, &state).await?;
            }
        }
        // Update last_sync_at
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO sync_state (id, device_id, last_sync_at)
             VALUES ('sync_' || ?1, ?1, ?2)",
            params![device_id, now],
        ).map_err(|e| e.to_string())?;

        Ok(accepted)
    } else {
        Err(format!("Sync push failed: {}", resp.status()))
    }
}

#[tauri::command]
pub async fn sync_pull(state: State<'_, AppState>) -> Result<i32, String> {
    let device_id = state.device_id.clone();
    let user_id = state.user_id.lock().map_err(|e| e.to_string())?;
    let user_id = user_id.as_ref().ok_or("Not logged in")?.clone();
    drop(user_id);

    let conn = db::DB.lock().map_err(|e| e.to_string())?;
    let last_sync: String = conn
        .query_row(
            "SELECT last_sync_at FROM sync_state WHERE device_id = ?1",
            params![device_id],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());

    // GET from server /api/sync/pull?since=<last_sync>&deviceId=<id>
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/api/sync/pull", get_server_url()))
        .query(&[("since", &last_sync), ("deviceId", &device_id)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        let result: SyncPullResponse = resp.json().await.map_err(|e| e.to_string())?;
        let count = result.records.len() as i32;

        for record in result.records {
            apply_remote_record(&record, &state).await?;
        }

        // Update last_sync_at
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO sync_state (id, device_id, last_sync_at)
             VALUES ('sync_' || ?1, ?1, ?2)",
            params![device_id, now],
        ).map_err(|e| e.to_string())?;

        Ok(count)
    } else {
        Err(format!("Sync pull failed: {}", resp.status()))
    }
}

#[tauri::command]
pub async fn sync_full(state: State<'_, AppState>) -> Result<String, String> {
    // Push all local changes, then pull all remote changes
    sync_push(state).await?;
    sync_pull(state).await?;
    Ok("synced".to_string())
}

#[tauri::command]
pub fn set_user_id(user_id: String, state: State<'_, AppState>) {
    let mut uid = state.user_id.lock().unwrap();
    *uid = Some(user_id);
}

fn get_server_url() -> String {
    std::env::var("TERMVAULT_SERVER_URL").unwrap_or_else(|_| "http://localhost:8080".to_string())
}

async fn apply_remote_record(record: &serde_json::Value, _state: &State<'_, AppState>) -> Result<(), String> {
    // Parse the record and upsert into local DB
    let table_name = record["tableName"].as_str().ok_or("Missing tableName")?;
    let record_id = record["recordId"].as_str().ok_or("Missing recordId")?;
    let is_deleted = record["isDeleted"].as_bool().unwrap_or(false);

    let conn = db::DB.lock().map_err(|e| e.to_string())?;

    if is_deleted {
        // Delete the record from local DB
        let sql = format!("DELETE FROM {} WHERE id = ?1", table_name);
        conn.execute(&sql, params![record_id]).map_err(|e| e.to_string())?;
    } else if let Some(data) = record["data"].as_str() {
        // Parse JSON data and upsert
        let parsed: serde_json::Value = serde_json::from_str(data).map_err(|e| e.to_string())?;
        // ... upsert logic per table ...
    }

    Ok(())
}
```

### Task 4.5 — Register sync commands in lib.rs [ ]

Add to `invoke_handler`:
- `sync::sync_push`
- `sync::sync_pull`
- `sync::sync_full`
- `sync::set_user_id`

### Task 4.6 — Add sync trigger to CRUD operations [ ]

In `crud.rs`, after each successful write, insert/update `sync_tracking`:

```rust
conn.execute(
    "INSERT OR REPLACE INTO sync_tracking (table_name, record_id, updated_at, device_id, is_deleted)
     VALUES (?1, ?2, ?3, ?4, ?5)",
    params![table_name, id, now, device_id, if_deleted],
).map_err(|e| e.to_string())?;
```

### Task 4.7 — Sync settings in React UI [ ]

File: `client/src/components/settings/SyncSettings.tsx` (NEW)

Simple component:
- Show last sync time
- "Sync Now" button
- Sync status indicator (idle/syncing/error)

```tsx
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export function SyncSettings() {
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle')

  const handleSync = async () => {
    setSyncing(true)
    setStatus('syncing')
    try {
      const result = await invoke('sync_full')
      setStatus('success')
      setLastSync(new Date().toLocaleString())
    } catch (e) {
      setStatus('error')
      console.error('Sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <h3>Sync Settings</h3>
      {lastSync && <p>Last synced: {lastSync}</p>}
      <button onClick={handleSync} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
      {status === 'error' && <p style={{ color: 'red' }}>Sync failed</p>}
      {status === 'success' && <p style={{ color: 'green' }}>Sync complete</p>}
    </div>
  )
}
```

**Verify**: Can edit a host on Device A, sync, see changes on Device B.

---

## Phase 5: Server Cleanup [ ]

**Goal**: Remove all SSH proxy code. Server is sync + CRUD only.

| File | Action |
|------|--------|
| `server/internal/ssh/client.go` | Delete — SSH client, sessions, port forwarding |
| `server/internal/ssh/manager.go` | Delete — Connection pool |
| `server/internal/ssh/sftp.go` | Delete — SFTP operations |
| `server/internal/api/sftp.go` | Delete — SFTP proxy endpoints |
| `server/internal/api/portforward.go` | Delete — Port forwarding proxy |
| `server/internal/api/websocket.go` | Delete — SSH WebSocket proxy + WS sync stub |
| `server/cmd/termvault-server/main.go` | Remove SSH imports, proxy routes, WS routes |

### Task 5.1 — Remove SSH proxy files [ ]

Delete these files:
- `server/internal/ssh/client.go`
- `server/internal/ssh/manager.go`
- `server/internal/ssh/sftp.go`
- `server/internal/api/sftp.go`
- `server/internal/api/portforward.go`
- `server/internal/api/websocket.go`

**Verify**: `go build ./...` still works after removals (need to update imports).

### Task 5.2 — Remove proxy endpoint handlers from main.go [ ]

File: `server/cmd/termvault-server/main.go`

Remove:
- `"github.com/termvault/termvault/internal/ssh"` import
- `ssh.DefaultManager.StartCleanup(5 * time.Minute)` call
- SFTP route group
- Cross-host SFTP route group
- Port forward route group
- Local file route group
- WebSocket routes section — remove `/ws/ssh`, keep or remove `/ws/sync` stub

**Verify**: `go build ./...` succeeds.

### Task 5.3 — Update go.mod [ ]

```bash
cd server
go mod tidy
```

Removes removed dependencies (`github.com/pkg/sftp`, `github.com/gorilla/websocket` if no longer imported).

**Verify**: `go build ./...` succeeds. `go vet ./...` passes.

---

## Phase 6: Mobile Support (Android + iOS) [ ]

**Goal**: Build and run the app on Android and iOS. Depends on Phase 0 (Tauri v2 with `[lib]` section, `lib.rs` with `mobile_entry_point`).

**Files Modified:**

| File | Change |
|------|--------|
| `client/src-tauri/capabilities/default.json` | Add platform-specific permissions |
| `client/src-tauri/capabilities/mobile.json` | **NEW** — Mobile-specific capabilities |
| `client/src-tauri/tauri.conf.json` | Add platform-specific overrides |
| `client/src-tauri/tauri.android.conf.json` | **NEW** — Android config |
| `client/src-tauri/tauri.ios.conf.json` | **NEW** — iOS config |
| `client/src/components/terminal/Terminal.tsx` | Test touch input, virtual keyboard |
| `client/src/components/sftp/FileBrowser.tsx` | Test touch interactions |

### Prerequisites

**Android:**
- Android Studio installed
- `JAVA_HOME` set to Android Studio's JBR
- Android SDK Platform, Platform-Tools, NDK (side by side), Build-Tools, Command-line Tools
- `ANDROID_HOME` and `NDK_HOME` environment variables set
- Rust targets: `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`

**iOS (macOS only):**
- Xcode installed (not just Command Line Tools)
- Rust targets: `rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim`
- CocoaPods installed via Homebrew

### Task 6.1 — Initialize Android support [ ]

```bash
cd client
pnpm tauri android init
```

This creates `src-tauri/gen/android/` with the Android project structure (Gradle, Kotlin, AndroidManifest.xml, etc.).

### Task 6.2 — Initialize iOS support [ ]

```bash
cd client
pnpm tauri ios init
```

This creates `src-tauri/gen/ios/` with the iOS project structure (Xcode project, Swift files, Info.plist, etc.).

### Task 6.3 — Create platform-specific configs [ ]

File: `client/src-tauri/tauri.android.conf.json` (NEW)
```json
{
  "identifier": "com.termvault.app",
  "app": {
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "android": {
      "versionCode": 1
    }
  }
}
```

File: `client/src-tauri/tauri.ios.conf.json` (NEW)
```json
{
  "identifier": "com.termvault.app",
  "app": {
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "iOS": {
      "minimumSystemVersion": "15.0"
    }
  }
}
```

### Task 6.4 — Create mobile capabilities [ ]

File: `client/src-tauri/capabilities/mobile.json` (NEW)
```json
{
  "$schema": "../gen/schemas/mobile-schema.json",
  "identifier": "mobile-default",
  "description": "Capabilities for mobile platforms",
  "windows": ["main"],
  "platforms": ["iOS", "android"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:event:default",
    "fs:default",
    "http:default",
    "updater:default",
    "process:default",
    "shell:allow-open"
  ]
}
```

### Task 6.5 — Mobile UI adaptation [ ]

Test the following on mobile (Android emulator / iOS simulator):
- Terminal.tsx: touch input, virtual keyboard show/hide, pinch zoom
- SFTP/FileBrowser.tsx: touch drag-and-drop (dnd-kit should work), swipe to refresh
- Keychain/KeyList.tsx: long-press context menus
- Snippets/SnippetList.tsx: touch selection
- Sidebar.tsx: bottom tab navigation vs sidebar drawer on small screens
- All modals and dialogs: full-screen on mobile

### Task 6.6 — Mobile-specific dependencies [ ]

If the `ssh2` crate causes issues on mobile (it depends on libssh2 which may need cross-compilation):
- Verify `ssh2` compiles for `aarch64-linux-android` target
- If not, consider using `tauri-plugin-ssh` or linking libssh2 statically for Android NDK / iOS

```bash
# Test cross-compilation early:
cargo build --target aarch64-linux-android  # from client/src-tauri
```

### Task 6.7 — Build verification [ ]

- [ ] `pnpm tauri android dev` — app runs on Android emulator
- [ ] `pnpm tauri android build` — APK/AAB produced
- [ ] (macOS only) `pnpm tauri ios dev` — app runs on iOS simulator
- [ ] (macOS only) `pnpm tauri ios build` — IPA produced
- [ ] Terminal works on mobile (touch input)
- [ ] SFTP file browser works on mobile (touch)
- [ ] Keychain works
- [ ] Snippets work

---

## Phase 7: Polish & Production [ ]

**Goal**: Prepare for production release across all platforms.

**Files Modified:**

| File | Change |
|------|--------|
| `client/src-tauri/tauri.conf.json` | Configure code signing, icons |
| `client/src/components/settings/SyncSettings.tsx` | **NEW** — Sync UI (moved from Phase 4) |
| Various `.github/workflows/` | **NEW** — CI/CD pipelines |

### Task 7.1 — End-to-end testing [ ]

Test full workflow across platforms:
- Connect to SSH host, manage files via SFTP
- Offline → online transition
- Multiple devices syncing same account
- Conflict resolution (same record edited on 2 devices)
- First-time migration (pull all data from server)

### Task 7.2 — CI/CD pipelines [ ]

File: `.github/workflows/build.yml` (NEW)

Configure GitHub Actions for:
- Desktop: Windows (msi/nsis), macOS (dmg), Linux (deb/AppImage)
- Android: APK/AAB
- iOS: IPA (macOS runner only)
- Code signing for all platforms
- Updater artifact generation (`bundle.createUpdaterArtifacts: "v1Compatible"` for existing v1 updater)
- Automated testing with `cargo test` and Playwright/WebDriver

### Task 7.3 — Code signing [ ]

- Windows: Sign with Azure Key Vault or similar (set `TAURI_SIGNING_PRIVATE_KEY`)
- macOS: Sign with Apple Developer certificate
- Android: Sign with upload key
- iOS: Sign with Apple Developer certificate

### Task 7.4 — Performance optimization [ ]

- Startup time measurement (`app.setup()` execution)
- Memory usage profiling (especially SSH session state)
- SQLite query optimization for large datasets
- SSH connection overhead (measure connect latency)

### Task 7.5 — Documentation [ ]

- README.md with setup instructions
- CONTRIBUTING.md
- Architecture docs (update with v2 and mobile)

### Task 7.6 — Security audit [ ]

- Verify encryption at rest (Argon2id + ChaCha20-Poly1305)
- Verify IPC permissions (capabilities not too permissive)
- Verify no sensitive data in logs (passwords, keys)
- Verify CSP is configured appropriately (not `null` in production)

### Task 7.7 — Release [ ]

- Tag v1.0.0
- Build all platforms
- Upload to release channels (GitHub Releases, app stores)
- Test updater flow end-to-end

---

## Summary of All Files Changed

### Files Created (14 new)
- `client/src-tauri/src/lib.rs` — Tauri v2 builder with mobile entry point
- `client/src-tauri/src/db.rs` — SQLite database module
- `client/src-tauri/src/crud.rs` — CRUD commands
- `client/src-tauri/src/sync.rs` — Sync engine
- `client/src-tauri/capabilities/default.json` — v2 capability permissions
- `client/src-tauri/capabilities/mobile.json` — Mobile-specific capabilities
- `client/src-tauri/tauri.android.conf.json` — Android-specific config
- `client/src-tauri/tauri.ios.conf.json` — iOS-specific config
- `client/src-tauri/gen/android/` — Android project (from `tauri android init`)
- `client/src-tauri/gen/ios/` — iOS project (from `tauri ios init`)
- `server/internal/api/sync.go` — Sync push/pull endpoints
- `client/src/components/settings/SyncSettings.tsx` — Sync UI

### Files Modified (25 files)
- `client/src-tauri/Cargo.toml` — Upgrade to tauri v2, add plugin + lib deps
- `client/src-tauri/src/main.rs` — Reduce to `app_lib::run()`
- `client/src-tauri/src/ssh.rs` — Rewrite with real SSH2 + SFTP
- `client/src-tauri/src/vault.rs` — Rewrite with Argon2id + ChaCha20Poly1305
- `client/src-tauri/tauri.conf.json` — Rewrite to v2 format
- `client/src-tauri/build.rs` — Update (minimal change)
- `client/package.json` — Upgrade @tauri-apps/api and cli to v2
- `client/src/lib/localFs.ts` — Migrate to plugin-fs, plugin-dialog
- `client/src/stores/updateStore.ts` — Update `__TAURI__` checks
- `client/src/components/terminal/sessionManager.ts` — Replace WebSocket with invoke
- `client/src/lib/api.ts` — Replace SFTP HTTP calls with invoke
- `client/src/hooks/useSFTP.ts` — Update to new API
- `client/src/stores/hostStore.ts` — Use local DB
- `client/src/stores/vaultStore.ts` — Use local DB
- `client/src/stores/keyStore.ts` — Use local DB
- `client/src/stores/snippetStore.ts` — Use local DB
- `client/src/stores/workspaceStore.ts` — Use local DB
- `client/src/stores/tabGroupStore.ts` — Use local DB
- `client/src/stores/authStore.ts` — Add sync trigger on login
- `client/src/stores/sessionStore.ts` — Use local DB
- `client/src/stores/settingsStore.ts` — Use local DB
- `server/internal/db/models.go` — Add SyncState + SyncTracking models
- `server/internal/db/db.go` — Add new tables to AutoMigrate
- `server/cmd/termvault-server/main.go` — Remove proxy routes, add sync routes
- `server/go.mod` — Updated by go mod tidy

### Files Deleted (6 files)
- `server/internal/ssh/client.go`
- `server/internal/ssh/manager.go`
- `server/internal/ssh/sftp.go`
- `server/internal/api/sftp.go`
- `server/internal/api/portforward.go`
- `server/internal/api/websocket.go`

---

## Execution Order

| Phase | Description | Files Changed | Complexity | Depends On |
|-------|-------------|--------------|------------|------------|
| **Phase 0** | Tauri v1 → v2 Migration | 9 files | Medium | Nothing |
| **Phase 1** | Rust SSH/SFTP Core | 5 files | High (SSH2 integration) | Phase 0 |
| **Phase 2** | Local Database (SQLite) | 12+ files | High (SQLite, CRUD, stores) | Phase 0 |
| **Phase 3** | Local Encryption | 4 files | Medium (crypto) | Phase 2 |
| **Phase 4** | Sync Engine | 8 files | Medium (sync protocol, server) | Phase 2, 3 |
| **Phase 5** | Server Cleanup | 7 files | Low (delete files, update imports) | Phase 4 |
| **Phase 6** | Mobile Support | 6+ files | Medium (Android/iOS init) | Phase 0 |
| **Phase 7** | Polish & Production | 3+ files | Low (testing, CI/CD) | All above |

### Key Dependencies
```
Phase 0 (Tauri v2) ──→ Phase 1 (SSH) ──→ Phase 2 (DB) ──→ Phase 3 (Encryption)
                                       ↓                    ↓
                                  Phase 4 (Sync) ←──────────┘
                                       ↓
                                  Phase 5 (Cleanup)
                                       ↓
Phase 0 also enables ──→ Phase 6 (Mobile) ──→ Phase 7 (Production)
```

### Estimated Effort

| Phase | Files Changed | Complexity | Builds On |
|-------|--------------|------------|-----------|
| Phase 0 | 9 files | Medium | Nothing |
| Phase 1 | 5 files | High (SSH2 integration) | Phase 0 |
| Phase 2 | 12+ files | High (SQLite, CRUD, stores) | Phase 0 |
| Phase 3 | 4 files | Medium (crypto) | Phase 2 |
| Phase 4 | 8 files | Medium (sync protocol, server) | Phase 2, 3 |
| Phase 5 | 7 files | Low (delete files, update imports) | Phase 4 |
| Phase 6 | 6+ files | Medium (Android/iOS) | Phase 0 |
| Phase 7 | 3+ files | Low (testing, CI/CD) | All above |

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework version | Tauri v2 | Required for mobile (Android/iOS) |
| SSH library (Rust) | `ssh2` crate | Already in Cargo.toml, mature, wraps libssh2 |
| Terminal I/O | Tauri events (`app.emit()`) | Async, non-blocking, built-in Tauri mechanism |
| SFTP large uploads | Rust-side streaming with progress events | Avoid loading entire file into memory |
| Local DB | `rusqlite` (bundled) | Full control, encryption integration |
| Sync protocol | Full-state push/pull with timestamps | Simpler than delta sync, fine for config data |
| Conflict resolution | Last-write-wins (compare `updated_at`) | Simple, user chose this |
| Encryption algorithm | ChaCha20-Poly1305 via `chacha20poly1305` crate | Matches Termius, NIST recommended |
| Key derivation | Argon2id (OPSLIMIT_INTERACTIVE) | Matches Termius, OWASP recommended |
| Server DB | Keep SQLite/PostgreSQL via GORM | Already works, no need to change |
| Device ID | `uuid::Uuid::new_v4()` stored in local file | Persistent across app restarts |
| Web UI | Removed | Everything moved to native app |
| JS invoke import | `@tauri-apps/api/core` (v2) | Replaces `@tauri-apps/api/tauri` (v1) |
| JS event import | `@tauri-apps/api/event` | Unchanged from v1 |
| JS fs import | `@tauri-apps/plugin-fs` (v2) | Replaces `@tauri-apps/api/fs` (v1) |
| JS dialog import | `@tauri-apps/plugin-dialog` (v2) | Replaces `@tauri-apps/api/dialog` (v1) |
| Windows origin scheme | `http://tauri.localhost` (v2 default) | `useHttpsScheme: true` if IndexedDB persistence needed |

---

## Appendix: Cross-Host SFTP Copy

For `sftp_cross_copy(src_session_id, src_path, dst_session_id, dst_path)`:

```rust
#[tauri::command]
pub fn sftp_cross_copy(
    src_session_id: String,
    src_path: String,
    dst_session_id: String,
    dst_path: String,
    state: State<'_, SSHState>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let src_session = sessions.get(&src_session_id).ok_or("Source session not found")?;
    let dst_session = sessions.get(&dst_session_id).ok_or("Destination session not found")?;

    // Open source file for reading
    let src_sftp = src_session.session.as_ref().unwrap().sftp().map_err(|e| e.to_string())?;
    let mut src_file = src_sftp.open(&src_path).map_err(|e| e.to_string())?;

    // Open destination file for writing
    let dst_sftp = dst_session.session.as_ref().unwrap().sftp().map_err(|e| e.to_string())?;
    let mut dst_file = dst_sftp.create(&dst_path).map_err(|e| e.to_string())?;

    // Stream data
    let mut buffer = [0u8; 65536]; // 64KB chunks
    loop {
        let n = src_file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        dst_file.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

For cross-host MOVE, do copy then delete source.

---

## Appendix: Tauri Command Registration (lib.rs final state)

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            device_id: get_or_create_device_id(),
            user_id: Mutex::new(None),
            encryption_key: Mutex::new(None),
        })
        .manage(SSHState {
            sessions: Mutex::new(HashMap::new()),
        })
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().unwrap();
            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("termvault.db");
            db::init(db_path.to_str().unwrap()).expect("Failed to init DB");
            let window = app.get_webview_window("main").unwrap();
            window.set_title("TermVault")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // SSH commands
            ssh::connect,
            ssh::disconnect,
            ssh::send_input,
            ssh::resize,
            // SFTP commands
            ssh::sftp_list,
            ssh::sftp_read,
            ssh::sftp_write,
            ssh::sftp_delete,
            ssh::sftp_mkdir,
            ssh::sftp_rename,
            ssh::sftp_chmod,
            ssh::sftp_cross_copy,
            // Vault/Crypto commands
            vault::derive_key,
            vault::encrypt,
            vault::decrypt,
            vault::generate_salt,
            // DB CRUD commands
            crud::create_host,
            crud::get_host,
            crud::list_hosts,
            crud::update_host,
            crud::delete_host,
            // ... all other CRUD commands
            // Sync commands
            sync::sync_push,
            sync::sync_pull,
            sync::sync_full,
            sync::set_user_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TermVault");
}
```

Note: Commands defined directly in `lib.rs` (like `greet`) cannot be `pub`. Commands in separate modules (like `ssh::connect`, `crud::create_host`) must be `pub`. Both use the same registration pattern in `generate_handler!`.

---

## Appendix: Verification Checklist

After each phase, run these commands and confirm no errors:

### Phase 0 — Tauri v2 Migration
- [ ] `cd client/src-tauri && cargo build` succeeds
- [ ] `cd client && npx tsc --noEmit` passes
- [ ] `pnpm tauri dev` launches without errors
- [ ] App window appears with correct title "TermVault"
- [ ] File system operations work (localFs.ts)
- [ ] Update checker works (updateStore.ts)

### Phase 1 — SSH/SFTP Core
- [ ] `cd client/src-tauri && cargo build` succeeds
- [ ] `cd client && npx tsc --noEmit` passes
- [ ] `pnpm tauri dev` starts without errors
- [ ] Can connect to SSH host
- [ ] Terminal output displays in xterm.js
- [ ] Can list files via SFTP
- [ ] Can upload/download files via SFTP
- [ ] Cross-host copy works

### Phase 2 — Local Database
- [ ] `cargo build` succeeds
- [ ] SQLite file created at app data directory
- [ ] All 13 tables created
- [ ] Can create host in UI → persists in SQLite
- [ ] Can edit host → persists
- [ ] Can delete host → removed
- [ ] All CRUD operations work offline

### Phase 3 — Local Encryption
- [ ] `cargo build` succeeds
- [ ] Master password flow works
- [ ] Can encrypt/decrypt round-trip
- [ ] SQLite file shows encrypted data (not plaintext)
- [ ] App reads data correctly after restart

### Phase 4 — Sync Engine
- [ ] `go build ./...` succeeds
- [ ] Server sync endpoints respond
- [ ] Can push local data to server
- [ ] Can pull data from server
- [ ] Sync works across 2+ devices
- [ ] Conflicts resolved by last-write-wins

### Phase 5 — Server Cleanup
- [ ] `go build ./...` succeeds
- [ ] No SSH proxy files remain
- [ ] All CRUD endpoints still work
- [ ] Sync endpoints still work

### Phase 6 — Mobile Support
- [ ] Android build succeeds (`tauri android build`)
- [ ] iOS build succeeds (macOS only, `tauri ios build`)
- [ ] Terminal works on mobile (touch input)
- [ ] SFTP works on mobile (touch)

### Phase 7 — Production
- [ ] CI/CD pipeline passes
- [ ] Code signing configured for all platforms
- [ ] Release builds produced for all platforms
- [ ] Updater flow works end-to-end
