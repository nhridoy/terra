# Custom Desktop Title Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native chrome on TermVault's main window with an accessible, draggable custom title bar across Windows, Linux, and macOS.

**Architecture:** The authenticated navigation header doubles as the title bar, while public auth routes use a compact standalone title bar. Both reuse the same window-control and drag components. Tauri retains native window management via its window API and narrowly granted capabilities.

**Tech Stack:** React, TypeScript, Tailwind CSS, Tauri v2, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-custom-desktop-title-bar-design.md`

## Global Constraints

- Work in the current branch; do not create a worktree.
- Leave the separate splash window unchanged.
- Preserve the existing dark design system and navigation behavior.
- Do not commit or push without a new explicit user request.
- Keep interactive controls outside the drag region and show window-action failures.

## Review Focus

- Login and recovery routes still show the title bar and reserve its height.
- Window controls remain keyboard reachable and display meaningful labels.
- Maximized state updates when changed by the operating system, not just by clicking the button.
- Tab drag-and-drop does not accidentally drag the application window.
- Window capabilities permit needed actions without broader grants.

---

### Task 1: Main-window chrome and window-control adapter

**Files:** `client/src-tauri/tauri.conf.json`, `client/src-tauri/capabilities/default.json`, `client/src/lib/window/windowControls.ts`, `client/src/lib/window/windowControls.test.ts`.

**Interfaces:** `windowControls` exposes the current main window's minimize, toggle-maximize, close, drag, and maximized state subscription via Tauri API; callers receive rejected promises on errors.

- [ ] Write a mocked Tauri adapter test for each action and maximized-state subscription; verify it fails before implementation.
- [ ] Set only the main window to `decorations: false`; grant the specific `core:window` permissions needed by the adapter.
- [ ] Implement the adapter and run its test to green.

### Task 2: App-wide title bar

**Files:** `client/src/components/layout/shell/TitleBar.tsx`, `client/src/components/layout/shell/TitleBar.test.tsx`, `client/src/App.tsx`, `client/src/index.css` (only if needed).

**Interfaces:** `<TitleBar />` appears on public auth routes. The signed-in `<Header />` reuses its window-control and drag components. Both use the Task 1 adapter, expose focusable controls with labels, and observe maximized state.

- [ ] Write component tests for accessible controls, action dispatch, double-click maximize, and state change; verify failure.
- [ ] Implement a compact bar matching the existing palette, with macOS-left and Windows/Linux-right control placement, a safe blank drag area, and error toast.
- [ ] Mount standalone chrome on public routes and merge controls into the signed-in header; run component tests to green.

### Task 3: Shell spacing and visual verification

**Files:** `client/src/components/layout/shell/Header.tsx`, `client/src/components/layout/shell/Layout.tsx`, auth page wrappers or shared shell styles that assume `top: 0`.

**Interfaces:** The signed-in sidebar, overlay, and content begin below one 40px header; public auth pages reserve the compact 36px title bar.

- [ ] Add or update a layout test for top offsets on signed-in and auth routes; verify failure.
- [ ] Adjust fixed offsets and content heights without changing tab behavior; ensure crowded tabs scroll without hiding controls.
- [ ] Run `pnpm vitest`, `pnpm biome check .`, and `pnpm build` in `client/`; inspect the resulting app window once if a GUI session is available.
- [ ] Run the Impeccable detector on changed UI files and address actionable findings in one pass.

### Task 4: Manual platform matrix

**Files:** `docs/CUSTOM_TITLE_BAR_MANUAL_VERIFICATION.md`.

**Interfaces:** Reproducible checks for Linux, Windows, macOS, auth routes, drag, double-click, controls, resizing, keyboard focus, and maximized-state updates.

- [ ] Write the matrix with expected behavior and known platform limitations.
- [ ] Verify source diff, `git diff --check`, and clean test/build output; report untested operating systems explicitly.
