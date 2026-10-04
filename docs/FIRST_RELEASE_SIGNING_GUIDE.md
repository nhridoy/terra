# First Terra Release: Signing and Release Setup

**Checked against the repository on 2026-10-04.** This runbook describes the current `release.yml` workflow and the additional work and credentials needed for a properly signed public desktop release. Provider pages and certificate requirements can change; verify current instructions before purchasing or issuing certificates.

## Current readiness

The release workflow already builds Windows x64, Linux x64, macOS Intel, and macOS Apple silicon artifacts. It signs updater bundles with Tauri's updater key and verifies those signatures while creating `terra-latest.json`.

The workflow is **not yet ready for a fully publisher-signed first release**:

- Windows Authenticode signing is not configured. The current `.exe` installer is not signed with a publisher certificate.
- macOS Developer ID signing and Apple notarization are not configured. The current `.app`/`.dmg` outputs are not notarized.
- Linux updater signatures cover the AppImage used for in-app updates. The downloadable `.deb` is not separately signed. Linux artifacts do not have a detached release signature/checksum manifest yet.
- The server tarball and Docker image are not signed by this workflow.
- The workflow publishes the GitHub release automatically after its release-artifact checks. The GHCR image job is a prerequisite for publication, so the release stays unpublished if the image push fails.

Do not push the first `v*` tag until the required secrets are set, the missing operating-system signing steps are implemented, and the signed builds have been tested. Pushing a matching tag is a publication action, not a dry run.

## What the current workflow creates

| Target | Runner and Rust target | Current artifacts | Current signing coverage |
|---|---|---|---|
| Windows x64 | `windows-latest`, `x86_64-pc-windows-msvc` | NSIS setup `.exe` | Tauri updater signature; no Windows publisher/Authenticode signature |
| Linux x64 | `ubuntu-22.04`, `x86_64-unknown-linux-gnu` | AppImage and `.deb` | Tauri updater signature for the AppImage; `.deb` has no separate signature |
| macOS Intel | `macos-latest`, `x86_64-apple-darwin` | `.app`, `.dmg`, and Tauri updater archive | Tauri updater signature for the `.app.tar.gz`; no Developer ID signing/notarization |
| macOS Apple silicon | `macos-latest`, `aarch64-apple-darwin` | `.app`, `.dmg`, and Tauri updater archive | Tauri updater signature for the `.app.tar.gz`; no Developer ID signing/notarization |

There are no separate Linux builds for different distributions or Ubuntu versions. The `.deb` declares runtime package dependencies in `tauri.conf.json`; the AppImage is the more portable Linux download. Linux ARM, Windows ARM, RPM, Flatpak, Snap, and Arch packages are not produced.

The release job also publishes a Linux amd64 server tarball. The Docker job pushes `ghcr.io/nhridoy/terra-server:latest` and `ghcr.io/nhridoy/terra-server:<version>` to GitHub Container Registry (GHCR).

## The signing layers

Treat these as separate controls:

1. **Tauri updater signature:** proves that an updater bundle matches the private key corresponding to the public key embedded in the app. The private key must remain secret. `terra-latest.json` carries the literal signatures and URLs for Windows x64, Linux x64, macOS Intel, and macOS Apple silicon.
2. **Operating-system publisher signing:** identifies the publisher to Windows and macOS trust systems. It is separate from the Tauri updater signature. For direct macOS distribution, Developer ID signing and notarization are required for the expected Gatekeeper experience. Windows signing identifies the publisher, though a newly signed app may still receive a SmartScreen reputation warning until it builds reputation.
3. **Linux/manual-download integrity:** users need a verifiable signature or checksum for manual downloads such as `.deb` and the server archive. The current workflow does not publish a general signed checksum manifest. AppImage's embedded GPG signature is optional and AppImage itself does not automatically validate it; a separate verifier is needed. Keep the Tauri updater signature as the required in-app update check.
4. **Container provenance:** GHCR authentication lets CI push images; it does not sign or attest to them. Add image signing/attestations separately if signed container provenance is part of the release promise.

Never reuse an OS publisher certificate as the Tauri updater key. Keep the updater private key backed up offline in at least two secure locations.

## Accounts, credentials, and environments

### GitHub repository and Actions

The release workflow lives in the monorepo `nhridoy/terra`; add repository secrets there, not just in `terra-client` or `terra-server`. You need repository admin access to manage secrets and write access to push release tags.

Add these current-workflow secrets under **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

