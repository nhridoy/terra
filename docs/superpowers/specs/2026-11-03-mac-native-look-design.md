# Mac-native look and feel

## Intent

Terra works, but it looks like a web page in a window: big web-sized buttons, a pointer cursor on everything, a 288px web sidebar, web-style modals, Windows-style window buttons even on a Mac, and no menu bar. This pass makes it look and feel like a Mac app on every platform, by retuning the existing Tailwind + shadcn-style components and the window shell. It is a reskin, not a rebuild: component names, variants, and props stay the same, so call sites don't change.

## Decisions made by the owner

- **Mac look on all platforms** (Windows, Linux, macOS).
- **Window buttons:** macOS gets **drawn** traffic lights (HTML, not the native ones). Windows and Linux keep today's minimize/maximize/close buttons on the right, unchanged.
- **No translucency.** Solid theme colors everywhere; no vibrancy or blur.
- **Native menu bar on macOS only.** Windows/Linux get no menu bar.
- **Dialogs stay centered**, restyled as Mac panels. No sliding sheets.
- **Account and Settings stay in the sidebar footer**, restyled compact.
- **Mac-native shape:** the header becomes a unified Mac toolbar and the sidebar a Mac source list.
- **Components:** keep the API of everything in `client/src/components/ui/`, tune the values inside (sizes, radius, focus ring, cursor, colors-by-token).

## Goals

1. Every interactive control reads as a Mac control: 13px system text, Mac heights, 6px radius, soft accent focus ring, default arrow cursor, a hover state.
2. The window shell (toolbar, sidebar, traffic lights, dialogs, context menus, scrollbars) reads as a Mac window.
3. On macOS, the app-wide commands that work today (Settings, New Tab, Quick Connect, Close Tab) are in the menu bar with standard shortcuts, and Edit-menu copy/paste keeps working in inputs.
4. Every built-in theme still looks right. All colors come from `--color-dark-*`, `--color-primary-*`, `--color-danger-*` tokens (themes rewrite those in `stores/themeStore.ts`).

## Non-goals

Translucency/vibrancy, sliding sheets, native traffic lights, a separate Settings window, menu bar on Windows/Linux, changes to the terminal (xterm) or code editor fonts and sizes, new themes, light/dark system-appearance following, splash window changes.

## Anti-goals (a failure even if it "works")

- Any theme looks broken because a color was hard-coded.
- Keyboard-only use gets worse: lost focus rings, unreachable controls, broken Tab order.
- A clickable target below 20×20px (`accessibility.md`: desktop minimum 20×20 pt, default 28×28 pt).
- Windows/Linux users get Mac traffic lights or lose their window buttons.
- A shortcut fires twice (menu accelerator + existing JS handler).

## Design

### 1. Type and global CSS (`client/src/index.css`)

- Override Tailwind's `--text-sm` to 13px (Mac body size) in `@theme`. `text-xs` stays 12px. This is the one global type change; it makes every `text-sm` in the app Mac-sized without touching call sites. *(Builder's call — revert to per-component `text-[13px]` if any layout breaks badly.)*
- Body font stack already starts with `-apple-system` / `BlinkMacSystemFont`; put `"Segoe UI Variable"` before `"Segoe UI"` for Windows. Base body size 13px.
- App chrome is not text-selectable: `user-select: none` on the toolbar, sidebar, buttons, menus, tabs. Inputs, textareas, terminal, editor, and content text (descriptions, host details) stay selectable.
- `--color-dark-600` is not rewritten by themes (`CSS_VAR_MAP` in `themeStore.ts` skips it), so it stays fixed slate in light themes. Define it in `index.css` as `color-mix(in oklab, var(--color-dark-500), var(--color-dark-700))` so it follows every theme *(my call; no `themeStore` change)*.
- Scrollbars become Mac-like overlay style: 10px gutter, transparent track, rounded thumb using `--color-dark-600` (hover `--color-dark-500`) with a 2px transparent border so it looks 6px wide. Replaces today's hard-coded `#1e293b` / `#475569` hex values, which ignore themes.
- Reduced motion: wrap the transition durations added in this pass so `prefers-reduced-motion: reduce` disables them.

