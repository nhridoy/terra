# SFTP Module UI Design Spec — "Match TermVault, then polish"

**Date:** 2026-08-18
**Status:** Approved (audit-only phase)
**Scope:** All SFTP file-browser surfaces in `client/src/components/sftp/`.
**Goal:** Bring the SFTP module in line with TermVault's existing app design language, then apply polish within that language. Confirmed direction: *match TermVault app* + full consistency/polish pass.

## 1. Foundation (borrowed from the app's established primitives)

Extracted from `PaneHeader`, `Button`, `Modal`, `ContextMenu`, `FileTransfer`:

- **Surfaces:** pane body `dark-950`; headers/toolbars `dark-900`, active = `dark-800`; borders `dark-800` / `dark-700`; hover `dark-800`.
- **Scale:** headers `h-7` + `px-2`; icon buttons `icon-xs` (h-7 w-7) ghost; body text `text-xs` / `text-sm`; titles `text-xs text-dark-300`.
- **Radius:** buttons / inputs / chips / cards-in-modals `rounded-lg`; content tiles (grid cards) `rounded-2xl`; top-level panels/modals `rounded-xl`.
- **Accent:** sky `primary-500` / `primary-600`; danger `danger-400` / `danger-500` / `soft-destructive`; selection tint `primary-600/15` + left accent bar (list) / ring + dot (grid).
- **Focus:** `ring-2 ring-primary-500 ring-offset-2 ring-offset-dark-900` (matches `Button`).
- **Type:** system sans for UI; `font-mono` (JetBrains Mono) only for paths / sizes / permissions.
- **Motion:** instant color change on hover — **no transitions** (per user preference). Loading shimmer / progress fill animating is acceptable; hover/selection color changes are not.

## 2. Per-element rules

1. **Pane header** — shared `PaneHeader`; already consistent. No change.
2. **Toolbar** — collapse current 2-row `p-3` / `icon` layout to app scale: one compact row, `icon-xs` ghost buttons, `text-xs`, `rounded-lg` search; breadcrumb `text-xs font-mono`.
3. **List rows** — already polished (rounded card-rows, accent bar, tabular-nums). Keep.
4. **Grid cards** — already polished (no float, instant hover color). Keep; align selection styling with list.
5. **Status bar** — keep as `dark-900` `text-xs` strip (`FileBrowserStatusBar` is already correct).
6. **Empty / connect state** — replace plain centered blocks with an app-styled empty tile (`dark-800` rounded, `dark-600` icon, `text-dark-400` copy, primary `sm` button); add a missing remote empty state.
7. **Host picker** — shared `Modal`; tighten row density (`py-3` → `py-2`) to match app; otherwise consistent.
8. **Transfer panel** — `dark-900` surface, `text-xs`, `primary` progress bars, cancel = ghost `hover:text-red-400`. Already correct; keep.
9. **Dialogs** — shared `Modal` + `Button`; inputs `rounded-lg`, danger = `soft-destructive`, consistent spacing. Remove stray `transition-colors` on permission toggles.
10. **Drag/drop overlays + DropZone + pane preview** — crisp indicators: active = `ring-2 ring-primary-500` + light `primary-600/10` fill (not heavy bg), smaller/muted label; pane split preview lighter.

## 3. Interaction polish

- Hover = instant color change; no transition.
- Selection = `primary-600/15` tint + left accent bar (list) / ring + dot (grid) + `text-white` name.
- Loading = status-bar spinner (already) + skeleton rows (add for remote; local already has one).
- Empty = styled tile (see rule 6).
- Focus rings consistent everywhere (`ring-2 ring-primary-500 ring-offset-dark-900`).
