# Signed Desktop Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TermVault's inert updater UI with signed GitHub Releases updates on Windows, macOS, and Linux AppImage, plus manual release links for `.deb` installs.

**Architecture:** A native installation-kind command and Tauri updater/process plugins support a small client update service and Zustand state machine. A tag-driven monorepo workflow builds signed desktop artifacts, validates them, constructs `latest.json`, and publishes the release only after all required outputs exist.

**Tech Stack:** Tauri v2 updater/process plugins, React, Zustand, Vitest, Node built-in test runner, GitHub Actions, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-02-desktop-updater-design.md`

## Global Constraints

- Work in the existing `main` branches and working directory; create no worktree or branch.
- Do not commit or push until the user explicitly asks. This overrides the skill's usual commit steps.
- Use `pnpm`, never npm. Do not print or commit signing private material.
- Update checks do not depend on login, vault state, or the TermVault server.
- The first updater covers Windows x64, macOS x64/arm64, and Linux x64 AppImage; `.deb` opens the GitHub Release page.
- Tauri signature verification and HTTPS are mandatory; no unsigned or insecure fallback.
- Do not publish a real release during implementation.

## Review Focus

- A `.deb` process sees a new version but never attempts to install an AppImage: test in Task 2.
- An unavailable network or malformed manifest leaves the current app usable and permits retry: test in Task 2.
- A second click during check/download/install cannot start duplicate native operations: test in Task 2.
- A missing `.sig` or platform asset prevents publication of `latest.json`: test in Task 4.
- A release tag and Tauri version mismatch fails before building/publishing: test in Task 4.

---

### Task 1: Native updater foundation and installation detection

**Files:**
- Modify: `client/src-tauri/Cargo.toml`, `client/src-tauri/Cargo.lock`, `client/src-tauri/src/lib.rs`
- Create: `client/src-tauri/src/update.rs`
- Modify: `client/src-tauri/capabilities/default.json`, `client/src-tauri/tauri.conf.json`

**Interfaces:**
- Produces: Tauri command `update_installation_kind() -> Result<String, String>` returning `development`, `appimage`, `package`, or `native`.
- Produces: updater/process plugin availability to the main window; updater artifacts enabled in release builds.

- [ ] **Step 1: Write Rust tests for installation classification.** A Linux process with `APPIMAGE` set returns `appimage`; Linux without it returns `package`; non-Linux desktop returns `native`; debug mode returns `development`. Factor a pure classifier so tests do not mutate process environment.
- [ ] **Step 2: Run `cargo test --no-default-features --lib update::tests` and observe red.**
- [ ] **Step 3: Implement the classifier and command**, register it in the Tauri invoke handler, initialize `tauri-plugin-updater` and `tauri-plugin-process`, and grant only needed ACL permissions.
- [ ] **Step 4: Generate a new Tauri updater key pair with `pnpm tauri signer generate --ci --write-keys <secure path outside repo>`; use only its public key in `tauri.conf.json`.** Put the private key in a local user-owned path with restrictive permissions for GitHub secret provisioning, never in source, tool output, or logs. Replace the placeholder endpoint with `https://github.com/nhridoy/terra/releases/latest/download/latest.json`; set `bundle.createUpdaterArtifacts` to `true`.
- [ ] **Step 5: Run the focused Rust tests and `cargo check --no-default-features`; confirm the configuration parses.**

### Task 2: Update service and state transitions

**Files:**
- Create: `client/src/lib/update/updateService.ts`
- Modify: `client/src/stores/update/updateStore.ts`
- Create: `client/src/stores/update/updateStore.test.ts`

**Interfaces:**
- Consumes: `update_installation_kind` from Task 1; JS `check()`/`Update.download()`/`Update.install()` and `relaunch()`.
- Produces: `checkForUpdates(manual?: boolean)`, `downloadUpdate()`, `installUpdate()`, `openReleasePage()` and state `status`, `installationKind`, `updateInfo`, `downloadProgress`, `error`, `releaseUrl`.

