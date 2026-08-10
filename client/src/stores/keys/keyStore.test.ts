import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/db/db");
vi.mock("../../lib/crypto/crypto");

import { decryptRowData, encryptRowData } from "../../lib/crypto/crypto";
import { deleteRow, getRow, listRows, upsertRow } from "../../lib/db/db";
import { useVaultStore } from "../vault/vaultStore";
import { useKeyStore } from "./keyStore";

const mockList = vi.mocked(listRows);
const mockGet = vi.mocked(getRow);
const mockUpsert = vi.mocked(upsertRow);
const mockDelete = vi.mocked(deleteRow);
const mockDecrypt = vi.mocked(decryptRowData);
const mockEncrypt = vi.mocked(encryptRowData);

const keyRow = {
  id: "k1",
  revision: 1,
  vault_id: "v1",
  created_at: 1000,
  updated_at: 1000,
  deleted_at: null,
  name: "prod",
  description: "prod key",
  sort_order: 0,
  data: "enc",
};

beforeEach(() => {
  useKeyStore.setState({
    keys: [],
    selectedKey: null,
    isLoading: false,
    error: null,
  });
  vi.restoreAllMocks();
});

describe("keyStore", () => {
  it("fetchKeys decrypts payload into the Key model", async () => {
    mockList.mockResolvedValue([keyRow]);
    mockDecrypt.mockResolvedValue({
      keyType: "ed25519",
      publicKey: "pub",
      privateKey: "PRIV",
      fingerprint: "fp",
    });
    await useKeyStore.getState().fetchKeys("v1");
    expect(mockList).toHaveBeenCalledWith("keys", "v1");
    const key = useKeyStore.getState().keys[0];
    expect(key.id).toBe("k1");
    expect(key.name).toBe("prod");
    expect(key.description).toBe("prod key");
    expect(key.keyType).toBe("ed25519");
    expect(key.publicKey).toBe("pub");
    expect(key.encryptedPrivateKey).toBe("PRIV");
    expect(key.fingerprint).toBe("fp");
    expect(key.createdAt).toBe("1000");
  });

  it("importKey falls back to crypto.randomUUID, encrypts payload, upserts with vault fallback", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("uuid-123");
    mockEncrypt.mockResolvedValue("enc");
    mockUpsert.mockResolvedValue({
      id: "uuid-123",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      data: "enc",
    });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useKeyStore.getState().importKey({
      name: "mykey",
      publicKey: "pub",
      encryptedPrivateKey: "PRIV",
    });
    expect(mockEncrypt).toHaveBeenCalledWith(
      "keys",
      expect.objectContaining({
        keyType: "ed25519",
        publicKey: "pub",
        privateKey: "PRIV",
      }),
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      "keys",
      expect.objectContaining({
        id: "uuid-123",
        vault_id: "v1",
        name: "mykey",
        data: "enc",
      }),
    );
    expect(useKeyStore.getState().keys.length).toBe(1);
  });

  it("importKey keeps sensitive key material out of plaintext columns", async () => {
    mockEncrypt.mockResolvedValue("enc");
    mockUpsert.mockResolvedValue({
      id: "uuid-123",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      data: "enc",
    });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useKeyStore.getState().importKey({
      name: "mykey",
      keyType: "rsa",
      publicKey: "pub",
      encryptedPrivateKey: "PRIV",
      fingerprint: "fp",
    });
    const rowArg = mockUpsert.mock.calls[0][1];
    expect(rowArg.data).toBe("enc");
    expect(rowArg).not.toHaveProperty("privateKey");
    expect(rowArg).not.toHaveProperty("encryptedPrivateKey");
    expect(rowArg).not.toHaveProperty("keyType");
    expect(rowArg).not.toHaveProperty("publicKey");
    expect(rowArg).not.toHaveProperty("passphrase");
    expect(rowArg).not.toHaveProperty("fingerprint");
    expect(mockUpsert).toHaveBeenCalledWith(
      "keys",
      expect.not.objectContaining({
        name: "PRIV",
        description: "PRIV",
        sort_order: "PRIV",
      }),
    );
  });

  it("generateKey encrypts empty key material and upserts", async () => {
    mockEncrypt.mockResolvedValue("enc");
    mockUpsert.mockResolvedValue({
      id: "uuid-123",
      revision: 1,
      vault_id: "v1",
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      data: "enc",
    });
    useVaultStore.setState({ currentVaultId: "v1" });
    await useKeyStore.getState().generateKey("gen-key", "ed25519");
    expect(mockEncrypt).toHaveBeenCalledWith(
      "keys",
      expect.objectContaining({
        keyType: "ed25519",
        publicKey: "",
        privateKey: "",
      }),
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      "keys",
      expect.objectContaining({
        name: "gen-key",
        vault_id: "v1",
        data: "enc",
      }),
    );
    expect(useKeyStore.getState().keys.length).toBe(1);
  });

  it("deleteKey tombstones and clears selection", async () => {
    useKeyStore.setState({
      keys: [
        {
          id: "k1",
          name: "x",
          keyType: "ed25519",
          publicKey: "",
          encryptedPrivateKey: "",
          createdAt: "",
        },
      ],
      selectedKey: { id: "k1" },
    });
    await useKeyStore.getState().deleteKey("k1");
    expect(mockDelete).toHaveBeenCalledWith("keys", "k1");
    expect(useKeyStore.getState().keys).toEqual([]);
    expect(useKeyStore.getState().selectedKey).toBeNull();
  });

  it("getCredentialsForKey decrypts and returns the private key", async () => {
    mockGet.mockResolvedValue({ ...keyRow, data: "enc" });
    mockDecrypt.mockResolvedValue({
      keyType: "ed25519",
      publicKey: "pub",
      privateKey: "PRIV",
      fingerprint: "fp",
    });
    const creds = await useKeyStore.getState().getCredentialsForKey("k1");
    expect(mockGet).toHaveBeenCalledWith("keys", "k1");
    expect(creds).toBe("PRIV");
  });

  it("getCredentialsForKey returns empty string for missing key", async () => {
    mockGet.mockResolvedValue(null);
    const creds = await useKeyStore.getState().getCredentialsForKey("missing");
    expect(creds).toBe("");
  });
});
