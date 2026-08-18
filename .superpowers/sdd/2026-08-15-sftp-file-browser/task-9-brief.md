### Task 9: Wire into useFileOperations stubs

**Files:**
- Modify: `client/src/hooks/sftp/useFileOperations.ts`

**Interfaces:**
- Consumes: `RemoteFileProviderImpl`
- Produces: All file operations now call real SFTP commands

- [ ] **Step 1: Replace TODO stubs in useFileOperations.ts**

Find and replace each `// TODO: SSH ...` block with actual `RemoteFileProvider` calls. The exact implementation depends on the existing code structure.

- [ ] **Step 2: Run biome check**

Run: `cd client && pnpm biome check src/hooks/sftp/useFileOperations.ts`

- [ ] **Step 3: Run tests**

Run: `cd client && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): wire RemoteFileProvider into useFileOperations"
```
