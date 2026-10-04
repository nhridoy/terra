# SDD ledger — Terra product identity rename

Plan: `docs/superpowers/plans/2026-10-04-terra-product-identity-rename.md`  
Workspace: existing branch and submodules; no worktree or branch switch. No commits or pushes, per user instruction.

User-owned updater public key in `client/src-tauri/tauri.conf.json` was preserved while updating the Terra app identity and feed.

## Implementation status

- Desktop: Terra product/binary/package names, bundle ID `com.nhridoy.terra`, separate `terra.db` and local data namespace, Terra UI/export branding, and `terra-latest.json` updater feed are in place. Legacy server/wire/crypto identifiers are preserved where the approved design requires compatibility.
- Server: Go module/import paths and executable entry point are `github.com/nhridoy/terra-server` and `cmd/terra-server`; Terra env vars take precedence with existing aliases retained. The server continues using the existing `termvault.db` default and compatible API/data formats.
- Release: CI and release workflows build/publish Terra desktop/server names and `ghcr.io/<owner>/terra-server`. The manifest builder emits `terra-latest.json`.
- Documentation: active setup, release, and manual verification docs describe Terra and the separate desktop identity. Historical audit/spec/plan docs, mobile identity, crypto domains, events, CSS selectors, serialized wire IDs, and the server DB name remain unchanged by design.

## Verification

- `GOCACHE=/tmp/terra-go-cache go test ./...`, `go vet ./...`, and `go build -o /tmp/terra-server ./cmd/terra-server`: passed.
- `node --test --test-isolation=none scripts/build-update-manifest.test.mjs`: 6/6 passed.
- `cargo check --tests --manifest-path client/src-tauri/Cargo.toml`: passed with existing dead-code warnings.
- `git diff --check` at root and both submodules: passed.
- Tauri config JSON parsed and reports Terra product/binary/bundle identity and Terra updater endpoint; configured updater public key retained.
- Frontend Vitest/lint/build could not run because dependencies are not available locally and registry access fails DNS resolution. Rust unit tests were not run; earlier Tauri test linking did not complete. No desktop dev server was started.

## Manual verification remaining

Install and run TermVault and Terra side by side; verify local DB/keychain separation and preserved old data; sign in to an existing account, sync/decrypt data, test OAuth, confirm existing server DB opens unchanged, and verify each app requests only its own signed updater feed. Cross-platform installer/signing checks require builds on their target environments.
