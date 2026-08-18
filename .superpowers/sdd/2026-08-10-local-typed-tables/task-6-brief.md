### Task T5: `crypto.ts` row-data helpers (TDD)

**Files:**
- Modify: `client/src/lib/crypto/crypto.ts`, `client/src/lib/crypto/crypto.test.ts`

**Interfaces:**
- Consumes: existing `encryptSecret(plaintext, recordType)` / `decryptSecret(payload)`.
- Produces (T6–T8 consume):

```ts
export async function encryptRowData(table: string, value: unknown): Promise<string>;
export async function decryptRowData(encrypted: string): Promise<unknown>;
```

- [ ] **Step 1: Write the failing test**

Append to `crypto.test.ts`:

```ts
  it("encryptRowData uses table name as AAD", async () => {
    const secret = "secret";
    const encrypted = await encryptRowData("hosts", { address: "1.2.3.4" });
    expect(mockInvoke).toHaveBeenCalledWith("encrypt_secret", {
      plaintext: JSON.stringify({ address: "1.2.3.4" }),
      recordType: "hosts",
    });
    expect(encrypted).toBe(secret);
  });

  it("decryptRowData parses payload json", async () => {
    mockInvoke.mockResolvedValueOnce('{"port":22}');
    expect(await decryptRowData("enc")).toEqual({ port: 22 });
  });
```

Adjust to the existing mock setup in that file (reuse its `mockInvoke`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm vitest run src/lib/crypto/crypto.test.ts`

- [ ] **Step 3: Implement**

```ts
export async function encryptRowData(
  table: string,
  value: unknown,
): Promise<string> {
  return encryptSecret(JSON.stringify(value), table);
}

export async function decryptRowData(encrypted: string): Promise<unknown> {
  return JSON.parse(await decryptSecret(encrypted)) as unknown;
}
```

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/lib/crypto && pnpm biome check src/lib/crypto`

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/crypto/crypto.ts client/src/lib/crypto/crypto.test.ts
git commit -m "feat: encryptRowData/decryptRowData row payload helpers"
```