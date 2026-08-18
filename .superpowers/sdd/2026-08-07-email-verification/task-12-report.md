# Task 12 Report: Client API layer (verify-email / resend)

## Status
DONE_WITH_CONCERNS

## Changes
File: `client/src/lib/api/auth.ts` (+21, -1)

**Step 1 — Types** (after `RegisterResponse` at former line 187):
- `RegisterResponse` changed from `extends TokenPair` to `extends Partial<TokenPair>` and gained `verification_required?: boolean` (server now returns 201 without tokens when verification is required).
- Added `VerifyEmailResponse extends TokenPair { user: User; keyring?: KeyringRows }`.

**Step 2 — Methods** (inside `authApi`, after `register`):
- `verifyEmail(params: { email; otp; device_id }): Promise<VerifyEmailResponse>` → POST `/api/v1/auth/verify-email`
- `resendVerification(email: string): Promise<{ verification_required: boolean }>` → POST `/api/v1/auth/resend-verification`

Both use the existing `apiFetch` helper verbatim per the brief.

## Commands + Output
- `npx tsc --noEmit` (client/) → **exit 2** (see Concerns). Errors confined to `src/stores/auth/authStore.ts` lines 208, 209, 218, 219 — all `string | undefined` not assignable to `string` on `res.access_token` / `res.refresh_token`.
- `pnpm biome check src/lib/api/auth.ts` → clean, no fixes applied (single quotes, no semicolons, 2-space indent all conform).
- Commit: `git add client/src/lib/api/auth.ts` → `git commit -m "feat: client api for verify-email and resend"` → succeeded.

## Commit
`e0bb241` — feat: client api for verify-email and resend (1 file changed, 21 insertions, 1 deletion)

## Deviations
None. Code used verbatim from the brief.

## Concerns
1. **`npx tsc --noEmit` exit 2 (expected)** — `RegisterResponse extends Partial<TokenPair>` makes `res.access_token`/`res.refresh_token` `string | undefined`. Existing consumers in `authStore.register` (`src/stores/auth/authStore.ts:208-219`) still access them directly and now fail typecheck. Per the brief, authStore was NOT touched — Task 13 must update it to branch on `verification_required` and only persist tokens when present. Typecheck will stay red until then.
2. Minor: git reports LF→CRLF line-ending conversion on commit (pre-existing repo behavior, no action taken).