| Secret | Required for | How to obtain it |
|---|---|---|
| `SUBMODULE_READ_TOKEN` | Fetch the private `terra-client` and `terra-server` submodules | Create a fine-grained personal access token, or use a GitHub App token. Grant access only to `nhridoy/terra-client` and `nhridoy/terra-server`, with repository **Contents: Read-only** permission. Confirm it can clone both repositories. Set an expiration and document who renews it. |
| `TAURI_SIGNING_PRIVATE_KEY` | Sign all desktop updater bundles | Use the private key that matches `plugins.updater.pubkey` in `client/src-tauri/tauri.conf.json`. Obtain it from the maintainer's secure backup. Do not create a replacement unless you are also intentionally rotating the public key in the app and have confirmed no released version depends on the existing key. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Unlock the updater key, if it was generated with a password | The password chosen when the key pair was generated. Leave unset only if the private key has no password. |
`GITHUB_TOKEN` is provided by GitHub Actions automatically. The Docker job grants it `packages: write` to publish to GHCR; the publish job grants it `contents: write` to create the GitHub Release. No Docker Hub account or registry token is needed. Do not create a personal token for either workflow step.

To check configured **names** without exposing values, use `gh secret list --repo nhridoy/terra`. GitHub will not reveal an existing secret's value. Add or rotate a value through the repository Settings page. Keep a private inventory of owner, purpose, expiry, and rotation procedure; never paste values into issues, chat, or source files.

### Tauri updater key

Terra uses the updater public key in `client/src-tauri/tauri.conf.json`; the release manifest builder uses it to validate generated updater signatures. The matching Terra private key is required for every release. Confirm that the key backup exists and that a maintainer knows its password before tagging. A previously used updater key is valid only if it matches Terra's configured public key exactly.

Terra has a new desktop bundle identifier and separate local database/keychain namespace. It installs as a separate application and leaves existing local app data untouched. Terra's server defaults to a separate `terra.db` SQLite file; deployments can choose another file with `DATABASE_URL`. The server API and encrypted data formats remain compatible.

If the matching private key is lost and **no public release has been made**, create a replacement pair using the Tauri v2 signer instructions, update the public key in `tauri.conf.json`, and provision the new private key/password before the first public tag. After users install a release trusting a public key, losing its private key prevents normal future updates. A key rotation after publication needs a bridge release or a separate manual migration plan.

Store the private key outside the repository with restrictive file permissions. Tauri accepts a private-key path or content in `TAURI_SIGNING_PRIVATE_KEY`; for the GitHub secret, use the key content (not a path that only exists on your computer). The existing workflow forwards the optional password to Tauri. Never print the private key to a terminal transcript or CI log.

### Windows publisher signing

To provide a publisher identity on Windows, obtain a code-signing certificate from a certificate authority or use a supported cloud signing service. For a certificate-based route, you need a Windows code-signing certificate exported as a password-protected `.pfx` plus its password. A TLS/HTTPS certificate is not a code-signing certificate.

This requires **workflow/configuration work** before it will sign anything. The current workflow does not import a certificate or configure a signing command/certificate thumbprint/timestamp service. Choose the certificate provider first, then follow its current Tauri/GitHub Actions integration instructions and add the required signing secrets and workflow steps. Do not assume that buying an EV certificate removes SmartScreen warnings; reputation behavior has changed and warnings may remain for a new publisher/app.

At minimum, the integration will need the signing provider's credentials or PFX/password, a trusted timestamp endpoint if required by that provider, and Windows-runner steps that sign the installer and validate its signature. Restrict signing credentials to the release workflow and protect the release branch/tag permissions.

### macOS signing and notarization

For a public download outside the Mac App Store, enroll in the paid Apple Developer Program and have the Account Holder create a **Developer ID Application** certificate. The certificate must include its private key and be exported from Keychain Access as a password-protected `.p12` for CI. An Apple Distribution certificate is for App Store workflows; this repo publishes direct-download DMGs.

Recommended CI setup uses an App Store Connect API key for notarization rather than an Apple account password. In App Store Connect → Users and Access → Integrations, create an API key with the required developer access, then retain its Key ID, Issuer ID, and downloaded `.p8` key securely. Apple only makes the private key downloadable once.

Likely GitHub secrets/environment values for the Tauri integration:

| Value | Purpose |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password used to export the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Exact Developer ID Application identity shown by `security find-identity -v -p codesigning` |
| `APPLE_API_KEY` | App Store Connect Key ID |
| `APPLE_API_ISSUER` | App Store Connect Issuer ID |
| `APPLE_API_KEY_PATH` | Path to the `.p8` key on the runner; the workflow must write the secret key content to a temporary file and set this path |