### 2. Components (`client/src/components/ui/`), same API, Mac values

| Component | Change |
| --- | --- |
| `Button.tsx` | Base: `rounded-md` (6px), `cursor-default`, `font-medium`, `select-none`. Focus: `focus-visible:ring-[3px] ring-primary-500/50`, no ring offset. Sizes: `default` h-7 (28px) px-3, `sm` h-6 (24px) px-2.5 text-xs, `lg` h-8 (32px) px-4, `icon` h-7 w-7, `icon-sm` h-6 w-6, `icon-xs` h-5 w-5 (20px, the floor). Variants keep their names and token colors; `default` gets a subtle top highlight/shadow like a Mac push button. |
| `Input.tsx`, `Textarea.tsx`, `Select.tsx`, form wrappers in `ui/forms/` | h-7 for single-line, px-2, `rounded-md`, 1px `border-dark-700`, background `dark-900`, focus `ring-[3px] ring-primary-500/50` plus `border-primary-500`. Labels 13px medium, help/error text 12px. |
| `Checkbox.tsx`, `Slider.tsx` | 14px checkbox with 4px radius, accent fill when checked; slider 4px track, 16px thumb with shadow. |
| `ContextMenu.tsx` | Mac menu: 6px radius, 5px padding, 22px rows, 13px text, full-row `primary-600` highlight with white text, 1px separators inset 8px, shadow-xl. Shortcuts right-aligned in `dark-400`. |
| `Modal.tsx`, `ConfirmDialog.tsx`, `ConfirmDeleteDialog.tsx`, `PromptDialog.tsx` | Centered panel, 10px radius, 1px `border-dark-700/60`, Mac shadow, lighter backdrop (`black/30`). Header 44px with 13px semibold title; the `×` text button becomes a 20px icon button. Body padding 20px. Footer actions right-aligned, Cancel immediately left of the primary, primary is `default` variant. Existing Return/Esc/focus-trap behavior is kept. Call sites whose footer buttons are full-width or left-aligned get a className-only fix. |
| `Badge.tsx`, `StatusDot.tsx`, `Alert.tsx`, `Spinner.tsx`, `EmptyState*`, `PaneHeader.tsx`, `SectionHeader.tsx` | Size/radius/type only, to the same scale: section headers 11px semibold `dark-500`, pane headers 13px semibold. |

Segmented controls: where the app already has a row of 2–5 mutually exclusive buttons, restyle that row as a Mac segmented control (one rounded-md track in `dark-800`, selected segment `dark-600` with shadow). No new component unless three or more places need it; the plan lists the places.

### 3. Unified toolbar (`layout/shell/Header.tsx`, `TitleBar.tsx`)

The signed-in header is already the title bar. It becomes one **44px** Mac-style unified toolbar (was 40px): background `dark-900`, 1px bottom border `dark-800`, controls vertically centered, empty space drags the window, double-click on empty space toggles maximize (existing behavior).

- Vaults / SFTP / Editor become a **segmented control** (they are mutually exclusive views), followed by the vault selector when Vaults is active.
- Terminal tabs (`layout/tabs/SortableTab.tsx`) look like Mac Terminal/Safari tabs: 28px tall, 6px radius, selected tab `dark-800` with white 13px text, unselected `dark-400`, close `×` (16px, 20px hit area) appears on hover or when selected, `+` new-tab icon button after them. Drag-reorder behavior unchanged.
- Right side: workspace group, sync status, Connected indicator, Settings, using `icon` (28px) buttons with tooltips.
- The auth-route `TitleBar` (36px today) also goes to 44px with the same styling, brand mark centered or left after the traffic lights.
- Every `top-10` / `pt-10` / `h-10` offset tied to the header (in `Layout.tsx`, `AppSidebar.tsx`; grep for others) moves to the new height. Prefer one CSS variable (`--toolbar-height`) over repeating the number.