- [ ] **Step 1: Write failing Vitest cases** for no update, available update metadata, offline/malformed response, retry, duplicate suppression, progress with unknown content length, download/install failure, development build, `.deb` release link, and unsupported target. Mock the service boundary, not Zustand internals.
- [ ] **Step 2: Run `pnpm vitest run src/stores/update/updateStore.test.ts` and observe red.**
- [ ] **Step 3: Implement the service boundary** around Tauri APIs and a store state machine (`idle`, `checking`, `available`, `downloading`, `ready`, `installing`, `error`, `unsupported`). Keep the native `Update` handle until install/disposal; never download in a `.deb` process. Manual checks surface errors and “up to date”; automatic checks remain quiet unless a new version is available.
- [ ] **Step 4: Run focused tests, TypeScript check, and Biome; fix failures.**

### Task 3: Mount and finish the update UI

**Files:**
- Modify: `client/src/App.tsx`, `client/src/components/update/UpdateNotification.tsx`, `client/src/components/settings/tabs/AdvancedTab.tsx`
- Test: `client/src/components/update/UpdateNotification.test.tsx` if the existing test environment supports React rendering; otherwise test behavior through Task 2 and type/build checks.

**Interfaces:**
- Consumes: Task 2 store actions and statuses.
- Produces: startup check, manual settings check, version/notes/progress prompt, release-page action for package builds, and separate download/install actions.

- [ ] **Step 1: Add UI test(s)** for available update, download progress, ready-to-install state, error/retry, and `.deb` release-link action if React rendering is already available.
- [ ] **Step 2: Run focused test(s) and observe red.** If the repo has no React test renderer, record that and use store tests plus type/build verification rather than adding a new test dependency solely for a mirrored component test.
- [ ] **Step 3: Mount the notification once, trigger one quiet startup check, and add manual check in Settings.** Show date only when present; use “Restart & install” only after download verification; prevent dismissal during install; keep current app usable on errors.
- [ ] **Step 4: Run focused tests, `pnpm exec tsc --noEmit`, `pnpm biome check .`, and `pnpm build`.**

### Task 4: Deterministic signed release publication

**Files:**
- Modify: `.github/workflows/release.yml`
- Create: `scripts/build-update-manifest.mjs`, `scripts/build-update-manifest.test.mjs`
- Modify: `docs/FEATURE_GAP_AUDIT.md`
- Create: `docs/UPDATER_RELEASE_RUNBOOK.md`

**Interfaces:**
- Consumes: Task 1's public key/endpoint and Tauri-signed bundle outputs.
- Produces: `latest.json` with `version`, optional notes/date, and `platforms` entries for `linux-x86_64`, `windows-x86_64`, `darwin-x86_64`, `darwin-aarch64`; each entry has HTTPS asset URL and literal `.sig` contents.

- [ ] **Step 1: Write failing Node tests** for manifest construction from fixture assets, missing signature/bundle, missing required architecture, invalid signature text, unsafe asset names, and tag/version mismatch.
- [ ] **Step 2: Run `node --test scripts/build-update-manifest.test.mjs` and observe red.**
- [ ] **Step 3: Implement the manifest script** using only Node built-ins. Reject incomplete or mismatched artifacts; write the manifest atomically only after full validation.
- [ ] **Step 4: Rework `release.yml`** to fetch the exact submodule gitlinks using a scoped `SUBMODULE_READ_TOKEN`, enforce version equality, build server and signed desktop matrix outputs with pnpm, collect artifacts, validate/build manifest, then publish the GitHub Release. Keep it draft until the final validation succeeds; fail closed if `TAURI_SIGNING_PRIVATE_KEY` or any required secret is absent. Do not print secrets.
- [ ] **Step 5: Document one-time secret provisioning, Windows/macOS OS-signing prerequisites, tag/version convention, manual smoke test, and rollback procedure in the runbook.** Update G06 status to implemented pending live signed-release verification.
- [ ] **Step 6: Run Node tests, YAML syntax validation if available, `git diff --check`, and the full Rust/frontend checks.** Inspect the release workflow's matrix and artifact names against real Tauri output conventions.

### Final review

- [ ] Review all changes against the spec and confirm no private key or GitHub token entered Git.
- [ ] Confirm client and monorepo status, list exactly what remains for live release verification, and report uncommitted changes. Do not commit or push without a new explicit user request.
