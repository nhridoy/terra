### Task T7: Wire `keyStore` (TDD)

**Files:**
- Modify: `client/src/stores/keys/keyStore.ts`
- Create: `client/src/stores/keys/keyStore.test.ts`

**Interfaces:**
- Consumes: T4/T5.
- Produces: public interface unchanged. Payload (AAD `"keys"`): `{ keyType, publicKey, fingerprint, privateKey, passphrase }`.

- [ ] **Step 1: Write the failing tests**

Model the hostStore tests: (1) `fetchKeys` decrypts payload into `Key` (name from column, keyType/publicKey/fingerprint from payload, `encryptedPrivateKey` = payload.privateKey for compatibility, createdAt from `created_at`); (2) `importKey` builds id with `crypto.randomUUID()` when missing, encrypts payload, upserts with vault fallback; (3) `deleteKey` tombstones + state removal; (4) `getCredentialsForKey` decrypts and returns `privateKey`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && pnpm vitest run src/stores/keys/keyStore.test.ts`

- [ ] **Step 3: Implement**

```ts
import { create } from "zustand";
import { decryptRowData, encryptRowData } from "@/lib/crypto/crypto";
import { deleteRow, getRow, listRows, upsertRow } from "@/lib/db/db";
import { useVaultStore } from "@/stores/vault/vaultStore";

// Key interface / KeyState interface unchanged.

interface KeyPayload {
  keyType: string;
  publicKey: string;
  privateKey: string;
  passphrase?: string;
  fingerprint?: string;
}
```

`fetchKeys(vaultId)` → `listRows("keys", vaultId)` → `{ id, name, description, keyType: payload.keyType ?? "ed25519", publicKey: payload.publicKey, encryptedPrivateKey: payload.privateKey, fingerprint: payload.fingerprint, createdAt: String(row.created_at) }`. `importKey(key)` → id fallback `crypto.randomUUID()`, vault fallback like hostStore, `data: await encryptRowData("keys", { keyType: key.keyType ?? "ed25519", publicKey: key.publicKey ?? "", privateKey: key.encryptedPrivateKey ?? "", passphrase: undefined, fingerprint: key.fingerprint })`. `generateKey(name, keyType)` → same as importKey with empty keys. `deleteKey` / `selectKey` / `clearError` as before. `getCredentialsForKey(keyId)` → `getRow("keys", keyId)` → decrypt → `payload.privateKey`.

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run src/stores/keys && pnpm biome check src/stores/keys`

- [ ] **Step 5: Commit**

```bash
git add client/src/stores/keys/
git commit -m "feat: keyStore local-first persistence"
```