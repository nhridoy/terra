# Terminal Frontend Fixes — Design Spec

**Date:** 2026-08-22
**Scope:** Three frontend fixes in the terminal module
**Batch:** 2 of 2 (frontend fixes)

---

## Issue 2: Reconnect Mechanism

**Problem:** When SSH connection drops, user sees "Connection closed" and must manually close/reopen tab. No retry, no button, no feedback.

**Behavior:**
1. On disconnect, enter auto-retry with exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap)
2. Show "Reconnecting..." overlay in the terminal pane (semi-transparent, centered text)
3. After 5 failed attempts, stop auto-retry, show manual "Reconnect" button in overlay
4. On successful reconnect, clear overlay, resume session

**Where it lives:**
- `sessionManager.ts`: Add reconnect state machine (idle → reconnecting → failed) inside `connectSession`. On `"disconnected"` event, instead of just writing a message, enter reconnect loop. Re-invoke `connect_saved`/`connect` with preserved session params.
- `Terminal.tsx`: Render reconnect overlay when pane status is `"reconnecting"` or `"failed"`
- `terminalStore.ts`: Add `"reconnecting"` and `"failed"` to pane connection status enum

**Key detail:** Session params (hostId, hostAddress, hostPort, hostUsername, hostName, tabId, paneId) are already available in the `connectSession` closure. Reconnect reuses them.

**Edge cases:**
- User closes tab during reconnect → abort retry loop (cleanup in effect return)
- User switches away from terminal module → reconnect continues in background (session manager is decoupled from React)
- Network restored mid-retry → success clears overlay

---

## Issue 3: Preset Save Stubs

**Problem:** `computeTabSnapshot`, `saveCurrentPreset`, `saveCurrentWorkspace`, `saveAsNewWorkspace` are empty stubs. UI shows save tooltips but nothing works.

**Implement:**
- `computeTabSnapshot(root: PaneNode)`: Return `JSON.stringify(root)` — serialize the pane tree to JSON
- `saveCurrentPreset`: Serialize current tab's pane tree via `computeTabSnapshot`, persist to tab group store (the existing `useTabGroupStore`)
- `saveCurrentWorkspace`: Serialize all tabs' layouts and titles
- `saveAsNewWorkspace`: Same as saveCurrentWorkspace but creates a new entry

---

## Issue 4: Error Boundaries

**Problem:** Zero error boundaries in the codebase. If xterm.js throws, entire app crashes.

**Create:** `client/src/components/ui/ErrorBoundary.tsx` — class component:
- Catches errors in child components
- Renders fallback UI: icon + error message + "Restart pane" button
- Button destroys and recreates the pane (removes from tree, re-adds)

**Wrap:**
- `<Terminal>` inside `Pane.tsx` (each terminal pane is isolated)
- `<HostBrowser>` inside `HostBrowser.tsx`

---

## Files Touched

| File | Issues |
|------|--------|
| `client/src/lib/terminal/sessionManager.ts` | 2 |
| `client/src/components/terminal/shell/Terminal.tsx` | 2 |
| `client/src/stores/terminal/terminalStore.ts` | 2, 3 |
| `client/src/components/terminal/panes/Pane.tsx` | 4 |
| `client/src/components/terminal/panels/HostBrowser.tsx` | 4 |
| New: `client/src/components/ui/ErrorBoundary.tsx` | 4 |

## Verification

- Disconnect SSH server mid-session → verify auto-reconnect with backoff overlay
- Click "Reconnect" after 5 failures → verify manual retry works
- Save preset from terminal view → verify layout persists
- Trigger xterm.js error → verify error boundary catches it, other panes survive
