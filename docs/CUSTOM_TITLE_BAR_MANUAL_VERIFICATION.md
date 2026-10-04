# Custom title bar manual checks

Run these checks in a packaged or `pnpm tauri dev` build on Windows, Linux, and macOS. The splash window should remain unchanged. Record OS, desktop environment, app build, and result for each platform.

1. Open the app at login. Confirm the TermVault title row is above the login form and that no native title bar remains. Repeat on registration, recovery, and setup routes.
2. Sign in. Confirm the navigation tabs are immediately below the title row; no controls or terminal content are covered. Switch between Hosts, Terminal, SFTP, Editor, and Settings.
3. Drag from blank title-row space. The window moves. Drag a terminal tab: only the tab moves. Clicking a window control never drags the window.
4. Double-click blank title-row space. The window maximizes, then restores on the next double-click. The maximize control changes its accessible label to “Restore window” while maximized. Check the same state change after using the OS window shortcut.
5. Click minimize, restore from the dock/taskbar, click maximize/restore, then close. Each action succeeds. On macOS, controls are on the left; on Windows/Linux, they are on the right.
6. Use Tab/Shift+Tab to reach the drag area and all three window controls. Focus is visible; Enter on the drag area and keyboard activation on controls work. Screen reader names include each action.
7. Resize the window from all edges/corners at normal and minimum size. Confirm the title bar, header, and controls remain reachable and the app content fits.
8. Force or simulate a window API failure if feasible. Confirm an error toast appears and the React UI remains usable.
