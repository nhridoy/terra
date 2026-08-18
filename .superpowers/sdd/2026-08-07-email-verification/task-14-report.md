# Task 14 Report — OTP entry panel component + page integration

Date: 2026-08-08
Commit: `0ec22a9` — `feat: otp entry panel on login and register pages`
Status: DONE

## Changes

### Created: `client/src/components/auth/forms/EmailVerification.tsx`
- Consumes `useAuthStore()`: `pendingVerificationEmail`, `verifyEmail(email, otp, password?)`, `resendVerification(email)`, `isLoading`, `error`, `clearError`.
- Props: `onBackToLogin: () => void`, `password?: string` (passed through to `verifyEmail` to arm the keychain entry).
- Local state: `otp` (digit-only, max 6 via `replace(/\D/g, "").slice(0, 6)`), `cooldown` (60s countdown with `setInterval`, cleared when reaching 0).
- Renders: heading + email, `Alert` on error, OTP field, Verify button (disabled unless 6 digits or loading, label "Verifying..." while loading), Resend button (disabled during cooldown, label "Resend code (Ns)"), "Back to sign in" button calling `onBackToLogin`.

### Modified: `client/src/pages/auth/LoginPage.tsx`
- Added `pendingVerificationEmail` + `clearPendingVerification` from store; `useState` for password pass-through (`setPassword(data.password)` in `onSubmit` before `login`).
- Card content wrapped: `{pendingVerificationEmail && <EmailVerification onBackToLogin={clearPendingVerification} password={password} />}` rendered first (per brief Step 2 — after the card's opening tag), existing content in `{!pendingVerificationEmail && (<>...</>)}`.
- Biome auto-fixes applied: import sorting, destructure reformatting, single-line h2.

### Modified: `client/src/pages/auth/RegisterPage.tsx`
- Same pattern as LoginPage (password pass-through from the form's `password` field).

## Verification (all from `client/`)

```
npx tsc --noEmit          → exit 0
pnpm biome check ...      → initial run flagged 5 fixable issues (import order, destructure
                            formatting); pnpm biome check --write fixed 3 files;
                            re-check clean, exit 0
pnpm vitest run           → 3 files, 38 tests, 38 passed (exit 0)
```

## Deviations from brief

1. **FormInput adaptation (NOTED in brief, applied):** `FormInput` is confirmed react-hook-form controller-bound (`FormBase` requires `control` — `client/src/components/ui/forms/FormBase.tsx:26`). Passing `control={undefined}` would crash the `Controller`. Per the brief's NOTE option (a), the component uses a plain `<input>` instead. Styling choice: reused the project's own `Input` component (`client/src/components/ui/Input.tsx`) — the exact component `FormInput` renders under the hood (`FormInput = (props) => <FormBase {...props}>{(field) => <Input {...field} />}</FormBase>`), so visual consistency with every other form field is guaranteed (`bg-dark-800 text-white px-3 py-2 text-sm rounded-lg focus:ring-primary-500`). The label wraps it in the same `Field`/`FieldContent`/`FieldLabel` layout (`client/src/components/ui/field.tsx`) used by `FormBase`, with `htmlFor="otp"` wired to the input id so the `noLabelWithoutControl` a11y lint passes without suppressions.
2. **Quotes:** repo config is double quotes + semicolons (biome), followed as instructed; brief's sketch had single quotes but was superseded by biome `--write`.
3. **Card nesting (minor, followed brief literally):** per brief Step 2, `EmailVerification` renders *inside* the existing `bg-dark-900 rounded-xl p-6 shadow-xl` card, and the component itself renders the same card classes — visually this is a nested card (inner p-6 within outer p-6). This is exactly what the brief specifies; if it looks off in QA, the fix would be moving the conditional outside the outer card div. Flagging as a cosmetic concern only.
4. **`email` fallback:** `pendingVerificationEmail ?? ""` kept from the sketch; on the login flow the store already sets it from the `verification_required` error payload (Task 13), and the OTP panel only renders when it's non-null.
