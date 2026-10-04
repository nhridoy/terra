# Desktop updater release runbook

Terra checks the monorepo's latest GitHub Release for `terra-latest.json`. Windows NSIS, macOS app, and Linux AppImage builds can install signed updates in-app. Linux `.deb` builds open the release page for package-managed installation. Development builds make no network update request.

## One-time setup

1. Keep the Terra Tauri updater **private** signing key outside Git. Its matching **public** key is embedded in `client/src-tauri/tauri.conf.json`. If reusing a previously generated updater key, first verify that its public key exactly matches Terra's configured key. Otherwise create and securely back up a Terra keypair, then configure its public key before release. After Terra has a signed release, treat key rotation as a migration rather than silently replacing the key.
2. Add repository Actions secret `TAURI_SIGNING_PRIVATE_KEY` containing the private key file contents. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key has a password. Never paste the key into a workflow, issue, log, or commit.
3. Add `SUBMODULE_READ_TOKEN`: a narrowly scoped read token with access to the `terra-client` and `terra-server` repositories. The workflow uses it only to fetch the exact gitlink revisions from the monorepo. The existing `git@personal:` URLs are a local SSH alias and are rewritten only inside each CI command.
4. Set up Windows installer signing and macOS signing/notarization credentials before distributing those builds as production releases. Tauri updater signatures verify the downloaded update but do not replace operating-system trust checks. Add the platform-specific signing environment variables/secrets to the desktop build job when those identities are available.
5. Keep the monorepo GitHub Release public if it is the public desktop update channel. For a private repository, unauthenticated desktop clients cannot fetch `terra-latest.json` from the Releases URL.

## Publish a release

1. Update `client/src-tauri/tauri.conf.json` to the intended SemVer, and keep `client/package.json` and `client/src-tauri/Cargo.toml` aligned if packaging checks require it. Push the client commit, then update and push the monorepo's client gitlink. Do not tag the monorepo before its gitlink points to the release client code.
2. Tag the monorepo `v<same-version>` and push the tag. The `Release` workflow checks that the tag matches Tauri's version, builds server and four desktop updater targets, and validates every required bundle and `.sig` before publishing the release. A missing secret or artifact fails the workflow.
3. Check the published Release for `terra-latest.json`, Windows NSIS `.exe`, macOS `.app.tar.gz` for both architectures, Linux `.AppImage`, optional `.deb`/`.dmg` installers, signatures, and the server tarball. The manifest's `platforms` entries must point to those exact assets and contain signature **contents**, not paths.
4. Install a previous signed build and use Settings → Check for updates on Windows, macOS Intel/Apple Silicon, and Linux AppImage. Confirm download progress, separate install action, relaunch, and displayed new version. For `.deb`, confirm the release page opens and no AppImage install is attempted.
5. Test an unavailable network and a deliberately invalid signature using a disposable test release/environment. The current app must remain usable. Do not alter production `terra-latest.json` merely to run this test.

## Rollback and key loss

The Tauri updater accepts only versions newer than the installed app. To recover from a bad release, publish a corrected release with a higher version. Do not replace a published asset or signature under the same version; cached manifests and clients may disagree. If the signing private key is compromised, stop publishing and issue a new installer with a new public key through a trusted manual channel. An installed build cannot trust a new updater key it never received.

The updater is independent of the self-hosted Terra server and does not send account, vault, or terminal data to GitHub. Terra installations use the `terra-latest.json` feed.
