# Task T5 Report — `crypto.ts` row-data helpers

**Status:** DONE
**Commit:** `57deba2` feat: encryptRowData/decryptRowData row payload helpers
**Date:** 2026-08-10

## What was implemented

Added two exportsto `client/src/lib/crypto/crypto.ts`, composed verbatim from the brief on top of the existing `encryptSecret`/`decryptSecret` primitives:

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

- `encryptRowData` JSON-stringifies the row payload object and calls the Rust `encrypt_secret` command with `recordType = table name`, which the Rust side uses as the AEAD AAD (spec §6). One JSON blob per row.
- `decryptRowData` reverses: Rust `decrypt_secret` (AAD bound inside the ciphertext payload) then `JSON.parse` back to the object.

## TDD evidence

### RED — `pnpm vitest run src/lib/crypto/crypto.test.ts` before implementation

```
FAIL  src/lib/crypto/crypto.test.ts > encryptRowData / decryptRowData > encryptRowData uses table name as AAD
TypeError: encryptRowData is not a function   ❯ src/lib/crypto/crypto.test.ts:361

FAIL  src/lib/crypto/crypto.test.ts > encryptRowData / decryptRowData > decryptRowData parses payload json
TypeError: decryptRowData is not a function   ❯ src/lib/crypto/crypto.test.ts:371

 Test Files  1 failed (1)
      Tests  2 failed | 28 passed (30)
```

### GREEN — `pnpm vitest run` full suite after implementation

```
 Test Files  7 passed (7)
      Tests  85 passed (85)   [83 existing + 2 new]
```

### Lint — `pnpm biome check src/lib/crypto`

```
Checked 2 files in 45ms. No fixes applied.
```

## Files changed

- `client/src/lib/crypto/crypto.ts` — added `encryptRowData`/`decryptRowData` after `decryptSecret` (no existing code modified).
- `client/src/lib/crypto/crypto.test.ts` — added `encryptRowData`/`decryptRowData` to imports (alphabetical per biome), appended `describe("encryptRowData / decryptRowData")` block with the brief's two tests. The encrypt test got one line of mock-setup adjustment (`mockInvoke.mockResolvedValue(secret)`) — without it the shared `vi.fn()` invoke returns `undefined` and the `expect(encrypted).toBe(secret)` assertion can never pass; the brief explicitly permits adjustment to the existing mock setup.

## Self-review findings

1. Only deviation from the brief's verbatim test snippet is the added `mockInvoke.mockResolvedValue(secret)` in the first test (permitted by brief: "Adjust to the existing mock setup"). `vi.clearAllMocks()` in `beforeEach` does not reset implementations, so a stray resolved value from an earlier test could make the assertion pass spuriously — setting it explicitly in-test makes the test self-contained and deterministic.
2. The new tests were wrapped in a `describe` block to match the file's existing convention (every other group is wrapped).
3. AES/JSON semantics match the spec §6 deviation: payload = full object; whitelist stripping (plaintext fields) happens at the caller (T6–T8), not here — correct separation.
4. `JSON.parse` failure surfaces as the native `SyntaxError` rather than a wrapped error. Acceptable: `decryptRowData` is only called on rows previously written by `encryptRowData`, and any corruption would likewise fail at the Rust layer's AEAD tag check first. Downstream (T6–T8) can validate the shape after parse.

## Concerns

- None blocking. Minor note: roundtrip (encrypt→decrypt) JSON semantics (e.g. `undefined` values are dropped by `JSON.stringify`) are inherited from native JSON behavior; the row payloads produced by T6–T8 are plain objects from GORM-mirrored rows, so this is not a practical concern.