The current workflow has no certificate import, signing identity, notarization credentials, or notarization checks. Add a macOS workflow step to create a temporary keychain, import the `.p12`, expose the signing identity, make the `.p8` file available to Tauri, and fail the build if signing/notarization/stapling fails. Use the same Developer ID identity for Intel and Apple silicon matrix builds. Delete temporary key material and keychains at job end.

Apple ID notarization is an alternative: it uses `APPLE_ID`, an app-specific password (`APPLE_PASSWORD`), and `APPLE_TEAM_ID`. Prefer the App Store Connect API key so CI does not store an account password. A free Apple account cannot notarize a public release.

### Linux and manual-download signatures

The Linux AppImage has a Tauri updater `.sig` required for in-app update verification. The `.deb` currently has no signature sidecar. To make manual downloads verifiable, add a release step that generates a SHA-256 manifest for every published asset and signs that manifest with a separate release-integrity key (for example, a dedicated minisign key); publish the public verification key through an authenticated channel and document verification commands. Do not claim that `.deb` or server archive is signed until this is wired and checked.

For AppImage embedded GPG signing, provision a dedicated GPG signing key and configure the AppImage signing variables on the Linux runner. This is an additional integrity mechanism; users still need the public key and a verifier because AppImage does not automatically validate its embedded signature. The updater signature remains mandatory for auto-updates.

## GitHub Actions environment setup

1. Open `https://github.com/nhridoy/terra` → **Settings → Secrets and variables → Actions**.
2. Add the current-workflow secrets above. Make sure the submodule token can read both private submodule repositories.
3. Keep publisher-signing values in a protected `production` GitHub Environment if the workflow is updated to declare that environment. Add required reviewers and deployment branch/tag restrictions there. Currently `release.yml` does not declare an Environment, so environment-only secrets would not be available unless the workflow is changed.
4. Check that Actions are enabled for the repository and that the workflow permission to create releases is enabled. The workflow already requests `contents: write` in the publish job.
5. The first successful workflow run creates the GHCR package `terra-server`. Open the package settings and make it public if unauthenticated downloads are intended. Public GHCR container packages can be pulled without signing in; private packages require package read access.
6. After adding signing jobs, test the credentials with a controlled release candidate or a non-publishing validation workflow. Do not use a real stable tag as a credentials test: the current workflow promotes its draft to a public release automatically.

For a package that already exists, open the package's **Package settings → Manage Actions access** and grant `nhridoy/terra` access to publish it. Set visibility to **Public** if the server image should be downloadable without authentication. Self-hosters can then run:

```bash
docker pull ghcr.io/nhridoy/terra-server:latest
```

CI uses the workflow's short-lived `GITHUB_TOKEN`; it does not require a GHCR username/token secret. People pulling a private image need a GitHub token with `read:packages` and permission to access the package.

## Maintainer workstation and CI requirements

The release uses GitHub-hosted runners; you do not need to own a Windows PC, Linux build server, or Mac to compile all targets. You do need:

- A maintainer workstation with Git, GitHub CLI (`gh`), Node.js 22, pnpm 10, and access to this repository for version/tag work.
- A macOS device and Apple Developer account for creating/exporting the Developer ID certificate and testing the signed/notarized DMG. Apple/Tauri certificate setup starts from a Mac Keychain CSR.
- GitHub-hosted `ubuntu-22.04`, `windows-latest`, and `macos-latest` runners available to the repository. The current macOS matrix builds both Intel and Apple silicon targets on macOS runners.
- GitHub Actions package-write permission for the server image. The workflow uses its automatic `GITHUB_TOKEN`; no Docker Hub account or token is needed.
- A clean test machine or VM for each supported desktop platform/architecture. At minimum, test Windows 10/11 x64, Ubuntu 22.04 and a newer supported Ubuntu release, macOS Intel, and macOS Apple silicon.

The workflow installs Linux build dependencies on the hosted Ubuntu runner. The `.deb` declares GTK/WebKit/AppIndicator runtime dependencies; verify those names and availability against supported distributions before announcing Linux support.

## Versioning and release steps

The preflight check requires the pushed tag to exactly match `client/src-tauri/tauri.conf.json`'s version. Current versions are `1.0.0` in `client/src-tauri/tauri.conf.json`, `client/src-tauri/Cargo.toml`, and `client/package.json`; keep these aligned when preparing a release.