### 4. Traffic lights (macOS only, `TitleBar.tsx` → `WindowControls`)

When `isMac`, `WindowControls` renders three drawn circles instead of today's icon buttons; on Windows/Linux it renders exactly what it renders today.

- Order left to right: close, minimize, zoom. 12px circles, 8px gap, 12px from the left edge, vertically centered in the toolbar. Each button's hit area is 20×20px (circle centered inside), which meets the desktop minimum.
- Colors (fixed, not themed, matching macOS): close `#FF5F57`, minimize `#FEBC2E`, zoom `#28C840`, each with a 0.5px darker inner border (`#E0443E`, `#DEA123`, `#1AAB29`).
- Glyphs (×, −, and the two-arrow fullscreen glyph) appear on all three when the pointer is over the group or any of them has keyboard focus, drawn in dark ~`#4d0000`-family colors at 8px, as SVG.
- When the window loses focus, all three turn gray (`dark-600` token) until focus returns. Uses the Tauri `onFocusChanged` window event.
- Actions: close → `close()`, minimize → `minimize()`, zoom → toggle **fullscreen** (macOS's green-button default). Needs `core:window:allow-set-fullscreen` and `core:window:allow-is-fullscreen` added to `capabilities/titlebar.json`. *(Builder's call: if fullscreen with an undecorated window misbehaves on macOS, fall back to `toggleMaximize()`.)*
- Accessibility: keep today's `aria-label`s ("Close window", "Minimize window", "Enter full screen" / "Exit full screen") and a visible focus ring.

### 5. Sidebar (`layout/shell/AppSidebar.tsx`)

Mac source list, all platforms:

- Width 224px (was 288px). Background `dark-900`, right border `dark-800`.
- Rows 28px, 8px horizontal padding inside an 8px-inset list, 6px radius, 16px icons in `primary-400`, 13px label. Selected row: `primary-600/20` background, white text. Hover: `dark-800`. Selection must not rely on color alone: selected row also gets `aria-current="page"` and font-semibold.
- Small section header above the list ("Vault", 11px semibold `dark-500`).
- Footer, compact: Settings as a normal 28px source-list row; then one row with a 24px avatar, name (13px) and email (11px, `dark-400`), and a 20px ghost **Log Out** icon button with tooltip and aria-label. The red full-width Logout button goes away. Logout behavior unchanged (no confirmation added in this pass).
- Mobile/narrow overlay behavior (`isMobile`) unchanged apart from widths.

### 6. Menu bar (macOS only, `client/src-tauri/src/lib.rs`)

Built in Rust in the Tauri `setup` hook under `#[cfg(target_os = "macos")]`, replacing Tauri's default macOS menu.

- **Terra:** About Terra, Settings… (⌘,), Services, Hide Terra (⌘H), Hide Others (⌥⌘H), Show All, Quit Terra (⌘Q). All predefined items except Settings.
- **File / View:** see the scope decision below.
- **Edit:** predefined Undo, Redo, Cut, Copy, Paste, Select All. These must stay predefined so copy/paste keeps working in inputs; without an Edit menu, ⌘C/⌘V stop working in macOS webviews.
- **Window:** predefined Minimize (⌘M), Zoom, Bring All to Front.
- **Help:** Terra on GitHub (opens the repo URL via the existing opener).

**Owner's scope decision: the menu holds only commands that work today.** The shortcut hook (`hooks/useKeyboardShortcuts.ts`) is mounted only in `TerminalView`, and its Save Workspace and Toggle Sidebar handlers are stubs. So the menu leaves out Save Workspace, Toggle Sidebar, Split, and Next/Previous Tab in this pass, and the File and View menus above shrink to:

