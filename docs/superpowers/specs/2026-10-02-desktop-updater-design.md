# Signed desktop updates via GitHub Releases

**Date:** 2026-10-02

## Purpose and scope

TermVault's existing update store is a no-op and its update notification is not mounted. Users of the distributed desktop app need to discover a newer release, read its notes, download a verified update, and choose when to install it. Update delivery must not depend on the self-hosted TermVault API or an account login.

The first release uses signed artifacts on the monorepo's GitHub Releases. Windows installer, macOS app, and Linux AppImage builds receive in-app updates. Linux `.deb` installs can check for a newer release but open its download page for package-managed installation. Other Linux package formats are not promised. Development builds do not check or install updates.

This does not publish a release as part of implementation. A live release needs repository secrets, actual platform build runners, and manual installation tests.

## Distribution architecture

The existing `v*` tag release workflow becomes the single release entry point for server and desktop outputs. Its desktop matrix builds Windows x64, macOS x64 and arm64, and Linux x64. It validates that the tag version equals the Tauri app version before publishing. The Tauri bundler creates v2 updater artifacts and `.sig` files. A `latest.json` manifest in the same GitHub Release lists only successfully built target/architecture pairs, with full asset URLs and the literal signature contents. The app's updater endpoint is the monorepo's `releases/latest/download/latest.json` URL.

GitHub Actions must check out the exact client gitlink recorded by the monorepo. The current `git@personal:` submodule URLs do not work on hosted runners; the workflow must use an explicitly scoped read credential or equivalent URL rewrite to fetch the submodules. Missing credentials, missing signing key, version mismatch, missing signature, or incomplete required platform output fail the release job instead of publishing a partial manifest. The workflow keeps the existing server release output.

The update key pair is separate from OS installer signing. The public updater key replaces the development placeholder in `tauri.conf.json`; the private key stays out of Git and is supplied to the release job as `TAURI_SIGNING_PRIVATE_KEY` (and its password if used). A maintainer provisions these GitHub Actions secrets before a production release. Windows code signing and macOS notarization are additional distribution requirements; updater signatures do not replace them.

## Client behavior

Initialize the Tauri updater and process plugins and grant narrowly scoped updater/process capabilities. Mount the existing update notification in the app shell. The update store owns the native update handle, state transitions, and cleanup. It checks quietly once per app launch after the UI is ready. Settings offers a manual “Check for updates” action and reports its result, including offline/HTTP/manifest errors. No account or vault state is required for update checks.

When an update is available, show version, notes, and date if supplied. Dismissing the prompt does not download or install it. The first action downloads the update and reports bytes/progress; after a verified download, a separate “Restart & install” action installs it and relaunches as required by the platform. Download or install failure remains visible, allows retry, and leaves the current app running. Concurrent checks/downloads are prevented. The modal cannot be dismissed during an active install; download cancellation behavior follows the plugin's supported API and is not represented as cancellable if unsupported.

On Linux, a small native capability check determines whether the current executable is running as an AppImage. A `.deb` install may still check the GitHub release version/notes, but its action is “Open release page,” not native install. A development build shows an explicit “updates unavailable in development” result for manual checks and performs no startup check. Unsupported platform/architecture reports a clear manual-download path.

## Security and privacy

Tauri verifies the update signature against the embedded public key before installation. Downloads use HTTPS; there is no insecure fallback or unsigned install path. Only release metadata and the app's version/target are sent to GitHub during checks. Checks do not include TermVault user IDs, vault IDs, credentials, or terminal content. The updater never consults the self-hosted sync server. The release page link uses a fixed repository URL rather than untrusted manifest content.

Key rotation needs an explicit release process: ship a version that trusts the new key before signing solely with it, or provide a manual installer migration. The first implementation does not automate key rotation.

## Verification

- Unit tests cover no-update, update available, check errors, progress, retry, install failure, duplicate action suppression, development mode, and Linux `.deb` behavior through mocked updater/native capability APIs.
- A manifest-generation test uses fixture bundles and `.sig` files to verify required platform keys, literal signatures, version, URLs, and failure on missing artifacts.
- Frontend typecheck, lint, tests, and build; Rust check/tests; workflow YAML and shell/script validation.
- Before claiming release readiness, manually install a lower signed build and update it on Windows, macOS, and Linux AppImage. Confirm `.deb` opens the release page; verify an invalid signature refuses installation and a network failure leaves the current app usable.

## Existing constraints and references

- The existing update store and modal are in `client/src/stores/update/updateStore.ts` and `client/src/components/update/UpdateNotification.tsx`.
- `client/src-tauri/tauri.conf.json` contains a placeholder updater key and a non-existent endpoint; `client/package.json` already includes the JS updater and process packages. Rust plugins and ACL capabilities are not configured.
- `.github/workflows/release.yml` currently builds only the server, and its checkout does not initialize submodules. The repo requires `pnpm`.
- Tauri documentation: [Updater](https://v2.tauri.app/plugin/updater/) and [GitHub Actions distribution](https://v2.tauri.app/distribute/pipelines/github/).
