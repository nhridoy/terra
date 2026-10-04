# Terra Product Identity Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename active desktop, server, and release identities to Terra while preserving server account/data compatibility and keeping TermVault local state separate.

**Architecture:** Give the desktop a new Terra bundle identity, database/keychain namespace, and updater feed. Rename server package and release identifiers while keeping `/api/v1`, persisted/wire/cryptographic formats, existing database location, and server account data stable; accept legacy server environment variables as fallbacks. Update active root workflows and operational documentation after both submodules have the new identities.

**Tech Stack:** Tauri 2, Rust/Cargo, React/Vite/pnpm, Go/GORM, GitHub Actions, Node.js release-manifest script, GHCR.

**Spec:** `docs/superpowers/specs/2026-10-04-terra-product-identity-rename-design.md`

## Global Constraints

- New desktop bundle identifier: `com.nhridoy.terra`.
- New server module and image: `github.com/nhridoy/terra-server` and `ghcr.io/nhridoy/terra-server`.
- New local desktop database name: `terra.db`; use separate Terra app-support and keychain service namespaces and do not migrate TermVault-local state.
- Preserve the server default database file `termvault.db`, existing `DATABASE_URL` behavior, API routes/payloads, database schema/table names, and encrypted payload formats.
- Server config precedence: non-empty Terra value, then its exact current legacy alias (`TERMVAULT_PORT`, `TERMVAULT_HOST`, `APP_SCHEME`, or `TERMVAULT_OAUTH_REDIRECT_URIS`), then documented default. Keep legacy aliases for this release.
- Continue loopback OAuth callbacks; do not add a custom URI handler.
- Publish the updater manifest as `terra-latest.json`, use Terra-named desktop assets, and preserve the existing uncommitted updater public-key edit in `client/src-tauri/tauri.conf.json`.
- Do not rename sync event names, crypto/AAD domains, key format labels, CSS selectors, or persisted/wire identifiers merely because they contain `termvault`.
- Keep mobile/App Store identifiers out of scope. Keep dated audit/spec/plan history as historical records; update current operational docs and manual test instructions.
- Work in the existing branch and preserve all user changes. Do not commit or push unless the user explicitly requests it.

## Review Focus

- Existing TermVault client data must remain untouched and Terra must open a different local database; Task 1 verifies Terra path/keychain isolation and preserves the current TermVault database constant at the server.
- Terra must log into existing accounts and decrypt/sync existing server data; Tasks 2 and 3 preserve wire and crypto identifiers, and Task 6 runs client/server compatibility checks.
- Conflicting Terra and legacy environment values must resolve deterministically; Task 3 tests Terra-over-legacy, legacy-only, and default precedence.
- An older TermVault updater must not consume the Terra release manifest; Task 4 asserts the new manifest filename and Terra-only URLs while preserving signature validation.
- OAuth must still complete via its existing loopback flow; Tasks 3 and 6 cover allowed callback configuration and existing redirect behavior.

---

### Task 1: Give the desktop a Terra installation and local-storage identity

**Files:**
- Modify: `client/src-tauri/tauri.conf.json`
- Modify: `client/src-tauri/Cargo.toml`
- Regenerate: `client/src-tauri/Cargo.lock`
- Modify: `client/src-tauri/src/lib.rs`
- Modify: `client/src-tauri/src/db.rs`
- Inspect and modify only if an app-owned service/path label exists: `client/src/lib/keychain/keychain.ts` and related keychain/store initialization files
- Test: Rust unit tests in `client/src-tauri/src/db.rs` or a focused path helper test in `client/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: current Tauri path resolver, `db::DB_FILE_NAME`, and keychain plugin service naming.
- Produces: bundle/product/binary names `Terra` and `com.nhridoy.terra`; local DB constant `terra.db`; Terra-only app-support/device-ID path and keychain service namespace. Keep the Rust library target name `app_lib` unchanged because the binary depends on it.

- [ ] **Step 1: Add a focused test for the new local DB name and Terra path derivation.** Assert the filename equals `terra.db`, and the device ID/app-support path ends in the Terra namespace rather than `termvault`.
- [ ] **Step 2: Run the focused test and confirm it fails against current identity values.** Run `cd client/src-tauri && cargo test db::tests` (or the exact new test filter); expected failure references the old filename/path.
- [ ] **Step 3: Rename Tauri product, main binary, and bundle identifier.** Set `productName` and `mainBinaryName` to `Terra`, `identifier` to `com.nhridoy.terra`, and update the configured window title. Preserve the currently edited updater `pubkey` value while changing only the updater endpoint to `https://github.com/nhridoy/terra/releases/latest/download/terra-latest.json`.
- [ ] **Step 4: Rename application-owned Rust package and local namespaces.** Change Cargo package `termvault` to `terra`, regenerate `Cargo.lock`, use `terra.db`, and replace only app-owned app-support/device-ID/keychain service labels. Leave `app_lib` and cryptographic/domain values untouched.
- [ ] **Step 5: Run the focused test and Rust checks.** Run `cd client/src-tauri && cargo test db::tests && cargo test`; expected all pass. Run `cargo tauri info` from `client` to confirm the Tauri config parses and reports Terra identity.

