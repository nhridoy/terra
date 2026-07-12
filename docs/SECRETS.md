# GitHub Secrets Configuration

This document lists all required GitHub secrets for CI/CD workflows.

## Required Secrets

### Docker Hub

| Secret | Description | How to get |
|--------|-------------|------------|
| `DOCKER_USERNAME` | Docker Hub username | [Docker Hub](https://hub.docker.com/settings/security) |
| `DOCKER_PASSWORD` | Docker Hub access token | Create access token in Docker Hub security settings |

### Tauri Desktop Builds

| Secret | Description | How to get |
|--------|-------------|------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater signing key | Run `npx tauri signer generate` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for signing key | Set when generating key |

### Apple (iOS)

| Secret | Description | How to get |
|--------|-------------|------------|
| `EXPO_APPLE_ID` | Apple ID email | Your Apple ID |
| `EXPO_ASC_API_KEY_ID` | App Store Connect API key ID | [App Store Connect](https://appstoreconnect.apple.com/access/api) |
| `EXPO_ASC_API_ISSUER_ID` | App Store Connect issuer ID | App Store Connect > Users > Keys |
| `EXPO_APPLE_PRIVATE_KEY` | App Store Connect private key (p8) | Download from App Store Connect |
| `FASTLANE_APPLE_ID` | Apple ID for Fastlane | Your Apple ID |
| `FASTLANE_APPLE_TEAM_ID` | Apple Developer Team ID | [Apple Developer](https://developer.apple.com/account) |
| `FASTLANE_MATCH_PASSWORD` | Password for match certificates | Set when setting up match |

### Google Play (Android)

| Secret | Description | How to get |
|--------|-------------|------------|
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | Service account JSON key | [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Generate with `keytool` |
| `ANDROID_KEY_ALIAS` | Key alias in keystore | Generate with `keytool` |
| `ANDROID_KEY_PASSWORD` | Key password | Generate with `keytool` |

## Generating Tauri Signing Keys

```bash
# Generate new signing key
npx tauri signer generate -w ~/.tauri/termvault.key

# The public key (base64) goes in tauri.conf.json
# The private key goes in TAURI_SIGNING_PRIVATE_KEY secret
```

## Generating Android Keystore

```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore termvault-release.keystore \
  -alias termvault \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

## Creating Google Play Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google Play Developer API
4. Create service account
5. Generate JSON key
6. Add service account email to Google Play Console users
7. Grant "Release manager" permissions

## Apple App Store Connect Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Users and Access > Keys > Generate API Key
3. Select "Developer" access for CI/CD
4. Download .p8 file (only shown once)
5. Note the Key ID and Issuer ID

## Setting Secrets in GitHub

1. Go to repository Settings
2. Secrets and variables > Actions
3. Click "New repository secret"
4. Add each secret with exact name from tables above

## Verification

After setting secrets, trigger a workflow:

```bash
git push origin main
```

Check the Actions tab for any secret-related errors.
