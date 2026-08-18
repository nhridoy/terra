### Task 16: Docs — env table + .env

**Files:**
- Modify: `AGENTS.md` (env tables)
- Modify: `server/.env` (new section)
- Modify: `client/.env` (no change expected — verify)

- [ ] **Step 1: Update AGENTS.md server env table**

Add rows after `TERMVAULT_OAUTH_REDIRECT_URIS`:

```markdown
| `REQUIRE_EMAIL_VERIFICATION` | Require OTP email verification for password signups (`true`/`1`/`yes`) | `false` (off) |
| `SMTP_HOST` | SMTP server hostname for verification emails (empty = OTP logged to console) | empty |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USERNAME` | SMTP auth username | empty |
| `SMTP_PASSWORD` | SMTP auth password | empty |
| `SMTP_FROM` | From address for verification emails | empty |
```

- [ ] **Step 2: Update server/.env**

Add before the Redis section:

```bash
# ── Email verification (optional) ────────────────────────────────────────────

# Require new email/password signups to verify their email with a 6-digit OTP.
# Accepted values: true / 1 / yes. Off by default.
REQUIRE_EMAIL_VERIFICATION=false

# SMTP server for sending verification emails. If SMTP_HOST is empty, the OTP
# is logged to the server console instead (dev mode).
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=
```

- [ ] **Step 3: Run full verification**

Run (server): `go vet ./... && go test ./... -count=1`
Run (client): `pnpm vitest run && npx tsc --noEmit && pnpm biome check .`
Run (tauri): `cd client/src-tauri && cargo check`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md server/.env
git commit -m "docs: email verification env vars"
```

---

## Self-review notes

- Spec coverage: toggle (T1), model (T2), delivery (T3), OTP lifecycle (T4), register gate (T5), login gate (T6), verify (T7), resend (T8), routes+rate limit (T9), OAuth exempt (T10), no-token invariant enforced across T5/T6/T7 (register/login never mint for unverified; only verify transitions state), client API (T12), store (T13), UI (T14), tests (T15), docs (T16).
- `ConstantTimeCompare` takes `[]byte, []byte` — verify handler passes `[]byte(code.CodeHash)`.
- `verifyEmail(email, otp, password?)`: pages hold the last-typed password and pass it through to arm the keychain entry (`savePassword`) only when provided; otherwise auto-unlock isn't armed and the user unlocks manually next launch.