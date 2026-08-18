### Task 12: Final testing and cleanup

- [ ] **Step 1: Run full test suite**

Run: `cd client && pnpm vitest run`
Expected: All 141+ tests pass

- [ ] **Step 2: Run Rust tests**

Run: `cd client/src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 3: Manual testing checklist**

- [ ] Connect to saved host via SFTP
- [ ] Connect to direct host via SFTP
- [ ] List files in root directory
- [ ] Navigate into subdirectory
- [ ] Upload a file (check progress)
- [ ] Download a file (check progress)
- [ ] Create new directory
- [ ] Rename a file
- [ ] Delete a file
- [ ] Change permissions (chmod)
- [ ] Create symlink
- [ ] Search for files
- [ ] Disconnect and reconnect

- [ ] **Step 4: Final commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): complete SFTP file browser implementation"
cd .. && git add client && git commit -m "client: SFTP file browser feature"
```