### Task 2: Rename desktop-facing product text and frontend package

**Files:**
- Modify: `client/package.json` and `client/pnpm-lock.yaml`
- Modify: `client/index.html`, `client/splashscreen.html`, and `client/README.md`
- Modify: active branding references in `client/src/pages/auth/{SetupPage,RegisterPage,RecoveryPage,LoginPage}.tsx`, `client/src/components/layout/shell/TitleBar.tsx`, `client/src/components/auth/UnlockDialog.tsx`, `client/src/components/settings/tabs/SecurityTab.tsx`, `client/src/lib/recovery/recoveryKit.ts`, and `client/src-tauri/src/oauth.rs` / `client/src-tauri/src/lib.rs`
- Modify: `client/src/components/settings/tabs/AdvancedTab.tsx` and `client/src/components/teams/managers/RevokedTeamEditsPanel.tsx` for exported product filenames/formats if they are user-facing exports
- Test: existing frontend test suite; add focused recovery filename assertion if one does not exist

**Interfaces:**
- Consumes: Terra app identity from Task 1.
- Produces: frontend package name `terra` and consistent Terra branding in active product UI, OAuth callback page/error text, exported recovery kit/settings labels, and active frontend README.

- [ ] **Step 1: Add or update a focused test for the recovery-kit display label and filename.** Assert the exported label and filename use Terra.
- [ ] **Step 2: Run the focused frontend test and confirm it fails on the old TermVault label/name.** Run `cd client && pnpm vitest run src/lib/recovery` with the exact test path.
- [ ] **Step 3: Rename the frontend package to `terra` and refresh the lockfile.** Run `cd client && pnpm install --lockfile-only` and verify no dependency versions change unnecessarily.
- [ ] **Step 4: Update active product text and user-export names.** Replace visible TermVault branding with Terra; rename user-created file labels to Terra. Preserve event strings such as `termvault:local-mutation`, `termvault:sync-completed`, and `termvault:recording-change`, plus CSS class names and serialized format values.
- [ ] **Step 5: Run frontend checks.** Run `cd client && pnpm vitest run && pnpm biome check . && pnpm build`; expected tests, lint, and production build pass.

### Task 3: Rename the server module and add tested legacy configuration fallbacks

**Files:**
- Modify: `server/go.mod` and regenerate `server/go.sum` only if module graph changes
- Modify Go import paths throughout `server/**/*.go`
- Modify: `server/internal/config/config.go` and `server/internal/config/config_test.go`
- Modify: `server/cmd/termvault-server/main.go` (rename directory/package path to `server/cmd/terra-server/main.go` if all workflow and local run references are updated in this task)
- Modify: `server/internal/email/sender.go`
- Test: `server/internal/auth/oauth_test.go` only if the default app scheme/redirect fallback expectations change

**Interfaces:**
- Consumes: current `config.Config` fields and `getEnv` helper.
- Produces: Go module `github.com/nhridoy/terra-server`; server config accepts `TERRA_PORT`, `TERRA_HOST`, `TERRA_APP_SCHEME`, and `TERRA_OAUTH_REDIRECT_URIS`, with legacy aliases `TERMVAULT_PORT`, `TERMVAULT_HOST`, current `APP_SCHEME`, and `TERMVAULT_OAUTH_REDIRECT_URIS`, respectively; default app scheme `terra`; binary entry point `./cmd/terra-server`. Keep database default exactly `sqlite://termvault.db` and continue opening `termvault.db` when unset.

