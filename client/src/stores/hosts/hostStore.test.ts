import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/db/db");
vi.mock("../../lib/crypto/crypto");
vi.mock("../keys/keyStore", () => ({
  useKeyStore: {
    getState: () => ({ getCredentialsForKey: vi.fn(async () => "PRIVATE") }),
  },
}));

import { decryptRowData, encryptRowData } from "../../lib/crypto/crypto";
import { deleteRow, getRow, listRows, upsertRow } from "../../lib/db/db";
import { useVaultStore } from "../vault/vaultStore";
import { useHostStore } from "./hostStore";

const mockList = vi.mocked(listRows);
const mockGet = vi.mocked(getRow);
const mockUpsert = vi.mocked(upsertRow);
const mockDelete = vi.mocked(deleteRow);
const mockDecrypt = vi.mocked(decryptRowData);
const mockEncrypt = vi.mocked(encryptRowData);

beforeEach(() =>
  useHostStore.setState({
    hosts: [],
    groups: [],
    selectedHost: null,
    isLoading: false,
    error: null,
  }),
);

describe("hostStore", () => {
  it("fetchHosts decrypts payloads into the Host model", async () => {
    mockList.mockResolvedValue([
      {
        id: "h1",
        revision: 1,
        vault_id: "v1",
        created_at: 1000,
        updated_at: 1000,
        deleted_at: null,
        name: "prod",
        os: "linux",
        group_id: "g1",
        key_id: null,
        sort_order: 0,
        data: "enc",
      },
    ]);
    mockDecrypt.mockResolvedValue({
      address: "1.2.3.4",
      port: 22,
      username: "root",
      authType: "password",
      password: "pw",
      tags: ["prod"],
      color: "#f00",
    });
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
    mockUpsert.mockResolvedValue({
      id: "new",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      data: "enc",
    });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useHostStore
      .getState()
      .createHost({ name: "prod", address: "1.2.3.4" });
    expect(mockEncrypt).toHaveBeenCalledWith(
      "hosts",
      expect.objectContaining({
        address: "1.2.3.4",
        port: 22,
        username: "root",
        authType: "password",
      }),
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      "hosts",
      expect.objectContaining({ name: "prod", vault_id: "v1" }),
    );
    expect(useHostStore.getState().hosts.length).toBe(1);
  });

  it("updateHost preserves unpatched encrypted fields", async () => {
    mockGet.mockResolvedValue({
      id: "h1",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      name: "prod",
      group_id: null,
      key_id: null,
      sort_order: 0,
      data: "enc",
    });
    mockDecrypt.mockResolvedValue({
      address: "1.2.3.4",
      port: 22,
      username: "root",
      authType: "password",
      password: "pw",
      tags: [],
      color: "#64748b",
    });
    mockEncrypt.mockResolvedValue("enc2");
    await useHostStore.getState().updateHost("h1", { name: "prod2" });
    expect(mockEncrypt).toHaveBeenCalledWith(
      "hosts",
      expect.objectContaining({ address: "1.2.3.4", password: "pw" }),
    );
  });

  it("deleteHost tombstones and clears selection", async () => {
    useHostStore.setState({
      hosts: [
        {
          id: "h1",
          name: "x",
          address: "a",
          port: 22,
          tags: [],
          sortOrder: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      selectedHost: { id: "h1" },
    });
    await useHostStore.getState().deleteHost("h1");
    expect(mockDelete).toHaveBeenCalledWith("hosts", "h1");
    expect(useHostStore.getState().hosts).toEqual([]);
    expect(useHostStore.getState().selectedHost).toBeNull();
  });

  it("getCredentialsForHost resolves key auth via keyStore", async () => {
    mockGet.mockResolvedValue({
      id: "h1",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      name: "prod",
      key_id: "k1",
      sort_order: 0,
      data: "enc",
    });
    mockDecrypt.mockResolvedValue({
      address: "1.2.3.4",
      port: 22,
      username: "root",
      authType: "key",
      password: null,
      tags: [],
      color: "#64748b",
    });
    const creds = await useHostStore.getState().getCredentialsForHost("h1");
    expect(creds.privateKey).toBe("PRIVATE");
  });

  it("getCredentialsForHost returns password auth creds", async () => {
    mockGet.mockResolvedValue({
      id: "h1",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      name: "prod",
      key_id: null,
      sort_order: 0,
      data: "enc",
    });
    mockDecrypt.mockResolvedValue({
      address: "1.2.3.4",
      port: 22,
      username: "root",
      authType: "password",
      password: "pw",
      tags: [],
      color: "#64748b",
    });
    const creds = await useHostStore.getState().getCredentialsForHost("h1");
    expect(creds.password).toBe("pw");
    expect(creds.privateKey).toBe("");
  });

  it("fetchGroups decrypts {} payload into Group", async () => {
    mockList.mockResolvedValue([
      {
        id: "g1",
        revision: 1,
        vault_id: "v1",
        created_at: 1000,
        updated_at: 1000,
        deleted_at: null,
        name: "prod",
        sort_order: 0,
        data: "{}",
      },
    ]);
    mockDecrypt.mockResolvedValue({});
    await useHostStore.getState().fetchGroups("v1");
    expect(mockList).toHaveBeenCalledWith("groups", "v1");
    const group = useHostStore.getState().groups[0];
    expect(group.id).toBe("g1");
    expect(group.name).toBe("prod");
  });

  it("createGroup upserts with data encrypted '{}'", async () => {
    mockEncrypt.mockResolvedValue("{}");
    mockUpsert.mockResolvedValue({
      id: "new",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      data: "{}",
    });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useHostStore.getState().createGroup({ name: "prod" });
    expect(mockEncrypt).toHaveBeenCalledWith("groups", {});
    expect(mockUpsert).toHaveBeenCalledWith(
      "groups",
      expect.objectContaining({ name: "prod", vault_id: "v1", data: "{}" }),
    );
    expect(useHostStore.getState().groups.length).toBe(1);
  });

  it("deleteGroup tombstones", async () => {
    useHostStore.setState({
      groups: [{ id: "g1", name: "x", sortOrder: 0, createdAt: "" }],
    });
    await useHostStore.getState().deleteGroup("g1");
    expect(mockDelete).toHaveBeenCalledWith("groups", "g1");
    expect(useHostStore.getState().groups).toEqual([]);
  });
});
