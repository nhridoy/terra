# Task T7 Report: keyStore local-first persistence (TDD)

**Date:** 2026-08-10
**Branch:** `ai`
**Base commit:** 20d3289 (HEAD before this task)
**Commit:** `ba51034` — `feat: keyStore local-first persistence`

## What I implemented

Replaced the stub bodies in `client/src/stores/keys/keyStore.ts` with real
local-first implementations, copying the conventions landed in `hostStore.ts`
(T6, commit 20d3289):

- `fetchKeys(vaultId?)` — `listRows("keys", vid)` with
  `vid = vaultId ?? useVaultStore.getState().currentVaultId`; self-heal fetch that
  replaces `keys` wholesale; per-row decrypt via `decryptRowData` mapping to the
  `Key` shape (`name`/`description` from plaintext columns, `keyType ?? "ed25519"`,
  `publicKey`/`fingerprint` from payload, `encryptedPrivateKey` = `payload.privateKey`
  for compatibility, `createdAt` from `created_at`).
- `importKey(key)` — id fallback `key.id ?? crypto.randomUUID()`, vault via
  `useVaultStore.getState().currentVaultId` (Key interface has no vaultId field, so
  no per-key override; interface kept byte-compatible), encrypts payload with
  `encryptRowData("keys", { keyType, publicKey, privateKey, passphrase: undefined,
  fingerprint })`, upserts with plaintext columns `name` + `description` + `sort_order`
  only, prepends created row to state.
- `generateKey(name, keyType)` — same as importKey with empty key material
  (`publicKey: ""`, `privateKey: ""`).
- `deleteKey(id)` — tombstones via `deleteRow("keys", id)`, removes from state, clears
  `selectedKey` if it pointed at the deleted key.
- `getCredentialsForKey(keyId)` — `getRow("keys", keyId)` + `decryptRowData` → returns
  `payload.privateKey` (returns `""` when row missing or payload lacks privateKey).
- `selectKey` / `clearError` unchanged.
- Standard error handling everywhere: `set({ isLoading: false, error: errorMessage(err) })`,
  and `"No vault selected"` guard on import/generate.
- Kept the public `Key`/`KeyState` interfaces byte-compatible — only bodies changed.

## Tests (TDD evidence)

**RED** — wrote `client/src/stores/keys/keyStore.test.ts` (7 tests) first, then ran:

```
$ pnpm vitest run src/stores/keys/keyStore.test.ts
Test Files  1 failed (1)
     Tests  6 failed | 1 passed (7)
```
(6 failures: fetch decrypt, importKey uuid/encrypt/upsert, whitelist split,
generateKey, deleteKey, getCredentialsForKey. 1 pass: missing-key returns `""` stub
behavior.)

**GREEN** — after implementation:

```
$ pnpm vitest run src/stores/keys
Test Files  1 passed (1)
     Tests  7 passed (7)
```

**Full suite + lint:**

```
$ pnpm vitest run
Test Files  9 passed (9)
     Tests  101 passed (101)        # 94 pre-existing + 7 new

$ pnpm biome check src/stores/keys
Checked 2 files in 108ms. No fixes applied.
```

Coverage per brief:
1. fetch decrypts payload → Key (`encryptedPrivateKey` = payload.privateKey,
   `createdAt` = "1000" from created_at).
2. `importKey` id fallback to `crypto.randomUUID()` (spied to return `uuid-123`),
   payload encrypted with AAD `"keys"` (defaults keyType "ed25519"), upsert with
   vault fallback via `useVaultStore.setState({ currentVaultId: "v1" })`.
3. Whitelist split pinned BOTH ways: `rowArg.data === "enc"`, no `privateKey` /
   `encryptedPrivateKey` / `keyType` / `publicKey` / `passphrase` / `fingerprint`
   properties on the upsert row, plus
   `expect.not.objectContaining({ name: "PRIV", description: "PRIV", sort_order: "PRIV" })`.
4. `deleteKey` tombstones + state removal + selection clear.
5. `getCredentialsForKey` decrypts and returns `"PRIV"`; also covers missing row → `""`.
6. Bonus: `generateKey` upserts with empty encrypted key material.

## Files changed

- `client/src/stores/keys/keyStore.ts` (modified, −7/+161)
- `client/src/stores/keys/keyStore.test.ts` (new, 211 lines)

## Self-review findings

- `passphrase: undefined` is written into the encrypted payload per brief (kept).
- The `Key` interface lacks `vaultId`/`sortOrder`, so importKey keys to the current
  vault and writes `sort_order: 0` — consistent with the brief's "interface unchanged"
  requirement; can be revisited if a per-key vault override is needed later.
- `getCredentialsForKey` returns `""` (not a rejection) when the row is missing —
  matches the stub contract and how `sessionManager.ts` / `hostStore.ts` consume it
  (they treat falsy as "no key credentials").
- keystore test mocks only `db` + `crypto`; `vaultStore` is the real store (same as
  hostStore.test.ts), so the vault-fallback path is exercised for real.
- LF→CRLF warnings on commit are pre-existing repo-wide Git autocrlf behavior, not
  introduced here.

## Concerns

- None blocking. `importKey`/`generateKey` currently only reference the active vault;
  a future per-key `vaultId` override would need a small interface addition, which is
  intentionally out of scope to keep the public interface byte-compatible.