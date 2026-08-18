# Task 10: Client TS Crypto Wrappers

**Files:**
- Modify: `client/src/lib/crypto/crypto.ts`
- Modify: `client/src-tauri/src/lib.rs` (add invoke handlers if needed)

**Interfaces:**
- Produces: Same exported API shape as current stub, but calling Tauri commands

## Steps

1. Write crypto wrapper test (vitest):
```typescript
// test that generateAccountMaterial returns salt_cl, recovery_code, public_key
// test that encryptSecret / decryptSecret roundtrip
```

2. Implement crypto.ts wrappers:
```typescript
import { invoke } from '@tauri-apps/api/core';

export async function generateAccountMaterial() {
  return invoke<{salt_cl: string; recovery_code: string; public_key: string}>('generate_account_material');
}

export async function deriveKek(password: string, saltCl: string) {
  return invoke<void>('derive_kek', { password, saltCl });
}

// ... etc
```

3. `cd client && pnpm vitest` → PASS

4. Commit
