# Desktop updater release runbook

Terra checks the monorepo's latest GitHub Release for `terra-latest.json`. Windows NSIS, macOS app, and Linux AppImage builds can install signed updates in-app. Linux `.deb` builds open the release page for package-managed installation. Development builds make no network update request.

## One-time setup

1. Keep the Terra Tauri updater **private** signing key outside Git. Its matching **public** key is embedded in `client/src-tauri/tauri.conf.json`. If reusing a previously generated updater key, first verify that its public key exactly matches Terra's configured key. Otherwise create and securely back up a Terra keypair, then configure its public key before release. After Terra has a signed release, treat key rotation as a migration rather than silently replacing the key.
2. In the `Release` environment (Settings → Environments → Release), add secret `TAURI_SIGNING_PRIVATE_KEY` containing the private key file contents. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` there if the key has a password. Never paste the key into a workflow, issue, log, or commit.
3. No submodule token is needed: `terra-client` and `terra-server` are public, so CI rewrites the local `git@personal:` SSH alias to anonymous `https://github.com/` inside each fetch command.
4. Set up Windows installer signing and macOS signing/notarization credentials before distributing those builds as production releases. Tauri updater signatures verify the downloaded update but do not replace operating-system trust checks. Add the platform-specific signing environment variables/secrets to the desktop build job when those identities are available.
5. Keep the monorepo GitHub Release public if it is the public desktop update channel. For a private repository, unauthenticated desktop clients cannot fetch `terra-latest.json` from the Releases URL.

## Publish a release

The monorepo's `Release` workflow runs when a `v*` tag is pushed. It reads the exact client and server submodule commits recorded by that tag. Do not tag until those submodule commits are pushed and the monorepo points to them.

### Alpha release

1. Choose the next prerelease version, such as `0.0.1-alpha.1` (then `alpha.2`, `alpha.3`, etc.). Update the version in `client/src-tauri/tauri.conf.json`, `client/package.json`, and `client/src-tauri/Cargo.toml`; update the `terra` package entry in `client/src-tauri/Cargo.lock` to match.
2. Commit and push the client version change to `main` in the private client repository.
3. In the monorepo, update the client submodule pointer and commit/push the release workflow or README changes needed for the release. Check that `git submodule status` shows the intended client revision.
4. Create and push the matching tag from the monorepo commit, for example:

   ```bash
   git tag -a v0.0.1-alpha.1 -m "Terra 0.0.1-alpha.1"
   git push origin v0.0.1-alpha.1
   ```

5. Monitor **Actions → Release**. The workflow checks the `Release` environment secret `TAURI_SIGNING_PRIVATE_KEY` and variable `VITE_API_URL`, then builds Windows, Linux, macOS Intel, macOS Apple Silicon, the server archive, and the versioned GHCR image. It publishes a GitHub prerelease; alpha Docker images are version-tagged and do not overwrite `latest`.
6. Confirm the GitHub release is marked **Pre-release** and contains `terra-latest.json`, Windows NSIS `.exe`, macOS `.app.tar.gz` for both architectures, Linux `.AppImage`, installer bundles, signatures, and `terra-server-linux-amd64.tar.gz`. Confirm the versioned image exists at `ghcr.io/nhridoy/terra-server:0.0.1-alpha.1`.
7. Download and manually install the alpha builds for testing. The app's configured updater endpoint follows GitHub's stable `/releases/latest` feed, so it does not offer prereleases as in-app updates.

### Stable release

1. Choose the next stable SemVer (for example, `1.0.0`) and update the same four client version locations listed above. Commit and push the client change, then update and push the monorepo's client submodule pointer.
2. Review the tagged source and CI status, then create and push an annotated `v<version>` tag from the monorepo:

   ```bash
   git tag -a v1.0.0 -m "Terra 1.0.0"
   git push origin v1.0.0
   ```

3. Monitor **Actions → Release** until all jobs succeed. Stable releases are published as non-prereleases and update the `latest` GHCR tag.
4. Check the same release assets and updater manifest listed above. The manifest's `platforms` entries must point to the exact assets and contain signature **contents**, not paths.
5. Install a previous signed build and use Settings → Check for updates on Windows, macOS Intel/Apple Silicon, and Linux AppImage. Confirm download progress, separate install action, relaunch, and displayed new version. For `.deb`, confirm the release page opens and no AppImage install is attempted.

Before public distribution, test an unavailable network and a deliberately invalid signature using a disposable test release/environment. The current app must remain usable. Do not alter production `terra-latest.json` merely to run this test.

## Rollback and key loss

The Tauri updater accepts only versions newer than the installed app. To recover from a bad release, publish a corrected release with a higher version. Do not replace a published asset or signature under the same version; cached manifests and clients may disagree. If the signing private key is compromised, stop publishing and issue a new installer with a new public key through a trusted manual channel. An installed build cannot trust a new updater key it never received.

The updater is independent of the self-hosted Terra server and does not send account, vault, or terminal data to GitHub. Terra installations use the `terra-latest.json` feed.
