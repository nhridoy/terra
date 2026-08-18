# Task 13 Report — authStore pending-verification state + verify/resend actions

**Status:** DONE
**Commit:** `1a860fb` — "feat: pending verification state and verify/resend actions"
**Date:** 2026-08-08

## Changes

### `client/src/stores/auth/authStore.ts`

1. **Import block** (line 3-11): added `AuthApiError` as a **value** import (required for `err instanceof AuthApiError` — a `type` import would be erased and break the `instanceof` check). Biome's organizeImports sorts it before `authApi` (uppercase sorts first).

2. **`AuthState` interface**:
   - Added `pendingVerificationEmail: string | null;` after `pendingOAuth`.
   - Added `verifyEmail: (email: string, otp: string, password?: string) => Promise<void>`, `resendVerification: (email: string) => Promise<void>`, `clearPendingVerification: () => void` after `oauthSetup`. Signature includes the optional `password` per the brief's NOTE (Task 14's OTP panel needs to pass the just-typed password through to arm the keychain entry).

3. **`register()`**: inserted the `verification_required` early return after the `authApi.register` call. The set → `{ pendingVerificationEmail: email, isLoading: false }` and returns; success flow below proceeds only when verification is not required.

4. **`login()` catch**: added the `VERIFICATION_REQUIRED` branch before the generic message assignment — sets `pendingVerificationEmail: err.apiError.email ?? email` and returns.

5. **New actions** (added between `register` and `login`):
   - `verifyEmail(email, otp, password?)` — mirrors `login()`'s success block: `unwrapDek` when `res.keyring`, sets user/tokens/isAuthenticated/isUnlocked, clears `pendingVerificationEmail`, `persistTokens`, and `savePassword(password)` only when `password && !get().alwaysAsk`.
   - `resendVerification(email)` — calls `authApi.resendVerification`, standard error handling, rethrows.
   - `clearPendingVerification()` — resets the state field.
   - Initial state: `pendingVerificationEmail: null` in the store body.

### `client/src/lib/api/auth.ts` (deviation — see below)

- Added `email?: string` to the `ApiError` interface.

## TokenPair narrowing approach (the 4 pre-existing tsc errors)

The 4 errors (`string | undefined` not assignable to `string` at the `set()`/`persistTokens()` call sites, since `RegisterResponse extends Partial<TokenPair>`) were confirmed before the fix (tsc exit 1).

Attempted narrowing order:

1. **Brief's Step 2 early return alone** — does NOT satisfy tsc. After `if (res.verification_required) return;`, the narrow leaves `verification_required` as `false | undefined`, so TS cannot infer tokens are present. (Never applied alone.)
2. **Non-null assertion object** — `const newTokens = { access_token: res.access_token!, refresh_token: res.refresh_token! }` — satisfied tsc but was flagged by **biome** `lint/style/noNonNullAssertion` (2 warnings).
3. **CHOSEN: explicit cast** — `const pair = res as TokenPair;` placed immediately after the early return, with a comment noting tokens are guaranteed by the server contract once verification isn't required. `pair` is then used directly in both `set({ tokens: pair, ... })` and `persistTokens(pair)`, mirroring how `refresh()`/`oauthStartFlow()` treat their token objects.

Biome has no rule against `as` casts in its recommended set, so this passes cleanly. Behavior is identical to the original `RegisterResponse` handling.

## Deviations from the brief

1. **`ApiError.email` added in `auth.ts`** — the brief's AuthApiError description says `apiError: { code, message, requestId?, email? }`, but Task 12's `ApiError` interface lacks `email`, so `err.apiError.email` would not typecheck. Added `email?: string` to the shared interface (mirrors server contract documented in commit `a363294`: "403 verification_required carries email inside error payload"). Task scope nominally lists only `authStore.ts`, but this 1-line type addition was unavoidable; it cannot affect runtime.

2. **`AuthApiError` imported as a value, not `type`** — the brief's import block shows `type AuthApiError`, but `err instanceof AuthApiError` requires a runtime value import; a type-only import would fail `tsc`.

3. **TokenPair narrowing via cast instead of `!`** — see above; biome's `noNonNullAssertion` (recommended preset) rejected the `!` approach.

4. **Quote/semicolon style** — the brief says "single quotes, no semicolons", but the actual `biome.json` (2.5.5) specifies double quotes + semicolons; the existing file is double-quote/no-semicolon and passes `pnpm biome check` as-is. Matched the existing file's actual accepted style; no reformatting was needed.

## Commands + output

```bash
# Baseline (before fix)
npx tsc --noEmit          # exit 1 — 4 errors (string | undefined → string) at authStore.ts:208,209,218,219
pnpm biome check src/stores/auth/authStore.ts  # exit 0

# After edits
npx tsc --noEmit          # exit 0
pnpm biome check src/stores/auth/authStore.ts src/lib/api/auth.ts  # exit 0, no fixes applied
pnpm biome check .        # exit 1 — 7 pre-existing errors in unrelated files
                          # (HostForm.tsx ×4, TerminalTab.tsx, KeyboardSettings.tsx, ContextMenu.tsx, FileGridItem.tsx,
                          #  login/registerFormSchema.ts, TerminalTab.tsx) — none in the files touched by this task
pnpm vitest run           # 3 files, 38 tests, all passed (exit 0)
```

## Commit

```
1a860fb feat: pending verification state and verify/resend actions
2 files changed, 85 insertions(+), 7 deletions(-)
```

## Notes for Task 14

- `verifyEmail` takes an optional `password`; the OTP panel must pass the login/register form's password through for the keychain entry to be armed after verification.
- On `VERIFICATION_REQUIRED` from **login**, the store sets `pendingVerificationEmail` from the server error payload's `email` (fallback to the typed email).
- `register()` success-after-verification (`verifyEmail`) does NOT set `pendingRecoveryCode` — if Task 14 wants the recovery-code banner post-verification, that's an additional state transition to consider.

---

## Fix Round 1 (reviewer findings)

**Status:** DONE
**Commit:** `1a860fb` → (fix commit below)

### Finding 1 (important): `teardownSession()` omits `pendingVerificationEmail: null`

`useAuthStore.setState({...})` in `teardownSession()` reset user/tokens/isAuthenticated/isUnlocked/pendingOAuth but not `pendingVerificationEmail`. A user who hit VERIFICATION_REQUIRED and then logged out (or whose `refresh()`/`restoreSession()` failed → teardown) would keep the stale OTP panel state across sessions. Fixed by adding `pendingVerificationEmail: null` to the `setState` reset.

### Finding 2 (minor): `login()` success doesn't clear `pendingVerificationEmail`

If the OTP panel is up and the user logs in successfully (e.g., account verified on another device), the stale `pendingVerificationEmail` persisted into the authenticated session. Fixed by adding `pendingVerificationEmail: null` to `login()`'s success `set({...})`.

### Commands + output

```bash
npx tsc --noEmit                                             # exit 0
pnpm biome check src/stores/auth/authStore.ts                # exit 0, no fixes applied
pnpm vitest run                                              # 3 files, 38 tests, all passed (exit 0)
```

### Commit

```
c60b15a fix: clear pending verification state on teardown and login
```