- [ ] **Step 1: Add table-driven config tests for precedence.** Cover Terra+legacy (Terra wins), legacy-only, and neither-set default for port, host, app scheme, and OAuth redirect allowlist; test `APP_SCHEME` as the current app-scheme fallback; isolate env variables using `t.Setenv` and ensure dotenv/test state cannot leak.
- [ ] **Step 2: Run those tests and confirm they fail on current config.** Run `cd server && go test ./internal/config -run 'TestLoadTerra|TestLoadLegacy' -count=1`.
- [ ] **Step 3: Implement deterministic alias lookup and new config defaults.** Terra variables take priority when non-empty; otherwise use corresponding legacy variable (`APP_SCHEME` for `TERRA_APP_SCHEME`); otherwise use current defaults except app scheme becomes `terra`. Keep `DATABASE_URL` untouched and preserve the `termvault.db` fallback in `cmd` startup.
- [ ] **Step 4: Rename Go module/import path and command directory/binary identity.** Set module to `github.com/nhridoy/terra-server`, update imports with `go mod tidy`, move command entry point to `cmd/terra-server`, and change API root response/email subject to Terra.
- [ ] **Step 5: Update OAuth/config regression assertions.** Keep loopback callback validation unchanged; test that callback URLs continue to be loopback URLs and that the Terra app-scheme fallback does not broaden allowed callbacks.
- [ ] **Step 6: Run server checks.** Run `cd server && go test ./... && go vet ./... && go build -o /tmp/terra-server ./cmd/terra-server`; expected all succeed and the output binary is `/tmp/terra-server`.

### Task 4: Point active release and updater workflows at Terra artifacts

**Files:**
- Modify: `.github/workflows/release.yml`, `.github/workflows/server-ci.yml`, `.github/workflows/client-ci.yml`, and `.github/workflows/ci.yml`
- Modify: `scripts/build-update-manifest.mjs` and `scripts/build-update-manifest.test.mjs`
- Test: `scripts/build-update-manifest.test.mjs`

**Interfaces:**
- Consumes: Terra desktop bundle names/config from Tasks 1–2 and server binary/module from Task 3.
- Produces: Terra-named release bundles, `terra-server-linux-amd64.tar.gz`, GHCR image `ghcr.io/${{ github.repository_owner }}/terra-server`, and `terra-latest.json` with Terra asset URLs. Keep the current repo URL `nhridoy/terra` and signature-verification behavior.

- [ ] **Step 1: Update updater manifest fixtures and add a manifest-name assertion.** Use Terra bundle names for AppImage, Windows installer, and both macOS archives; assert output filename is `terra-latest.json`, URLs use Terra-named files, every required platform remains present, and signature bytes remain literal/validated.
- [ ] **Step 2: Run the manifest tests and confirm the new assertion fails.** Run `node --test scripts/build-update-manifest.test.mjs`.
- [ ] **Step 3: Rename manifest builder temporaries/output and updater endpoint integration.** Stage Terra-prefixed verification temp dirs and write `terra-latest.json`; continue checking all four desktop platform bundles/signatures and reject missing/ambiguous artifacts as before.
- [ ] **Step 4: Rename the release server artifact and command.** Build `./cmd/terra-server` to `terra-server`, package `terra-server-linux-amd64.tar.gz`, and upload/copy that exact filename.
- [ ] **Step 5: Update container image names and active workflow artifact labels.** Push GHCR `terra-server:latest` and `terra-server:<version>`; align client/server CI binary/artifact names. Do not change app-store identifiers or the historical Docker Hub workflow's credentials/behavior unless that workflow is already used for current product releases.
- [ ] **Step 6: Run workflow-focused checks.** Run `node --test scripts/build-update-manifest.test.mjs` and validate changed YAML with a parser already available in the repository or `actionlint` if installed; expected manifest test passes and workflow YAML parses.

### Task 5: Update active product and deployment documentation

