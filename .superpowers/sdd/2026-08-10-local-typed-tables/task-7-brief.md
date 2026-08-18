### Task T6: Wire `hostStore` (TDD)

**Files:**
- Modify: `client/src/stores/hosts/hostStore.ts`
- Create: `client/src/stores/hosts/hostStore.test.ts`

**Interfaces:**
- Consumes: T4 `db.ts` (`listRows`/`getRow`/`upsertRow`/`deleteRow`), T5 helpers, existing `useVaultStore.getState().currentVaultId`, existing `useKeyStore.getState().getCredentialsForKey`.
- Produces: same public store interface as today (components unchanged). Host payload mapping:

```ts
// payload (encrypted JSON, AAD "hosts"): { address, port, username, authType, password, tags, color }
// payload (encrypted JSON, AAD "groups"): { }  (groups have no encrypted fields)
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../lib/db/db");
vi.mock("../../lib/crypto/crypto");
vi.mock("../vault/vaultStore");
vi.mock("../keys/keyStore", () => ({
  useKeyStore: { getState: () => ({ getCredentialsForKey: vi.fn(async () => "PRIVATE") }) },
}));

import { deleteRow, getRow, listRows, upsertRow } from "../../lib/db/db";
import { decryptRowData, encryptRowData } from "../../lib/crypto/crypto";
import { useVaultStore } from "../vault/vaultStore";
import { useHostStore } from "./hostStore";

const mockList = vi.mocked(listRows);
const mockGet = vi.mocked(getRow);
const mockUpsert = vi.mocked(upsertRow);
const mockDelete = vi.mocked(deleteRow);
const mockDecrypt = vi.mocked(decryptRowData);
const mockEncrypt = vi.mocked(encryptRowData);

beforeEach(() => useHostStore.setState({ hosts: [], groups: [], selectedHost: null, isLoading: false, error: null }));

describe("hostStore", () => {
  it("fetchHosts decrypts payloads into the Host model", async () => {
    mockList.mockResolvedValue([{
      id: "h1", revision: 1, vault_id: "v1", created_at: 1000, updated_at: 1000,
      deleted_at: null, name: "prod", os: "linux", group_id: "g1", key_id: null,
      sort_order: 0, data: "enc",
    }]);
    mockDecrypt.mockResolvedValue({ address: "1.2.3.4", port: 22, username: "root", authType: "password", password: "pw", tags: ["prod"], color: "#f00" });
    await useHostStore.getState().fetchHosts("v1");
    expect(mockList).toHaveBeenCalledWith("hosts", "v1");
    const host = useHostStore.getState().hosts[0];
    expect(host.address).toBe("1.2.3.4");
    expect(host.port).toBe(22);
    expect(host.groupId).toBe("g1");
    expect(host.tags).toEqual(["prod"]);
  });

  it("createHost encrypts payload with AAD hosts and upserts", async () => {
    mockEncrypt.mockResolvedValue("enc");
    mockUpsert.mockResolvedValue({ id: "new", revision: 1, vault_id: "v1", created_at: 1, updated_at: 1, deleted_at: null, data: "enc" });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useHostStore.getState().createHost({ name: "prod", address: "1.2.3.4" });
    expect(mockEncrypt).toHaveBeenCalledWith("hosts", expect.objectContaining({ address: "1.2.3.4", port: 22, username: "root", authType: "password" }));
    expect(mockUpsert).toHaveBeenCalledWith("hosts", expect.objectContaining({ name: "prod", vault_id: "v1" }));
    expect(useHostStore.getState().hosts.length).toBe(1);
  });

  it("updateHost preserves unpatched encrypted fields", async () => {
    mockGet.mockResolvedValue({ id: "h1", revision: 1, vault_id: "v1", created_at: 1, updated_at: 1, deleted_at: null, name: "prod", group_id: null, key_id: null, sort_order: 0, data: "enc" });
    mockDecrypt.mockResolvedValue({ address: "1.2.3.4", port: 22, username: "root", authType: "password", password: "pw", tags: [], color: "#64748b" });
    mockEncrypt.mockResolvedValue("enc2");
    await useHostStore.getState().updateHost("h1", { name: "prod2" });
    expect(mockEncrypt).toHaveBeenCalledWith("hosts", expect.objectContaining({ address: "1.2.3.4", password: "pw" }));
  });

  it("deleteHost tombstones and clears selection", async () => {
    useHostStore.setState({ hosts: [{ id: "h1", name: "x", address: "a", port: 22, tags: [], sortOrder: 0, createdAt: "", updatedAt: "" }], selectedHost: { id: "h1" } });
    await useHostStore.getState().deleteHost("h1");
    expect(mockDelete).toHaveBeenCalledWith("hosts", "h1");
    expect(useHostStore.getState().hosts).toEqual([]);
    expect(useHostStore.getState().selectedHost).toBeNull();
  });

  it("getCredentialsForHost resolves key auth via keyStore", async () => {
    mockGet.mockResolvedValue({ id: "h1", revision: 1, vault_id: "v1", created_at: 1, updated_at: 1, deleted_at: null, name: "prod", key_id: "k1", sort_order: 0, data: "enc" });
    mockDecrypt.mockResolvedValue({ address: "1.2.3.4", port: 22, username: "root", authType: "key", password: null, tags: [], color: "#64748b" });
    const creds = await useHostStore.getState().getCredentialsForHost("h1");
    expect(creds.privateKey).toBe("PRIVATE");
  });
});
```

