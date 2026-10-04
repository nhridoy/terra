# Custom desktop title bar design

## Intent and scope

TermVault's main Tauri window uses native decorations today. Replace them with a compact custom title bar that feels like part of the existing dark application shell while preserving reliable native window behavior. The bar appears on the main window on Windows, Linux, and macOS, including login, recovery, setup, and signed-in routes. The separate splash window stays unchanged.

## Layout

A 36–40px title row sits at the top of the main window. It shows a restrained TermVault mark/name, leaves a generous uninterrupted drag region, and places window controls at the platform-appropriate edge. The current navigation header remains below this row with its tabs and actions unchanged; all fixed offsets and content heights account for the new title row. The title bar matches the app's existing dark colors and border language in every theme rather than inventing a new visual system.

On macOS, position controls in the familiar left-side arrangement; on Windows and Linux, place them on the right. Each control has a clear hover/focus state, tooltip or accessible label, and at least a 36px pointer target. Close gets a danger hover treatment. The maximize button reflects maximized state and restores on the next click. Noninteractive blank space is draggable; buttons and other interactive elements are not. Double-clicking blank title space toggles maximization. The application remains resizable using native window edges.

## Window behavior and permissions

Set `decorations: false` only for the main Tauri window. Use the Tauri v2 window API for minimize, toggle maximize, close, drag, and maximized-state observation. Grant only the needed window capabilities to the main window. Do not couple these controls to auth state, the terminal tab lifecycle, or the splash window. Window API errors must not crash React; show a concise error if an action fails.

## Verification

Automated checks cover the window-action bindings, maximized-state UI, keyboard-accessible labels, and shell spacing across auth and signed-in routes. Build/typecheck and lint run in the client. Manual checks on Windows, Linux, and macOS cover dragging, double-click maximize/restore, all three controls, keyboard focus, resizing, and route transitions. A Linux dev run alone does not establish platform parity.
