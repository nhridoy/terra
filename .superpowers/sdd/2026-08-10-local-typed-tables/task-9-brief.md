### Task T8: Wire `snippetStore` + `workspaceStore` (TDD)

**Files:**
- Modify: `client/src/stores/snippets/snippetStore.ts`, `client/src/stores/workspaces/workspaceStore.ts`
- Create: `client/src/stores/snippets/snippetStore.test.ts`, `client/src/stores/workspaces/workspaceStore.test.ts`

**Interfaces:**
- Consumes: T4/T5.
- Produces: public interfaces unchanged. Payloads: snippets (AAD `"snippets"`) `{ command, tags }`; workspaces (AAD `"workspaces"`) `{ layout, hostIds }`.

- [ ] **Step 1: Write the failing tests**

Snippets: (1) `fetchSnippets` decrypts into `Snippet` (name column, command/tags from payload, description from column); (2) `createSnippet` encrypts payload + upserts (vault fallback) + state; (3) `updateSnippet` preserves unpatched `command`/`tags`; (4) `deleteSnippet` tombstones. Workspaces: (1) `fetchWorkspaces` maps layout string from payload; (2) `createWorkspace(name, layout, vaultId?)` upserts with `data = encrypt("workspaces", { layout: JSON.stringify(layout), hostIds: undefined })`; (3) `renameWorkspace` re-encrypts with unchanged layout; (4) `deleteWorkspace` tombstones.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/stores/snippets src/stores/workspaces`

- [ ] **Step 3: Implement**

Follow the hostStore pattern exactly (same vault fallback helper inline; same error/state handling; keep `setSearchQuery`/`getFilteredSnippets` for snippets and `isLoading` handling for workspaces). Workspace model mapping: `Workspace { id, name, layout: (payload.layout as string) ?? "{}", vaultId: row.vault_id, hostIds: payload.hostIds, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }`.

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/stores/snippets src/stores/workspaces && pnpm biome check src/stores/snippets src/stores/workspaces`

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/snippets/ client/src/stores/workspaces/
git commit -m "feat: snippet and workspace stores local-first persistence"
```