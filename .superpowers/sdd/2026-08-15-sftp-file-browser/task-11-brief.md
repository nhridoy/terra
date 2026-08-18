### Task 11: Error handling

**Files:**
- Modify: `client/src/hooks/sftp/useFileOperations.ts`
- Modify: `client/src/stores/sftp/sftpStore.ts`

**Interfaces:**
- Consumes: All SFTP operations
- Produces: Proper error display (inline, toast, modal)

- [ ] **Step 1: Add error handling to all SFTP operations**

Wrap each operation in try/catch with appropriate error display:
- Connection failures → modal
- Operation failures → inline error
- Transfer failures → toast

- [ ] **Step 2: Add error state to sftpStore**

```typescript
interface SftpErrorState {
  lastError: string | null;
  errorType: "connection" | "operation" | "transfer" | null;
}
```

- [ ] **Step 3: Run tests**

Run: `cd client && pnpm vitest run`

- [ ] **Step 4: Commit**

```bash
cd client && git add -A && git commit -m "feat(sftp): add comprehensive error handling"
```