- **File:** New Tab (⌘T), Quick Connect… (⌘K), Close Tab (⌘W).
- **View:** Enter Full Screen (predefined) only.

Behavior of each custom item, from **any** view:

| Item | Action |
| --- | --- |
| Settings… (⌘,) | Opens the existing Settings modal (same as the toolbar gear). |
| New Tab (⌘T) | Same as the toolbar `+`: `addEmptyTab()`, make it active, navigate to `/terminal`. |
| Quick Connect… (⌘K) | Opens the existing Quick Connect panel. |
| Close Tab (⌘W) | **Owner's decision: pane, then tab.** In the terminal view, close the focused pane; if it is the tab's last pane, close the tab and route exactly as the toolbar `×` does (to the last remaining tab, or `/hosts`). Outside the terminal view, do nothing *(my call: never close the window by accident)*. This also changes the existing ⌘W/Ctrl+W hook handler on all platforms to the same pane-then-tab behavior so the two paths agree. |

Wiring: custom items emit one Tauri event (`menu-action` with the item id). Both feed `listenAppActions` (`src/lib/window/menuActions.ts`). `Layout.tsx` handles Settings, New Tab and Close Tab in one table. Quick Connect subscribes to its own `quick-connect` id, because its open state lives in that component; lifting the state into Layout would only add plumbing. To avoid double firing, on macOS the JS shortcut handlers skip the keys the menu owns (⌘T, ⌘W, ⌘K, ⌘,), and the menu is the only path for them.

**Owner's decision on conflicts: the active view wins.** The predefined Edit items (Copy, Paste, Cut, Select All, Undo, Redo) must keep the SFTP file shortcuts working: in SFTP, ⌘C/⌘X/⌘V/⌘A act on files unless a text field has focus, exactly as today (`hooks/sftp/useFileKeyboardShortcuts.ts`). On macOS, a predefined Edit item may swallow the keydown and send a native `copy`/`paste` to the webview instead. The Mac check must cover this; if SFTP stops receiving them, SFTP listens to the DOM `copy`/`cut`/`paste` events too (or the Edit items become custom items that dispatch to the active view). Editor ⌘S and ⌘B are not in the menu, so they are unaffected.

Known, out of scope: the hook's Mac next/previous-tab binding is ⌘Tab, which macOS reserves for app switching. Fix later along with the full menu.

Disabled state (e.g. Close Tab with no tabs) is a nice-to-have, not required.

### 7. Window

Main window keeps `decorations: false`. On macOS, set `"shadow": true` so the undecorated window keeps a system shadow. Rounded window corners on macOS must be checked on a real Mac; if corners are square and look wrong, the plan may add a `tauri.macos.conf.json` override (builder's call, flag it to the owner first).

## Constraints

- pnpm only; Biome style (single quotes, spaces).
- No new dependencies.
- Only edit `client/` and this spec. `client/` is a submodule.
- Tokens only for themed colors; the only fixed colors are the traffic lights.
- Keep existing tests passing; update `TitleBar.test.tsx` for the new macOS branch.

## Verification

Automated (client): `pnpm vitest`, `pnpm biome check .`, typecheck, `cargo check` in `src-tauri`.

New tests: traffic lights render only when `isMac` and call the right window actions, labels present; non-Mac still renders today's three buttons; menu event id → handler mapping (one table, one test); sidebar selected row has `aria-current`.

Manual: Linux dev run (`pnpm tauri dev`) through hosts, SFTP, editor, terminal tabs, dialogs, context menu, settings, every built-in theme. macOS check (a release/dry-run build on the Mac): menu bar items and shortcuts, copy/paste in inputs, traffic lights including unfocused gray and fullscreen, window corners and shadow. A Linux run alone does not prove macOS behavior.

## Left to the builder

Exact shadows and highlight values; which existing button rows become segmented controls (list them in the plan); order of work; whether a `--toolbar-height` variable or Tailwind utility is used; minor copy.
