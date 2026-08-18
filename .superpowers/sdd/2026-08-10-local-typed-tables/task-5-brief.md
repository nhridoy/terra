### Task T4: TS wrapper `lib/db/db.ts` (TDD)

**Files:**
- Modify: `client/src/lib/db/db.ts`, Create: `client/src/lib/db/db.test.ts`

**Interfaces:**
- Consumes: T3 invoke names.
- Produces (T6–T8 consume):

```ts
export type TableName = "groups" | "hosts" | "keys" | "snippets" | "workspaces" | "presets";
export interface SyncRow { id: string; revision: number; vault_id: string;
  created_at: number; updated_at: number; deleted_at: number | null;
  name?: string; os?: string | null; description?: string | null; sort_order: number;
  parent_id?: string | null; group_id?: string | null; key_id?: string | null; data: string; }
export interface OutboxEntry { table_name: string; record_id: string; queued_at: number; }
export function listRows(table: TableName, vaultId: string): Promise<SyncRow[]>;
export function getRow(table: TableName, id: string): Promise<SyncRow | null>;
export function upsertRow(table: TableName, row: { id: string; vault_id: string; data: string } & Partial<SyncRow>): Promise<SyncRow>;
export function deleteRow(table: TableName, id: string): Promise<void>;
export function getOutbox(): Promise<OutboxEntry[]>;
export function wipeLocalData(): Promise<void>; // existing, unchanged
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { deleteRow, getOutbox, getRow, listRows, upsertRow } from "./db";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => { mockInvoke.mockReset(); });

describe("db wrapper", () => {
  it("listRows maps invoke args", async () => {
    mockInvoke.mockResolvedValue([{ id: "h1", revision: 1, vault_id: "v1" }]);
    const rows = await listRows("hosts", "v1");
    expect(mockInvoke).toHaveBeenCalledWith("db_list", { table: "hosts", vaultId: "v1", includeDeleted: false });
    expect(rows[0].id).toBe("h1");
  });

  it("getRow returns null when absent", async () => {
    mockInvoke.mockResolvedValue(null);
    expect(await getRow("keys", "k1")).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("db_get", { table: "keys", id: "k1" });
  });

  it("upsertRow passes row object", async () => {
    const row = { id: "h1", vault_id: "v1", data: "enc", name: "prod" };
    mockInvoke.mockResolvedValue({ ...row, revision: 2 });
    const saved = await upsertRow("hosts", row);
    expect(mockInvoke).toHaveBeenCalledWith("db_upsert", { table: "hosts", row });
    expect(saved.revision).toBe(2);
  });

  it("deleteRow tombstones via db_delete", async () => {
    mockInvoke.mockResolvedValue(null);
    await deleteRow("snippets", "s1");
    expect(mockInvoke).toHaveBeenCalledWith("db_delete", { table: "snippets", id: "s1" });
  });

  it("getOutbox returns entries", async () => {
    mockInvoke.mockResolvedValue([{ table_name: "hosts", record_id: "h1", queued_at: 1 }]);
    const out = await getOutbox();
    expect(out[0].record_id).toBe("h1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm vitest run src/lib/db/db.test.ts`
Expected: FAIL (module functions missing).

- [ ] **Step 3: Implement**

```ts
import { invoke } from "@tauri-apps/api/core";

export type TableName =
  | "groups"
  | "hosts"
  | "keys"
  | "snippets"
  | "workspaces"
  | "presets";

export interface SyncRow {
  id: string;
  revision: number;
  vault_id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  name?: string;
  os?: string | null;
  description?: string | null;
  sort_order: number;
  parent_id?: string | null;
  group_id?: string | null;
  key_id?: string | null;
  data: string;
}

export interface OutboxEntry {
  table_name: string;
  record_id: string;
  queued_at: number;
}

export async function listRows(
  table: TableName,
  vaultId: string,
  includeDeleted = false,
): Promise<SyncRow[]> {
  return invoke<SyncRow[]>("db_list", { table, vaultId, includeDeleted });
}

export async function getRow(
  table: TableName,
  id: string,
): Promise<SyncRow | null> {
  return invoke<SyncRow | null>("db_get", { table, id });
}

export async function upsertRow(
  table: TableName,
  row: { id: string; vault_id: string; data: string } & Partial<SyncRow>,
): Promise<SyncRow> {
  return invoke<SyncRow>("db_upsert", { table, row });
}

export async function deleteRow(table: TableName, id: string): Promise<void> {
  await invoke("db_delete", { table, id });
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  return invoke<OutboxEntry[]>("db_outbox");
}

// Reset the on-device SQLite cache to a pristine, fresh-install state. ... (keep existing doc)
export async function wipeLocalData(): Promise<void> {
  await invoke("wipe_local_data");
}
```

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/lib/db/db.test.ts && pnpm biome check src/lib/db/db.ts src/lib/db/db.test.ts`
Expected: PASS, no new warnings.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/db/db.ts client/src/lib/db/db.test.ts
git commit -m "feat: ts db wrapper — list/get/upsert/deleteRow, getOutbox"
```