1. Finish and merge the exact source and submodule revisions that will ship. Confirm `client` and `server` gitlinks point to reviewed commits.
2. Update the application version in all three files above, along with release notes/changelog if used. Commit and push the version change to `main`.
3. Confirm the required GitHub secret **names** exist; verify the private key matches the embedded updater public key through a signed test artifact, without displaying key material.
4. Build and install signed candidates on clean machines. Verify updater signatures, Windows Authenticode, macOS Developer ID/notarization, and Linux checksums/signatures. Test auto-update from the previous installed version on Windows, macOS Intel, macOS Apple silicon, and Linux AppImage. Test the `.deb` manual-download path.
5. Confirm the GitHub Actions release workflow has no active failed runs and the `docker` job can use `GITHUB_TOKEN` with `packages: write`.
6. Create an annotated version tag at the reviewed commit and push it. For example, when the config version is `1.0.0`:

   ```bash
   git tag -a v1.0.0 -m "Terra v1.0.0"
   git push origin v1.0.0
   ```

7. Watch **Actions → Release**. Confirm preflight/version check, all four desktop matrix entries, server packaging, manifest signature verification, GHCR image push, and GitHub Release publication all succeed.
8. Open the published GitHub Release and inspect every asset. Confirm `terra-latest.json` contains all four platform keys and correct release URLs; each updater bundle has a `.sig`; the `.deb`, server tarball, and Docker image have the separately documented integrity/provenance evidence.
9. Download each artifact from the public release and repeat the clean-machine installation/update checks. Publish user-facing release notes only after these checks.

The Docker job completes before the GitHub Release is published. A failed GHCR push blocks publication, keeping the server container and desktop/server release outputs aligned.

## Validation checklist

### Before pushing the version tag

- [ ] Stable updater public key in `tauri.conf.json` is final; matching private key is backed up, password known, and GitHub secrets configured.
- [ ] `SUBMODULE_READ_TOKEN` can read both private submodules; the release job's `GITHUB_TOKEN` has `packages: write` for GHCR.
- [ ] Windows installer signing has been added and validates with `Get-AuthenticodeSignature`.
- [ ] Both macOS architectures are Developer ID signed, notarized, and stapled; validate with `codesign`, `spctl`, and `xcrun stapler validate` on macOS.
- [ ] Linux AppImage updater signature validates; `.deb` and server tarball have published checksum/signature instructions.
- [ ] Fresh install and updater flows have been tested from downloads, not just local build folders.
- [ ] Version/tag equality and all three version files are checked.

### After the workflow finishes

- [ ] `linux-x86_64`, `windows-x86_64`, `darwin-x86_64`, and `darwin-aarch64` are present in `terra-latest.json`.
- [ ] Each manifest signature verifies with the public key embedded in the installed app.
- [ ] Downloaded installers are signed by Terra's expected publisher identity; macOS Gatekeeper accepts the notarized app.
- [ ] Every published file matches the signed checksum manifest, including `.deb`, server archive, and release metadata where applicable.
- [ ] `ghcr.io/nhridoy/terra-server` has `latest` and version tags, its digest corresponds to the reviewed server submodule commit, and package visibility matches the intended public/private distribution.
- [ ] No private signing key, password, `.p12`, `.p8`, PAT, or Docker token appears in Git history, release assets, or Actions logs.

## Secret handling and recovery

- Store signing private keys and certificate backups encrypted and offline with access limited to the release maintainers.
- Keep the updater key, Windows publisher credential, Apple certificate, and Apple notarization API key as separate credentials with separate rotation plans.
- Rotate expiring submodule PATs before expiry. GHCR publishing uses a short-lived workflow `GITHUB_TOKEN`, not a long-lived registry token.
- If a code-signing credential is compromised, revoke it with its provider and stop releases until the signing workflow is updated.
- If the Tauri updater private key is compromised, treat it as a release-signing incident: stop publishing, assess exposure, and plan a trusted key-rotation/bridge release. Do not silently replace the public key.
- Never commit private signing material, generated certificate files, API keys, PATs, or secret values to the monorepo or either submodule.

## Official references

- [Tauri updater signing](https://v2.tauri.app/plugin/updater/)
- [Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/)
- [Tauri macOS code signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri Linux code signing](https://v2.tauri.app/distribute/sign/linux/)
- [Tauri GitHub Actions distribution](https://v2.tauri.app/distribute/pipelines/github/)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Publish packages to GHCR from GitHub Actions](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions)
- [GHCR permissions and package visibility](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)
- [Apple Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates)
- [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