(Adjust the keyStore mock to the file's real import path; alternatively stub `useKeyStore.setState`) as the file's existing conventions dictate. Existing tests for groups follow the same patterns — add: `fetchGroups` decrypts `{}` payload into Group; `createGroup` upserts with `data` encrypted `"{}"`; `deleteGroup` tombstones.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm vitest run src/stores/hosts/hostStore.test.ts`
Expected: FAIL — stores are no-ops.

- [ ] **Step 3: Implement**

Replace the store body in `hostStore.ts` with the real implementation (keep `Host`, `Group`, and the `HostState` interface verbatim):

```ts
import { create } from "zustand";
import { decryptRowData, encryptRowData } from "@/lib/crypto/crypto";
import { deleteRow, getRow, listRows, upsertRow } from "@/lib/db/db";
import { useKeyStore } from "@/stores/keys/keyStore";
import { useVaultStore } from "@/stores/vault/vaultStore";

// ... Host / Group interfaces unchanged ...

function newId(): string {
  return crypto.randomUUID();
}

interface HostPayload {
  address: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password?: string;
  tags: string[];
  color?: string;
}

async function hostFromRow(row: SyncRowLike): Promise<Host> {
  const payload = (await decryptRowData(row.data)) as Partial<HostPayload>;
  return {
    id: row.id,
    name: row.name ?? "",
    address: payload.address ?? "",
    port: payload.port ?? 22,
    username: payload.username ?? "root",
    groupId: row.group_id ?? null,
    tags: payload.tags ?? [],
    color: payload.color ?? "#64748b",
    sortOrder: row.sort_order,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    vaultId: row.vault_id,
    authType: payload.authType ?? "password",
    password: payload.password,
    keyId: row.key_id ?? undefined,
  };
}
```

Implement the rest with this shape: `fetchHosts(vaultId)` → `listRows("hosts", vaultId)` → map+decrypt → `set({ hosts, isLoading: false })`; `createHost(host)` → `const vaultId = host.vaultId ?? useVaultStore.getState().currentVaultId; await upsertRow("hosts", { id: newId(), vault_id: vaultId!, name, group_id: host.groupId ?? null, key_id: host.keyId ?? null, sort_order: host.sortOrder ?? 0, data: await encryptRowData("hosts", { address: host.address, port: host.port ?? 22, username: host.username ?? "root", authType: host.authType ?? "password", password: host.password, tags: host.tags ?? [], color: host.color }) })` then reload into state; `updateHost(id, patch)` → `getRow`, decrypt, merge (patch wins, preserving unknown payload fields), re-encrypt, upsert; `deleteHost(id)` → `deleteRow("hosts", id)` + state removal; `getCredentialsForHost(hostId)` → password auth returns `{ password, privateKey: "", passphrase: "" }`; key auth → `const keyCreds = await useKeyStore.getState().getCredentialsForKey(keyId)` → `{ password: "", privateKey: keyCreds, passphrase: "" }`. Groups: same against `"groups"` with `data: await encryptRowData("groups", {})`. Errors set `error` and rethrow-free state reset (`set({ isLoading: false, error })`); `clearError` unchanged.

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/stores/hosts && pnpm biome check src/stores/hosts`
Expected: PASS, no new warnings.

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/hosts/
git commit -m "feat: hostStore local-first persistence (hosts+groups via db layer)"
```