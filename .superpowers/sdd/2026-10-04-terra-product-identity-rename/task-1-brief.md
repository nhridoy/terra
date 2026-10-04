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

