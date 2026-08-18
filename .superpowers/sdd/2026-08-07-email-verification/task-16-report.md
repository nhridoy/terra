# Task 16 Report — Docs: env table + .env

**Status: DONE_WITH_CONCERNS**
**Commit:** `4974c1d docs: document email verification configuration`

## What was done

### Step 1 — AGENTS.md server env table
Added the 6 new rows after `TERMVAULT_OAUTH_REDIRECT_URIS` (last server-table row), exactly as specified in the brief:
`REQUIRE_EMAIL_VERIFICATION`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` — with descriptions/defaults verified against `server/internal/config/config.go` (`parseBoolEnv` accepts `true/1/yes`, SMTP_PORT default 587, all SMTP vars default empty → OTP logged to console). Client table untouched (verified: no client env vars were introduced by this feature).

### Step 2 — .env
**Deviation from brief, per task instructions:** `server/.env` was NOT modified (contains real credentials; dispatcher instruction: "Do NOT touch server/.env"). It turned out `server/.env.example` also did **not** exist in the repo (verified `git ls-files server | grep .env` — only `server/.env` is tracked). Resolution: created `server/.env.example` as the documented template:
- Full mirror of `server/.env` structure with all secrets blanked (`JWT_SECRET=`, `OAUTH_GOOGLE_*`/`OAUTH_GITHUB_*` empty).
- New `── Email verification (optional)` section inserted before the Redis section, exactly per the brief (comment text, `REQUIRE_EMAIL_VERIFICATION=false`, `SMTP_*` block).
- Not gitignored (`.env` pattern in .gitignore does not match `.env.example`), committed successfully.

### Step 3 — Verification (all green)
- Server: `go vet ./... && go test ./... -count=1` — OK (internal/auth 9.9s, config 1.7s, email 2.5s, models 3.3s; no test files in cmd).
- Client: `pnpm vitest run` — 47/47 passed, 4 files. `npx tsc --noEmit` — OK.
- Tauri: `cargo check` — finished OK (32 pre-existing warnings, 0 errors).
- Biome (`pnpm biome check .`, part of dispatcher's client checks): **7 pre-existing errors + 3 warnings** in untouched client files (ContextMenu.tsx, loginFormSchema.ts, registerFormSchema.ts, HostForm.tsx, KeyboardSettings.tsx, TerminalTab.tsx, FileGridItem.tsx). Working-tree diff before commit covered only `AGENTS.md`, so these failures pre-date this task and are unrelated to a docs-only change. Flagged below.

### Step 4 — Commit
```
4974c1d docs: document email verification configuration
```
Staged only `AGENTS.md` + `server/.env.example` (2 files, +96). `server/.env` not staged/modified.

## Concerns

1. **`server/.env` is committed to the repo** (pre-existing, predates this task — `git ls-files` shows it tracked) and contains real-looking secrets (JWT secret, Google/GitHub OAuth client IDs+secrets). This contradicts AGENTS.md's "never commit" rule. Remediation (remove from tracking/rotate secrets) was out of scope for a docs task — flagged for follow-up.
2. **Brief vs. reality mismatch:** the brief said "Update server/.env" and claimed `server/.env.example` existed. Neither applied — `.env.example` had to be created from scratch. If a different (e.g., `.env.local`-style) example was intended, adjust accordingly.
3. Pre-existing client lint failures (see Step 3) mean `pnpm biome check .` is not green on `ai`; not introduced by this task.