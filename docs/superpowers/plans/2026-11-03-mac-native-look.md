# Mac-native Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Terra look and feel like a Mac app on every platform (Mac type, density, controls, toolbar, sidebar, dialogs), with drawn traffic lights and a native menu bar on macOS only.

**Architecture:** Retune values inside the existing `client/src/components/ui/` components and global CSS (same names, variants, props). Restyle the shell (`layout/shell/*`, `layout/tabs/SortableTab.tsx`). App-wide commands go through one action channel (`lib/window/menuActions.ts`) that both the macOS menu (Tauri event) and in-app shortcuts (DOM event) feed, handled once in `Layout.tsx`.

**Tech Stack:** React 19 + Tailwind v4 (`@theme` in `src/index.css`), Vitest (node env, `renderToStaticMarkup`), Tauri 2.12 (Rust menu API), Biome.

**Spec:** `docs/superpowers/specs/2026-11-03-mac-native-look-design.md` (read it first; it has the exact sizes and the owner's decisions).

## Global Constraints

- All work in `client/` (a git submodule; commit inside `client/`). pnpm only. Biome: run `pnpm biome check --write` on touched files.
- Do not rename or remove any `ui/` component, variant, size, or prop. Only values inside change.
- Themed colors only via `--color-dark-*`, `--color-primary-*`, `--color-danger-*`, `--color-white` tokens. The only fixed hex colors allowed are the traffic lights.
- Minimum clickable target 20×20px; default control height 28px.
- No new dependencies.
- No change to xterm or CodeMirror font/size.
- Windows/Linux window buttons render exactly as today.
- Style-only steps have no unit test; they are verified by `pnpm tsc --noEmit`, `pnpm vitest run`, `pnpm biome check .`, and a look in `pnpm tauri dev`. Logic gets tests.
- Commit messages: conventional (`feat:`, `style:`, `fix:`), **no** Claude co-author / "Generated with" lines (owner's rule). Do not push.
- Verify commands run from `client/`: `pnpm vitest run`, `pnpm tsc --noEmit`, `pnpm biome check .`, and `cargo check --manifest-path src-tauri/Cargo.toml`.

## Review Focus

1. **Light themes** (Light, Ayu Light, Solarized Light): everything added must still have contrast. Task 1 pins `dark-600` to a theme-derived mix. Check every new surface in one light theme during Task 5/6 visual steps.
2. **⌘W with no terminal open / last pane**: must never close the window, must route to `/hosts` when the last tab goes. Tested in Task 7 (`closeActivePane` returns `null`) and handled in Layout.
3. **Double firing on macOS**: ⌘T/⌘W/⌘K must run once. Task 7 tests `isMenuOwnedShortcut`; in-app handlers skip those keys when `isMac`.
4. **Copy/paste in text fields on macOS** after the custom menu replaces Tauri's default: Edit menu must use predefined items. Task 8 checklist item, manual on Mac.
5. **Keyboard focus**: Button focus ring changes from offset ring to a 3px soft ring; traffic lights and sidebar rows must show it. Task 2 test asserts the ring classes; Task 4 test asserts focusable traffic-light buttons with labels.

---

### Task 1: Global CSS (type, tokens, scrollbars, toolbar height)

**Files:**
- Modify: `client/src/index.css` (the `@theme` block at top, `body` rule, `::-webkit-scrollbar*` rules)

**Interfaces:**
- Produces: CSS variable `--toolbar-height: 44px` on `:root`; Tailwind `text-sm` = 13px; `--color-dark-600` follows themes; utility class `.chrome` (= `user-select: none; -webkit-user-select: none; cursor: default;`) for shell containers.

- [ ] **Step 1:** In `@theme`, add `--text-sm: 0.8125rem;` and replace `--color-dark-600: #475569;` with `--color-dark-600: color-mix(in oklab, var(--color-dark-500), var(--color-dark-700));`.
- [ ] **Step 2:** Add `:root { --toolbar-height: 44px; }` and the `.chrome` class. Body: `font-size: 13px;` and insert `"Segoe UI Variable",` before `"Segoe UI"` in the font stack.
- [ ] **Step 3:** Replace the scrollbar rules: width/height 10px; track `transparent`; thumb `var(--color-dark-600)` with `border: 2px solid transparent; background-clip: padding-box; border-radius: 9999px;`; thumb hover `var(--color-dark-500)`.
- [ ] **Step 4:** Add `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }`.
- [ ] **Step 5: Verify.** `pnpm vitest run && pnpm tsc --noEmit && pnpm biome check .` pass. In `pnpm tauri dev`, switch to a light theme in Settings: scrollbar thumb is visible and not slate-blue.
- [ ] **Step 6: Commit** `style: mac type scale, themed dark-600, overlay scrollbars`.

### Task 2: Button and form controls, Mac values

**Files:**
- Modify: `client/src/components/ui/Button.tsx:5-33`, `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Checkbox.tsx`, `Slider.tsx`, `field.tsx`, `input-otp.tsx`, `FileInput.tsx`, `ui/forms/*.tsx` (only class strings)
- Test: `client/src/components/ui/Button.test.ts` (create)

**Interfaces:**
- Produces: unchanged exports. `buttonVariants` sizes now: `default` `h-7 px-3`, `sm` `h-6 px-2.5 text-xs`, `lg` `h-8 px-4`, `icon` `h-7 w-7`, `icon-sm` `h-6 w-6`, `icon-xs` `h-5 w-5`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buttonVariants } from './Button';

describe('buttonVariants (mac values)', () => {
  it('uses mac heights and the arrow cursor', () => {
    expect(buttonVariants()).toContain('h-7');
    expect(buttonVariants()).toContain('cursor-default');
    expect(buttonVariants()).toContain('rounded-md');
    expect(buttonVariants({ size: 'icon-xs' })).toContain('h-5 w-5');
  });
  it('uses a soft 3px focus ring without offset', () => {
    const cls = buttonVariants();
    expect(cls).toContain('focus-visible:ring-[3px]');
    expect(cls).toContain('focus-visible:ring-primary-500/50');
    expect(cls).not.toContain('ring-offset-2');
  });
});
```

- [ ] **Step 2:** `pnpm vitest run src/components/ui/Button.test.ts` → FAIL (`h-7` missing).
- [ ] **Step 3:** Edit `buttonVariants` base to: `inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors rounded-md cursor-default select-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-500/50 disabled:pointer-events-none disabled:opacity-50`; sizes as in Interfaces; `default` variant adds `shadow-sm shadow-black/20`. Keep all variant names and colors.
- [ ] **Step 4:** `pnpm vitest run src/components/ui/Button.test.ts` → PASS.
- [ ] **Step 5:** Form controls (spec §2 table): single-line `Input`/`Select` trigger `h-7 px-2 rounded-md border border-dark-700 bg-dark-900`, focus `focus:ring-[3px] focus:ring-primary-500/50 focus:border-primary-500`; `Textarea` same minus `h-7`, `px-2 py-1.5`; labels in `field.tsx`/`ui/forms` `text-sm font-medium`, help/error `text-xs`; `Checkbox` 14px box `rounded-[4px]`, accent fill when checked; `Slider` 4px track, 16px thumb with `shadow`. `Select` dropdown list uses the ContextMenu row style from Task 3 (22px rows, full-row `primary-600` highlight, white text).
- [ ] **Step 6: Verify.** Full `pnpm vitest run`, `pnpm tsc --noEmit`, `pnpm biome check .`. In `pnpm tauri dev`: login form, Add Host form, Settings. Nothing clipped; Tab key shows the soft ring on every control.
- [ ] **Step 7: Commit** `style: mac-sized buttons and form controls`.

### Task 3: Menus, dialogs, small components

**Files:**
- Modify: `client/src/components/ui/ContextMenu.tsx`, `Modal.tsx:126-153`, `ConfirmDialog.tsx`, `ConfirmDeleteDialog.tsx`, `PromptDialog.tsx`, `Badge.tsx`, `StatusDot.tsx`, `Alert.tsx`, `Spinner.tsx`, `EmptyState.tsx`, `EmptyActionState.tsx`, `PaneHeader.tsx`, `SectionHeader.tsx`
- Modify (className only): `<Modal>` call sites whose footer buttons are full-width or left-aligned (find with `grep -rln "<Modal" src`)
- Test: `client/src/components/ui/Modal.test.tsx` (create)

**Interfaces:**
- Produces: unchanged exports and props. Dialog footer convention for every call site: `<div className="flex justify-end gap-2 pt-4">` with Cancel (`variant="secondary"`) immediately before the primary.

- [ ] **Step 1: Write the failing test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Modal from './Modal';

describe('Modal (mac panel)', () => {
  it('renders a 10px-radius bordered panel with a labeled 20px close button', () => {
    const html = renderToStaticMarkup(
      <Modal title="Add Host" onClose={() => {}}>body</Modal>,
    );
    expect(html).toContain('rounded-[10px]');
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('bg-black/30');
  });
});
```

- [ ] **Step 2:** `pnpm vitest run src/components/ui/Modal.test.tsx` → FAIL.
- [ ] **Step 3:** Modal: overlay `bg-black/30`; panel `rounded-[10px] border border-dark-700/60 shadow-2xl shadow-black/40`; header `h-11 px-4` with `text-sm font-semibold` title; close becomes `<Button size="icon-xs" variant="ghost" aria-label="Close">` with Phosphor `XIcon size={12}`; body `p-5`. Keep all keyboard/focus logic untouched.
- [ ] **Step 4:** `pnpm vitest run src/components/ui/Modal.test.tsx` → PASS.
- [ ] **Step 5:** ConfirmDialog / ConfirmDeleteDialog / PromptDialog footers to the convention above. ContextMenu: container `rounded-md p-[5px] shadow-xl border border-dark-700/60 bg-dark-900`, rows `h-[22px] px-2 rounded-[4px] text-sm`, highlighted row `bg-primary-600 text-white`, separators `my-1 mx-2 h-px bg-dark-700`, shortcut text right-aligned `text-dark-400`. SectionHeader `text-[11px] font-semibold text-dark-500`; PaneHeader title `text-sm font-semibold`. Badge/StatusDot/Alert/Spinner/EmptyState: `rounded-md`, sizes to the same scale, nothing else.
- [ ] **Step 6:** Grep `<Modal` call sites; list in the commit body every file whose footer you changed; className-only edits.
- [ ] **Step 7: Verify.** Full checks. In dev: open Add Host, a delete confirm, a rename prompt, a host right-click menu. Return confirms, Esc cancels, buttons bottom-right.
- [ ] **Step 8: Commit** `style: mac panels, menus and status components`.

### Task 4: Drawn traffic lights (macOS only)

**Files:**
- Modify: `client/src/lib/window/windowControls.ts`, `client/src/components/layout/shell/TitleBar.tsx:16-79`, `client/src-tauri/capabilities/titlebar.json`, `client/src-tauri/tauri.conf.json` (main window)
- Test: `client/src/lib/window/windowControls.test.ts`, `client/src/components/layout/shell/TitleBar.test.tsx`

**Interfaces:**
- Produces in `windowControls`: `toggleFullscreen(): Promise<void>` (reads `isFullscreen()`, calls `setFullscreen(!current)`); `watchFullscreen(onChange: (fullscreen: boolean) => void): Promise<() => void>` (same pattern as `watchMaximized`); `watchFocus(onChange: (focused: boolean) => void): Promise<() => void>` (uses `onFocusChanged`, payload is the boolean).
- Produces in `TitleBar.tsx`: `WindowControls({ mac = isMac }: { mac?: boolean })`. When `mac`, renders `<fieldset data-traffic-lights>` with three `<button>`s; otherwise today's markup unchanged. `isMac` export unchanged.

- [ ] **Step 1: Write the failing tests**

In `windowControls.test.ts` add `isFullscreen`, `setFullscreen`, `onFocusChanged` to `windowMock`, then:

```ts
it('toggles fullscreen from the current state', async () => {
  windowMock.isFullscreen.mockResolvedValueOnce(false);
  await windowControls.toggleFullscreen();
  expect(windowMock.setFullscreen).toHaveBeenCalledWith(true);
});
it('reports focus changes', async () => {
  windowMock.onFocusChanged.mockImplementation(async (h: (e: { payload: boolean }) => void) => {
    h({ payload: false });
    return vi.fn();
  });
  const seen: boolean[] = [];
  await windowControls.watchFocus((f) => seen.push(f));
  expect(seen).toEqual([false]);
});
```

In `TitleBar.test.tsx` (add `toggleFullscreen`, `watchFullscreen`, `watchFocus` to the mock) and import `{ WindowControls }`:

```tsx
it('draws labeled traffic lights on macOS in close, minimize, zoom order', () => {
  const html = renderToStaticMarkup(<WindowControls mac />);
  expect(html).toContain('data-traffic-lights');
  const order = ['Close window', 'Minimize window', 'Enter full screen'].map((l) => html.indexOf(`aria-label="${l}"`));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(html).toContain('#FF5F57');
});
it('keeps the existing buttons elsewhere', () => {
  const html = renderToStaticMarkup(<WindowControls mac={false} />);
  expect(html).not.toContain('data-traffic-lights');
  expect(html).toContain('aria-label="Maximize window"');
});
```

- [ ] **Step 2:** `pnpm vitest run src/lib/window src/components/layout/shell/TitleBar.test.tsx` → FAIL.
- [ ] **Step 3:** Implement the three `windowControls` functions.
- [ ] **Step 4:** Implement the Mac branch of `WindowControls`: each button `h-5 w-5 grid place-items-center` (20px hit area), inner 12px circle with fill + inner 0.5px border: close `#FF5F57`/`#E0443E`, minimize `#FEBC2E`/`#DEA123`, zoom `#28C840`/`#1AAB29`; buttons laid out with `gap-0` so circles sit 8px apart; container `pl-2` (12px to first circle) and `group`. Glyphs are inline SVG 8px (×, −, two diagonal arrows), `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`, stroke `rgba(0,0,0,0.55)`. Window unfocused (from `watchFocus`) and not hovered: circles `bg-dark-600`, no border. Actions: close → `close`, minimize → `minimize`, zoom → `toggleFullscreen`; zoom label from `watchFullscreen`: "Enter full screen" / "Exit full screen". Focus ring `focus-visible:ring-[3px] ring-primary-500/50 rounded-full`. Errors keep the existing `toast.error` path.
- [ ] **Step 5:** `titlebar.json`: add `core:window:allow-set-fullscreen`, `core:window:allow-is-fullscreen`. `tauri.conf.json` main window: add `"shadow": true`.
- [ ] **Step 6:** Tests from Step 2 → PASS; full checks; `cargo check` passes (capability schema validates at build).
- [ ] **Step 7: Commit** `feat: drawn macOS traffic lights with fullscreen zoom`.

### Task 5: Unified 44px toolbar

**Files:**
- Modify: `client/src/components/layout/shell/Header.tsx:70-289`, `TitleBar.tsx` (default export, auth routes), `client/src/components/layout/tabs/SortableTab.tsx`, `client/src/components/layout/shell/Layout.tsx:285-295`, `client/src/components/layout/shell/AppSidebar.tsx:48`, plus any other offset found by `grep -rn "top-10\|pt-10\|top-9\|pt-9" src`

**Interfaces:**
- Consumes: `--toolbar-height` and `.chrome` (Task 1), `WindowControls` (Task 4).
- Produces: header height = `var(--toolbar-height)`; content offsets use `top-[var(--toolbar-height)]` / `pt-[var(--toolbar-height)]`.

- [ ] **Step 1:** Header root: `h-[var(--toolbar-height)] chrome bg-dark-900 border-b border-dark-800 flex items-center gap-1 pl-2 pr-2`. On Mac the traffic lights are followed by `ml-2` spacing before the first control.
- [ ] **Step 2:** Replace the three view buttons (Vaults, SFTP, Editor) with one segmented control inline in Header: wrapper `role="radiogroup" aria-label="View" className="flex h-7 items-center rounded-md bg-dark-800 p-0.5"`; each segment a `<Button size="sm" variant="ghost" role="radio" aria-checked={selected}>` with selected classes `bg-dark-600 text-white shadow-sm` and unselected `text-dark-400`, `h-6 rounded-[5px]`. Same onClick logic as today. VaultSelector stays right after it when Vaults is active.
- [ ] **Step 3:** SortableTab: tab `h-7 rounded-md px-2.5 text-sm`, selected `bg-dark-800 text-white`, unselected `text-dark-400 hover:bg-dark-800/60`; close button `size="icon-xs"` (20px) with 12px icon, visible when `isActive` or on `group-hover`, `aria-label="Close tab"`. Do not touch dnd-kit wiring or context-menu logic. New-tab `+` becomes `size="icon"` with `aria-label="New tab"`.
- [ ] **Step 4:** Right side: all icon buttons `size="icon"` with `aria-label` equal to today's `title`. Remove explicit `rounded` overrides so Button's `rounded-md` applies.
- [ ] **Step 5:** `TitleBar` default export (auth routes): `h-[var(--toolbar-height)] chrome`, brand stays left after the traffic lights. Update every header-offset class to the variable (Layout overlay `top-10`, main `pt-10`, AppSidebar `top-10`, others from grep).
- [ ] **Step 6: Verify.** Full checks. In dev, at 800px and 1400px window widths: tabs scroll horizontally, drag area still drags, double-click empty toolbar maximizes, sidebar and content start exactly under the toolbar on hosts, SFTP, editor, terminal, and login.
- [ ] **Step 7: Commit** `style: unified mac toolbar with segmented view switcher`.

### Task 6: Sidebar as Mac source list

**Files:**
- Modify: `client/src/components/layout/shell/AppSidebar.tsx`, `client/src/components/layout/shell/Layout.tsx` (`lg:ml-72`/`ml-72` → 224px)
- Test: `client/src/components/layout/shell/AppSidebar.test.tsx` (create)

**Interfaces:**
- Produces: unchanged `AppSidebar` props. Width `w-56` (224px); main offset `lg:ml-56` / `ml-56`.

- [ ] **Step 1: Write the failing test** (mock `react-router` `useLocation` → `{ pathname: '/keys' }`, `useNavigate` → `vi.fn()`; mock `@/stores/auth/authStore` `useAuthStore` → `() => ({ user: { full_name: 'Ada', email: 'a@x.io' }, logout: vi.fn() })`):

```tsx
it('marks only the current section and offers a labeled Log Out', () => {
  const html = renderToStaticMarkup(
    <AppSidebar isOpen isMobile={false} onClose={() => {}} onOpenSettings={() => {}} />,
  );
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  expect(html).toMatch(/aria-current="page"[^>]*>[\s\S]*?Keys/);
  expect(html).toContain('aria-label="Log Out"');
  expect(html).toContain('w-56');
});
```

- [ ] **Step 2:** `pnpm vitest run src/components/layout/shell/AppSidebar.test.tsx` → FAIL.
- [ ] **Step 3:** Implement spec §5: `aside` `w-56 chrome`, top offset `top-[var(--toolbar-height)]`; section header "Vault" (`text-[11px] font-semibold text-dark-500 px-2 pt-2 pb-1`); rows `h-7 px-2 rounded-md text-sm gap-2`, 16px icons `text-primary-400`, selected `bg-primary-600/20 text-white font-semibold` + `aria-current="page"`, hover `hover:bg-dark-800`. Footer: Settings as a normal row; then a row with 24px avatar circle (`bg-primary-600/20`, 12px user icon), name `text-sm` and email `text-[11px] text-dark-400` truncated, and a `size="icon-xs" variant="ghost"` button with `SignOutIcon size={14}`, `aria-label="Log Out"`, `title="Log Out"`, `onClick={logout}`. Remove the red Logout button.
- [ ] **Step 4:** Test → PASS. Layout offsets to `ml-56`.
- [ ] **Step 5: Verify.** Full checks; in dev check every sidebar section, keyboard Tab through the rows (ring visible), a light theme, and narrow width (<1024px) overlay still opens/closes.
- [ ] **Step 6: Commit** `style: mac source-list sidebar with compact account footer`.

### Task 7: App action channel and ⌘W pane-then-tab (frontend)

**Files:**
- Create: `client/src/lib/window/menuActions.ts`
- Test: `client/src/lib/window/menuActions.test.ts`, `client/src/stores/terminal/closeActivePane.test.ts`
- Modify: `client/src/stores/terminal/terminalStore.ts` (add method), `client/src/components/layout/shell/Layout.tsx`, `client/src/components/terminal/views/TerminalView.tsx:91-104`, `client/src/hooks/useKeyboardShortcuts.ts:36-53`, `client/src/components/terminal/views/QuickConnect.tsx:45-62`

**Interfaces:**
- Produces in `menuActions.ts`:
  - `export type MenuActionId = 'settings' | 'new-tab' | 'quick-connect' | 'close-tab';`
  - `export const MENU_ACTION_IDS: readonly MenuActionId[]` (that order)
  - `export const MENU_ACTION_EVENT = 'menu-action';` (Tauri event name; payload is the id string)
  - `export function isMenuActionId(value: unknown): value is MenuActionId`
  - `export function dispatchAppAction(id: MenuActionId): void` — `window.dispatchEvent(new CustomEvent('terra:app-action', { detail: id }))`
  - `export function listenAppActions(handler: (id: MenuActionId) => void): () => void` — listens to the DOM event and, when `isTauriAvailable()`, to Tauri `listen(MENU_ACTION_EVENT)`; ignores unknown ids; returns one unsubscribe that tears down both (handle the async Tauri unlisten like `WindowControls` does today).
  - `export function isMenuOwnedShortcut(e: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'key'>, mac: boolean): boolean` — true only when `mac && e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey` and `e.key.toLowerCase()` is one of `t`, `w`, `k`, `,`.
- Produces in `terminalStore`: `closeActivePane: () => string | null` — removes the active tab's active pane via existing `removePane` (which already drops the tab when its last pane closes) and returns the resulting `activeTabId` (`null` when no tabs remain or nothing was active).

- [ ] **Step 1: Write the failing tests**

`menuActions.test.ts`:

```ts
const k = (key: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods }) as KeyboardEvent;

it('claims only ⌘T ⌘W ⌘K ⌘, on mac', () => {
  for (const key of ['t', 'w', 'k', ',', 'K']) expect(isMenuOwnedShortcut(k(key, { metaKey: true }), true)).toBe(true);
  expect(isMenuOwnedShortcut(k('t', { metaKey: true }), false)).toBe(false);
  expect(isMenuOwnedShortcut(k('t', { ctrlKey: true }), true)).toBe(false);
  expect(isMenuOwnedShortcut(k('t', { metaKey: true, shiftKey: true }), true)).toBe(false);
  expect(isMenuOwnedShortcut(k('s', { metaKey: true }), true)).toBe(false);
});
it('validates ids', () => {
  expect(MENU_ACTION_IDS.every(isMenuActionId)).toBe(true);
  expect(isMenuActionId('quit')).toBe(false);
});
it('every frontend id exists in the Rust menu', () => {
  const rust = readFileSync(new URL('../../../src-tauri/src/menu.rs', import.meta.url), 'utf8');
  for (const id of MENU_ACTION_IDS) expect(rust).toContain(`"${id}"`);
});
```

(The last test stays red until Task 8; mark it `it.todo` here and switch to `it` in Task 8.)

`closeActivePane.test.ts` (same `vi.mock` header as `openConnection.test.ts`):

```ts
it('closes the focused pane, then the tab, then returns null', () => {
  const s = useTerminalStore.getState();
  const tabA = s.addEmptyTab();
  const tabB = s.addEmptyTab();
  const tB = useTerminalStore.getState().tabs.find((t) => t.id === tabB)!;
  s.splitPane(tabB, tB.activePaneId!, 'horizontal');
  expect(useTerminalStore.getState().closeActivePane()).toBe(tabB); // one pane left in B
  expect(useTerminalStore.getState().closeActivePane()).toBe(tabA); // B gone
  expect(useTerminalStore.getState().closeActivePane()).toBeNull(); // nothing left
  expect(useTerminalStore.getState().closeActivePane()).toBeNull(); // safe when empty
});
```

- [ ] **Step 2:** Run both test files → FAIL.
- [ ] **Step 3:** Implement `menuActions.ts` and `closeActivePane`.
- [ ] **Step 4:** Tests → PASS (Rust-id test is `todo`).
- [ ] **Step 5:** Layout: `useEffect(() => listenAppActions(handle), [...])` where `handle`:
  - `settings` → `settingsModal.show()`
  - `new-tab` → same as Header `+`: `showTerminalTab(useTerminalStore.getState().addEmptyTab())`
  - `close-tab` → only if `location.pathname === '/terminal'`: `const next = closeActivePane(); next ? showTerminalTab(next) : (setActiveView('vault'), navigate('/hosts'))`
  - `quick-connect` → ignored here (QuickConnect handles it).
- [ ] **Step 6:** QuickConnect: open also on `listenAppActions((id) => id === 'quick-connect' && open())` where `open` is the existing `setIsOpen(true)` + focus; its ⌘K keydown branch returns early when `isMenuOwnedShortcut(e, isMac)` (menu owns it on macOS).
- [ ] **Step 7:** TerminalView: `onNewTab` → `dispatchAppAction('new-tab')`, `onCloseTab` → `dispatchAppAction('close-tab')` (remove the local `handleCloseTab`). `useKeyboardShortcuts`: at the top of `handleKeyDown`, `if (isMenuOwnedShortcut(e, isMac)) return;` using `isMac` from `TitleBar.tsx`.
- [ ] **Step 8: Verify.** Full checks. In dev on Linux: Ctrl+T from the terminal opens a tab and the toolbar highlights it; Ctrl+W in a split closes one pane, then the tab, and after the last tab you land on Hosts; Ctrl+K still opens Quick Connect; toolbar `×` behavior unchanged.
- [ ] **Step 9: Commit** `feat: single app-action channel; ⌘W closes pane then tab`.

### Task 8: macOS menu bar (Rust)

**Files:**
- Create: `client/src-tauri/src/menu.rs`
- Modify: `client/src-tauri/src/lib.rs` (`mod menu;` and the `setup` hook at ~line 1586), `client/src/lib/window/menuActions.test.ts` (turn the `todo` into `it`)

**Interfaces:**
- Consumes: ids from Task 7 (`settings`, `new-tab`, `quick-connect`, `close-tab`), event name `menu-action`.
- Produces: `#[cfg(target_os = "macos")] pub fn install(app: &tauri::App) -> tauri::Result<()>` in `menu.rs`, which builds and sets the menu and registers `app.on_menu_event`.

- [ ] **Step 1:** `menu.rs`: build with `MenuBuilder` / `SubmenuBuilder` (Tauri 2.12):
  - **Terra:** `about` (title "About Terra"), separator, `MenuItemBuilder::with_id("settings", "Settings…").accelerator("Cmd+,")`, separator, `services`, separator, `hide`, `hide_others`, `show_all`, separator, `quit`.
  - **File:** `new-tab` "New Tab" `Cmd+T`; `quick-connect` "Quick Connect…" `Cmd+K`; separator; `close-tab` "Close Tab" `Cmd+W`.
  - **Edit:** predefined `undo`, `redo`, separator, `cut`, `copy`, `paste`, `select_all`.
  - **View:** predefined `fullscreen`.
  - **Window:** predefined `minimize`, `maximize` (shows as Zoom); add `bring_all_to_front` only if the Tauri 2.12 builder exposes it, else skip.
  - **Help:** `help-github` "Terra on GitHub".
  - Event handler: for ids in `["settings","new-tab","quick-connect","close-tab"]` → `app.emit("menu-action", id)`; `help-github` → `app.opener().open_url("https://github.com/nhridoy/terra", None::<&str>)` (`tauri_plugin_opener::OpenerExt`).
- [ ] **Step 2:** `lib.rs` setup: `#[cfg(target_os = "macos")] menu::install(app)?;` after the window lookup. Declare `mod menu;` near the other `mod` lines.
- [ ] **Step 3:** In `menuActions.test.ts` change the Rust-id `it.todo` to `it`; run → PASS.
- [ ] **Step 4: Verify.** `cargo check` on Linux (the module compiles out; confirm no unused-import warnings in `lib.rs`), full JS checks. If a Mac is available, or via the CI dry-run release build installed on a Mac, walk this checklist and report results to the owner:
  - menu bar shows Terra / File / Edit / View / Window / Help
  - ⌘, opens Settings; ⌘T, ⌘K, ⌘W each act **once** from Hosts, SFTP, Editor, Terminal (⌘W does nothing outside Terminal)
  - ⌘C/⌘V/⌘A/⌘Z work in a text field (host form, Quick Connect)
  - SFTP: ⌘C/⌘V on files still work; if not, apply the spec §6 fallback (SFTP listens to DOM `copy`/`cut`/`paste`) and re-check
  - Editor ⌘S still saves the file; ⌘B still toggles its file sidebar
  - traffic lights: hover glyphs, gray when another app is focused, green enters/exits full screen
  - window has a shadow; note whether corners are rounded (if square, tell the owner; do not change window config without them)
- [ ] **Step 5: Commit** `feat: native macOS menu bar`.

### Task 9: Final pass

- [ ] **Step 1:** `pnpm vitest run && pnpm tsc --noEmit && pnpm biome check . && cargo check --manifest-path src-tauri/Cargo.toml` all pass.
- [ ] **Step 2:** In `pnpm tauri dev`, cycle through at least one dark and one light theme across Hosts, SFTP, Editor, Terminal, Settings, Login. Note anything with poor contrast and fix with tokens.
- [ ] **Step 3:** Run `graphify update .` from the repo root if `graphify-out/` exists.
- [ ] **Step 4:** Report to the owner: what changed, what was verified on Linux, what still needs the Mac checklist. Do not bump the submodule pointer or push without the owner asking.
