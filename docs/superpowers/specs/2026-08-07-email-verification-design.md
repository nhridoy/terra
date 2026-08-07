# Email Verification for Password Signups — Design

Date: 2026-08-07

## Goal

Require new email/password signups to verify their email address before the account can receive access or refresh tokens. Feature is opt-in via a single env toggle off by default. Does not apply to OAuth signups.

## Toggle & email config

| Variable | Description | Default |
|----------|-------------|---------|
| `REQUIRE_EMAIL_VERIFICATION` | `true`/`1`/`yes` enables verification for password signups | `false` (off) |
| `SMTP_HOST` | SMTP server hostname | empty |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` | SMTP auth username | empty |
| `SMTP_PASSWORD` | SMTP auth password | empty |
| `SMTP_FROM` | From address for verification emails | empty |

- Parsing of `REQUIRE_EMAIL_VERIFICATION` is strict: accepted values `true`, `1`, `yes` (case-insensitive); anything else / unset = disabled.
- If verification is enabled but `SMTP_HOST` is empty, the server **logs the OTP to console** instead of sending (`[email-dev] verification code for <email>: 123456`). This keeps dev/test flows working without an SMTP server.
- Email delivery uses stdlib `net/smtp` (no new dependency). When `SMTP_USERNAME` is empty, send is skipped and the code is logged.
- OAuth users and OAuth-setup (`Initialized` transition) users are exempt: on account creation via OAuth, `email_verified_at` is set to now (provider already confirms the address).

## Data model

- `users.email_verified_at *time.Time` — `NULL` means not verified. Added via GORM AutoMigrate (no migration files). Mirrored into the client DB model (`db.rs`) for parity only; not used in client logic.
- Verification codes reuse the existing `auth_codes` table with `Purpose = "email_verify"`:
  - `CodeHash` = `sha256(hex(code))` — OTP is never stored in plaintext.
  - `UserID`, `ExpiresAt` (15 min), `UsedAt` (single-use), `CreatedAt`.
  - **One live row per user, never more.** Re-issue (resend / register retry) does `DELETE FROM auth_codes WHERE user_id = ? AND purpose = 'email_verify'` then inserts a fresh row. Successful verification deletes the row. The table therefore holds at most one `email_verify` row per user at any time — no revocation accumulation, bounded lookups, no cleanup jobs.

## Server behavior

### Register (`POST /api/register`)
- Verification **off**: unchanged, tokens returned.
- Verification **on**: both the new-user path and the existing-user idempotent re-issue path respect the gate — while `email_verified_at IS NULL` the handler never mints tokens. It generates a fresh OTP (or re-emails the still-valid active one), persists keyring + vaults (new-user path), and responds **201** with:
  ```json
  { "verification_required": true, "user": {...} }
  ```
  **No `access_token` / `refresh_token` fields are returned.** Spec: the register response must never contain tokens while the account is unverified.

### Login (POST /api/login)
- After successful proof (`HandleLogin`): if verification is on AND `AuthProvider = "password"` AND `email_verified_at IS NULL` → respond **403** `VERIFICATION_REQUIRED` with the user's email so the client can prefill the OTP screen:
  ```json
  { "error": { "code": "VERIFICATION_REQUIRED" }, "email": "..." }
  ```
  Do **not** update `last_login_at`, do not mint tokens.
- Verified / verification off: unchanged.

### Verify (POST /api/verify-email) — new, unauthenticated
Request: `{ "email": ..., "otp": ..., "device_id": ... }`
- Look up the user's live `email_verify` code (`UsedAt IS NULL` + `ExpiresAt > now`).
- Constant-time compare (deliberately not revealed-length-risk-friendly: reject on mismatch), cap at **5 attempts** per code — on the 5th failed attempt the code is deleted, client asked to resend.
- Success: set `users.email_verified_at = now`, **delete** the code row (consumed — deletion is the single-use enforcement), then issue tokens exactly like register today:
  ```json
  { "access_token": ..., "refresh_token": ..., "user": ... }
  ```
  (This is the single point where an accounts transitions to verified, so returning tokens here is valid — after this call the account IS verified.)
- Failures: invalid/expired/used/exhausted code → **400** `INVALID_VERIFICATION_CODE` (attempts-exhausted and expired get a distinct message so the client can auto-trigger resend).

### Resend (POST /resend-verification) — unauthenticated
- Request: `{ "email": ... }`, Response: `{ "verification_required": true }`.
- Rate limited with the auth bucket (`RATE_LIMIT_AUTH`). Enforces a per-user 60s cooldown; within window returns `429 TOO_MANY_REQUESTS`.
- Deletes any existing `email_verify` row for the user and inserts a fresh 15-minute OTP (in-place replacement — old code becomes invalid immediately, no dead rows). Does **not** leak whether the email exists (uniform success).
- Server never sends tokens here; behavior identical for unknown emails.

### 403 body shape
Use the existing error envelope: `{ "error": { "code": "VERIFICATION_REQUIRED", "message": "verify your email" }, "email": "<email>" }`. The 403 (not 401) distinguishes "gate this account" from "bad credentials".

## Client flow

- `authStore.register()`: on `verification_required: true` → set `pendingVerificationEmail` (do **not** persist tokens, do **not** enter logged-in state).
- Auth screen renders one of: login form / register form / **OTP screen** when `pendingVerificationEmail` is set:
  - Shows the email, a 6-digit input, **Resend** (disabled 60s), **Back to login**.
- `login()` catches **403 VERIFICATION_REQUIRED** → sets `pendingVerificationEmail` from the response → OTP screen (email prefilled). This covers the user's requirement: any subsequent login attempt for an unverified account lands on the OTP page, and stays there until verification.
- `verifyEmail(email, code, deviceId)` → `POST /api/v1/verify-email` → on success persists tokens (same code path as register success) and clears `pendingVerificationEmail`. On `INVALID_VERIFICATION_CODE` shows inline error; on attempts-exhausted/expired shows "resend needed" and auto-resends.
- `resendVerificationEmail(email)` → POST, keeps OTP screen.
- `client/src/lib/api/auth.ts`: add `verifyEmail` / `resendVerification`, types for verification responses; `RegisterRequest` unchanged (fields unchanged).
- Logout / forced-logout: no change (wiping already covers unverified accounts — they have no tokens cached, keyring may exist locally but server never issued tokens).

## No-token invariant (the "as long as not verified, no tokens" rule)

Tokens are minted in exactly these handlers: `HandleLogin`, `HandleRegister`, `HandleVerifyEmail`, `HandlePasswordChange` (rotate), `HandleRefresh`, and OAuth exchange/setup. For password accounts:

- `HandleLogin` and `HandleRegister` short-circuit while `email_verified_at IS NULL` (login → 403; register → verification_required response with no tokens).
- `HandleRefresh`/`HandleLogout`: unverified accounts never hold a refresh token (never issued before verification), but as a defense-in-depth new refresh tokens are only minted against an existing live refresh row — which unverified accounts cannot obtain.
- `HandleVerifyEmail` only marks the account verified *and* issues tokens in the same successful call. OAuth flows exempt.

Result: no unverified password account can ever hold an access or refresh token.

## Testing

Server (`go test`):
- Config: default off; every accepted truthy value; reject garbage (off).
- Register w/ verification ON → 201, `verification_required`, no token fields in body.
- Register w/ verification OFF → unchanged (tokens).
- Login unverified → 403, `VERIFICATION_REQUIRED`, no tokens, no `last_login_at` write.
- Login verified → 200 tokens.
- Verify success → verified, code `UsedAt`, tokens; refresh usable.
- Verify wrong code → attempts decrement; 5th attempt deletes code.
- Verify expired → 400; verify after resend (old code) → 400; verify wrong email → 400.
- Resend → old row deleted, single fresh row; resend within 60s → 429; resend unknown email → generic success + 200; at most one `email_verify` row per user after repeated resends.
- OAuth register → verified by default.

Client (`vitest`):
- register returns `verification_required` → pending state, no tokens persisted.
- login 403 → pending email → OTP screen; verify success → logged-in tokens persisted; resend called.

## Security notes

- OTP: 6 decimal digits, 15-minute expiry, single-use, max 5 attempts, one active per user, sha256-hashed at rest, rate-limited endpoints (auth bucket), 60s resend cooldown.
- Constant-time verification of the code so early rejection doesn't leak position — on mismatch.
- No user enumeration via login (403 only for known+password user; unknown → 401 as today, email timing equalized in prelogin).
- OTP is delivered either by SMTP (TLS via STARTTLS) or console logs in dev; console logging is the documented dev fallback and no code ever leaks tokens.

## Files

- `server/internal/config/*`: parsing + tests
- `server/internal/email/*` (new): SMTP sender + console fallback sender, `Send(recipient, subject, body)` 
- `server/internal/codes/*`: otp generate, verify against `auth_codes`, attempt-cap same
- `server/internal/auth/handlers.go`: register gate, login gate, verify, resend
- `server/internal/models/user.go`: `email_verified_at`
- `server/internal/models/auth_code.go`: `Purpose` check
- `client/src/lib/api/auth.ts`, `client/src/stores/auth/authStore.ts`, auth screen OTP panel
- `AGENTS.md` + `server/.env.example` + `client/.env.example`: env table
- `docs/superpowers/specs/2026-08-07-email-verification-design.md` (this file)

## Open questions / non-goals

- Not in scope: sending flow email templates beyond one verification OTP; resend cooldown only touches verification.
- Not in scope: verifying existing unverified accounts historically (there are none today pre-feature).
- No separate "verify on login for OAuth" — exempt by design.