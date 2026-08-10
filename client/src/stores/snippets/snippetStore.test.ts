import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/db/db");
vi.mock("../../lib/crypto/crypto");

import { decryptRowData, encryptRowData } from "../../lib/crypto/crypto";
import { deleteRow, getRow, listRows, upsertRow } from "../../lib/db/db";
import { useVaultStore } from "../vault/vaultStore";
import { useSnippetStore } from "./snippetStore";

const mockList = vi.mocked(listRows);
const mockGet = vi.mocked(getRow);
const mockUpsert = vi.mocked(upsertRow);
const mockDelete = vi.mocked(deleteRow);
const mockDecrypt = vi.mocked(decryptRowData);
const mockEncrypt = vi.mocked(encryptRowData);

const snippetRow = {
  id: "s1",
  revision: 1,
  vault_id: "v1",
  created_at: 1000,
  updated_at: 1000,
  deleted_at: null,
  name: "deploy",
  description: "ship to prod",
  sort_order: 0,
  data: "enc",
};

beforeEach(() => {
  useSnippetStore.setState({
    snippets: [],
    selectedSnippet: null,
    isLoading: false,
    error: null,
    searchQuery: "",
  });
  vi.restoreAllMocks();
  useVaultStore.setState({ currentVaultId: null });
});

describe("snippetStore", () => {
  it("fetchSnippets decrypts payload into the Snippet model", async () => {
    mockList.mockResolvedValue([snippetRow]);
    mockDecrypt.mockResolvedValue({
      command: "pnpm build && pnpm deploy",
      tags: ["ci", "prod"],
    });
    await useSnippetStore.getState().fetchSnippets("v1");
    expect(mockList).toHaveBeenCalledWith("snippets", "v1");
    const snippet = useSnippetStore.getState().snippets[0];
    expect(snippet.id).toBe("s1");
    expect(snippet.name).toBe("deploy");
    expect(snippet.description).toBe("ship to prod");
    expect(snippet.command).toBe("pnpm build && pnpm deploy");
    expect(snippet.tags).toEqual(["ci", "prod"]);
    expect(snippet.vaultId).toBe("v1");
    expect(snippet.createdAt).toBe("1000");
  });

  it("createSnippet encrypts payload with AAD snippets and upserts with vault fallback", async () => {
    mockEncrypt.mockResolvedValue("enc");
    mockUpsert.mockResolvedValue({
      id: "new",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      name: "deploy",
      sort_order: 0,
      data: "enc",
    });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useSnippetStore.getState().createSnippet({
      name: "deploy",
      command: "pnpm build",
      tags: ["ci"],
    });
    expect(mockEncrypt).toHaveBeenCalledWith(
      "snippets",
      expect.objectContaining({ command: "pnpm build", tags: ["ci"] }),
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      "snippets",
      expect.objectContaining({ name: "deploy", vault_id: "v1", data: "enc" }),
    );
    expect(useSnippetStore.getState().snippets.length).toBe(1);
  });

  it("createSnippet keeps command/tags out of plaintext columns and whitelist fields out of the encrypt payload", async () => {
    mockEncrypt.mockResolvedValue("enc");
    mockUpsert.mockResolvedValue({
      id: "new",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      name: "deploy",
      description: "ship to prod",
      sort_order: 0,
      data: "enc",
    });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useSnippetStore.getState().createSnippet({
      name: "deploy",
      description: "ship to prod",
      command: "pnpm build",
      tags: ["ci"],
    });
    const rowArg = mockUpsert.mock.calls[0][1];
    expect(rowArg.data).toBe("enc");
    expect(rowArg).not.toHaveProperty("command");
    expect(rowArg).not.toHaveProperty("tags");
    const payloadArg = mockEncrypt.mock.calls[0][1] as Record<string, unknown>;
    expect(payloadArg).toHaveProperty("command", "pnpm build");
    expect(payloadArg).toHaveProperty("tags");
    expect(payloadArg).not.toHaveProperty("name");
    expect(payloadArg).not.toHaveProperty("description");
    expect(payloadArg).not.toHaveProperty("sort_order");
    expect(mockUpsert).toHaveBeenCalledWith(
      "snippets",
      expect.not.objectContaining({
        name: "pnpm build",
        description: "pnpm build",
        sort_order: "pnpm build",
      }),
    );
  });

  it("updateSnippet preserves unpatched command/tags", async () => {
    useSnippetStore.setState({
      snippets: [
        {
          id: "s1",
          name: "deploy",
          command: "pnpm build",
          description: "ship to prod",
          tags: ["ci"],
          createdAt: "1000",
        },
      ],
    });
    mockGet.mockResolvedValue(snippetRow);
    mockDecrypt.mockResolvedValue({
      command: "pnpm build",
      tags: ["ci"],
    });
    mockEncrypt.mockResolvedValue("enc2");
    await useSnippetStore
      .getState()
      .updateSnippet("s1", { name: "deploy2", description: "new" });
    expect(mockEncrypt).toHaveBeenCalledWith(
      "snippets",
      expect.objectContaining({ command: "pnpm build", tags: ["ci"] }),
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      "snippets",
      expect.objectContaining({ name: "deploy2", data: "enc2" }),
    );
    expect(useSnippetStore.getState().snippets[0]).toMatchObject({
      name: "deploy2",
    });
  });

  it("deleteSnippet tombstones and clears selection", async () => {
    useSnippetStore.setState({
      snippets: [
        {
          id: "s1",
          name: "x",
          command: "ls",
          tags: [],
          createdAt: "",
        },
      ],
      selectedSnippet: {
        id: "s1",
        name: "x",
        command: "ls",
        tags: [],
        createdAt: "",
      },
    });
    await useSnippetStore.getState().deleteSnippet("s1");
    expect(mockDelete).toHaveBeenCalledWith("snippets", "s1");
    expect(useSnippetStore.getState().snippets).toEqual([]);
    expect(useSnippetStore.getState().selectedSnippet).toBeNull();
  });

  it("getFilteredSnippets filters by search query", async () => {
    useSnippetStore.setState({
      snippets: [
        {
          id: "a",
          name: "deploy",
          command: "pnpm build",
          tags: [],
          createdAt: "",
        },
        {
          id: "b",
          name: "backup",
          command: "pg_dump",
          tags: [],
          createdAt: "",
        },
      ],
      searchQuery: "deploy",
    });
    const filtered = useSnippetStore.getState().getFilteredSnippets();
    expect(filtered.map((s) => s.id)).toEqual(["a"]);
  });
});
