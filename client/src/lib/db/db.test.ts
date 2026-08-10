import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { deleteRow, getOutbox, getRow, listRows, upsertRow } from "./db";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("db wrapper", () => {
  it("listRows maps invoke args", async () => {
    mockInvoke.mockResolvedValue([{ id: "h1", revision: 1, vault_id: "v1" }]);
    const rows = await listRows("hosts", "v1");
    expect(mockInvoke).toHaveBeenCalledWith("db_list", {
      table: "hosts",
      vaultId: "v1",
      includeDeleted: false,
    });
    expect(rows[0].id).toBe("h1");
  });

  it("getRow returns null when absent", async () => {
    mockInvoke.mockResolvedValue(null);
    expect(await getRow("keys", "k1")).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("db_get", {
      table: "keys",
      id: "k1",
    });
  });

  it("upsertRow passes row object", async () => {
    const row = { id: "h1", vault_id: "v1", data: "enc", name: "prod" };
    mockInvoke.mockResolvedValue({ ...row, revision: 2 });
    const saved = await upsertRow("hosts", row);
    expect(mockInvoke).toHaveBeenCalledWith("db_upsert", {
      table: "hosts",
      row,
    });
    expect(saved.revision).toBe(2);
  });

  it("deleteRow tombstones via db_delete", async () => {
    mockInvoke.mockResolvedValue(null);
    await deleteRow("snippets", "s1");
    expect(mockInvoke).toHaveBeenCalledWith("db_delete", {
      table: "snippets",
      id: "s1",
    });
  });

  it("getOutbox returns entries", async () => {
    mockInvoke.mockResolvedValue([
      { table_name: "hosts", record_id: "h1", queued_at: 1 },
    ]);
    const out = await getOutbox();
    expect(out[0].record_id).toBe("h1");
  });
});