**Files:**
- Modify: root `README.md`
- Modify: `docs/FIRST_RELEASE_SIGNING_GUIDE.md` and `docs/UPDATER_RELEASE_RUNBOOK.md`
- Modify: active manual verification docs `docs/SYNC_MANUAL_VERIFICATION.md`, `docs/TEAMS_MANUAL_VERIFICATION.md`, `docs/JUMP_HOST_MANUAL_VERIFICATION.md`, and `docs/CUSTOM_TITLE_BAR_MANUAL_VERIFICATION.md`
- Modify: active server/client readme and environment-variable setup docs, if present
- Preserve: `docs/FEATURE_GAP_AUDIT.md` and dated `docs/superpowers/specs/*` / `plans/*` as historical records

**Interfaces:**
- Consumes: final identifiers and env-variable aliases from Tasks 1–4.
- Produces: current setup/release instructions that consistently call the product Terra, show Terra server env vars and image/binary names, explain legacy server aliases for the first release, and explain that Terra local data is separate while server accounts/encrypted data remain compatible.

- [ ] **Step 1: Update root product and setup instructions.** Rename title/product instructions and commands to the Terra module/binary and image while retaining server DB filename `termvault.db` in data-preservation notes.
- [ ] **Step 2: Update release/signing runbooks.** Document the `terra-latest.json` endpoint, Terra artifact names, Terra GHCR package, Terra app updater public key/private-key secret pairing, and that a new Terra local app identity creates a fresh installation.
- [ ] **Step 3: Update currently used manual-test instructions and server env docs.** Replace user-facing app branding; document `TERRA_PORT` → `TERMVAULT_PORT`, `TERRA_HOST` → `TERMVAULT_HOST`, `TERRA_APP_SCHEME` → existing `APP_SCHEME`, and `TERRA_OAUTH_REDIRECT_URIS` → `TERMVAULT_OAUTH_REDIRECT_URIS` fallback precedence. Keep old DB filename references where they identify existing server data.
- [ ] **Step 4: Review remaining product-name hits in active files.** Run `rg -n -i 'termvault|TERMVAULT_|com\.termvault' README.md docs .github client server scripts` and classify each remaining match as compatibility alias/data format/historical/mobile-out-of-scope or missed rename; make no destructive mass replacement.

### Task 6: Cross-repository compatibility and identity verification

**Files:**
- No new files unless a failed compatibility assertion exposes a missing focused regression test; fix the owning task's file instead.

**Interfaces:**
- Consumes: final desktop/server/workflow/docs changes from Tasks 1–5.
- Produces: verified local builds and tests, a remaining-identifier classification, and a manual verification checklist for installation coexistence, OAuth, sync/decryption, and updater separation.

- [ ] **Step 1: Run client verification.** Run `cd client && pnpm vitest run && pnpm biome check . && pnpm build && cargo test --manifest-path src-tauri/Cargo.toml`; expected all pass.
- [ ] **Step 2: Run server verification.** Run `cd server && go test ./... && go vet ./... && go build -o /tmp/terra-server ./cmd/terra-server`; expected all pass.
- [ ] **Step 3: Run release manifest verification and inspect the updater config.** Run `node --test scripts/build-update-manifest.test.mjs`; inspect `client/src-tauri/tauri.conf.json` to verify Terra endpoint, Terra public-key value (including the user's existing edit), new identifier, and no private signing material.
- [ ] **Step 4: Verify the compatibility boundary statically.** Confirm `/api/v1`, default server DB filename, DB schema/table names, sync event strings, crypto/AAD labels, and server encrypted payload fields are unchanged. Record remaining identifier matches by category.
- [ ] **Step 5: Produce a manual coexistence checklist.** Include: install/run TermVault and Terra side by side; confirm separate app-data/database/keychain identities; verify old local TermVault data is unchanged; sign into an existing account on Terra and verify vault decrypt/sync/team access; exercise loopback OAuth; confirm updater clients request only their own manifest and validate signatures; verify existing server DB opens with no migration.
- [ ] **Step 6: Leave all work uncommitted and unpushed pending the user's separate instruction.** Report changed files/submodules and checks; do not create commits or publish releases.
