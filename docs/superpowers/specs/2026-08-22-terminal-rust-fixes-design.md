# Terminal Rust Fixes — Design Spec

**Date:** 2026-08-22
**Scope:** Three Rust/backend fixes in the SSH/terminal module
**Batch:** 1 of 2 (Rust fixes)

---

## Issue 1: SSH PTY Initial Size

**Problem:** SSH PTY is always opened with hardcoded 80×24 (`ssh.rs:635`), while xterm.js fills its actual container (often 120+ columns). The remote shell has wrong dimensions until the first resize event.

**Root cause:** `connect_saved` and `connect` Tauri commands don't accept `cols`/`rows` parameters. The JS side reads `xterm.cols`/`xterm.rows` but never sends them for SSH (only `connect_local` does).

**Fix:**
- `ssh.rs`: Add `cols: u32, rows: u32` to `connect_saved` and `connect` command signatures, pass to `request_pty`
- `sessionManager.ts`: Send `xterm.cols` and `xterm.rows` in both `connect` and `connect_saved` invocations

---

## Issue 5: Consolidate LocalSessions Mutex Maps

**Problem:** `LocalSessions` (`lib.rs:629`) uses 5 separate `Mutex<HashMap>` all keyed on the same `session_id`. Requires 5 lock acquisitions per connect/disconnect. Non-atomic, fragile, error-prone.

**Fix:** Replace with a single `Mutex<HashMap<String, PtySession>>`:

```rust
struct PtySession {
    pair: PtyPair,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    reader: Arc<Mutex<Box<dyn Read + Send>>>,
    child: Arc<Mutex<Box<dyn PtyChild + Send>>>,
    killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
}

pub struct LocalSessions {
    pub sessions: Mutex<HashMap<String, PtySession>>,
}
```

All operations (`connect_local`, `disconnect_local`, `send_input_local`, `resize_local`) acquire one lock and look up the session struct.

---

## Issue 6: SSH Write Errors → Disconnect

**Problem:** `ssh.rs:655-658` uses `let _ =` to discard write errors from `data_bytes()` and `window_change()`. Keystrokes silently dropped on dead connections. No disconnect propagation.

**Fix:** On write error in the SSH writer loop:
1. Emit `"disconnected"` event to frontend
2. Break out of writer loop
3. Send close signal to trigger read loop cleanup
4. Session removed from map (same as normal disconnect path)

---

## Files Touched

| File | Issues |
|------|--------|
| `client/src-tauri/src/ssh.rs` | 1, 6 |
| `client/src-tauri/src/lib.rs` | 5 |
| `client/src/lib/terminal/sessionManager.ts` | 1 |

## Verification

- `cd server && go vet ./... && go test ./...`
- Manual: connect to SSH host, verify terminal fills container correctly (not 80×24)
- Manual: disconnect network briefly, verify "Connection closed" appears (not silent input loss)
