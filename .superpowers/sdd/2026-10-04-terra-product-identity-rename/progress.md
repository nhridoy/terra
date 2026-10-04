# SDD ledger — Terra product identity rename

Plan: `docs/superpowers/plans/2026-10-04-terra-product-identity-rename.md`  
Workspace: existing branch and submodules; no worktree or branch switch. No commits or pushes, per user instruction.

User-owned updater public key in `client/src-tauri/tauri.conf.json` was preserved while updating the Terra app identity and feed.

## Implementation status

- Desktop: Terra product/binary/package names, bundle ID `com.nhridoy.terra`, separate `terra.db` and local data namespace, Terra UI/export branding, and `terra-latest.json` updater feed are in place. Legacy server/wire/crypto identifiers are preserved where the approved design requires compatibility.
- Server: Go module/import paths and executable entry point are `github.com/nhridoy/terra-server` and `cmd/terra-server`; Terra env vars take precedence with existing aliases retained. The default database is `terra.db`; SQLite data at the previous filename is migrated before opening.
- Release: CI and release workflows build/publish Terra desktop/server names and `ghcr.io/<owner>/terra-server`. The manifest builder emits `terra-latest.json`.
- Documentation: active setup, release, and manual verification docs describe Terra and the separate desktop identity. Historical audit/spec/plan docs and the separate mobile store identity remain unchanged.

## Verification

- `GOCACHE=/tmp/terra-go-cache go test ./...`, `go vet ./...`, and `go build -o /tmp/terra-server ./cmd/terra-server`: passed.
- `node --test --test-isolation=none scripts/build-update-manifest.test.mjs`: 6/6 passed.
- `cargo check --tests --manifest-path client/src-tauri/Cargo.toml`: passed with existing dead-code warnings.
- `git diff --check` at root and both submodules: passed.
- Tauri config JSON parsed and reports Terra product/binary/bundle identity and Terra updater endpoint; configured updater public key retained.
- Frontend Vitest/lint/build could not run because dependencies are not available locally and registry access fails DNS resolution. Rust unit tests were not run; earlier Tauri test linking did not complete. No desktop dev server was started.

## Manual verification remaining

Install and run the previous app and Terra side by side; verify local DB/keychain separation and preserved old data; sign in to an existing account, sync/decrypt data, test OAuth, confirm server DB migration preserves records, and verify Terra uses only its signed updater feed. Cross-platform installer/signing checks require builds on their target environments.

## Follow-up: complete active identifier rename

The user asked to rename remaining active identifiers after the original rename was pushed. Active desktop events, CSS selectors, export format labels, team-key write domains, session preference IDs, server environment variables, and the default database filename now use Terra identifiers. The server opens the configured database URL directly, defaults to `terra.db`, and does not migrate or discover another filename. Old encryption and preference identifiers remain read-only compatibility formats. Historical execution records remain historical.

- `GOCACHE=/tmp/terra-go-cache go test ./internal/config ./cmd/terra-server -count=1`: passed after DB migration implementation.
- `cargo check --tests --manifest-path client/src-tauri/Cargo.toml`: passed after adding legacy envelope coverage.
- `cargo test --manifest-path client/src-tauri/Cargo.toml --lib`: 118 passed.
