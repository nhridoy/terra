# Task 9: Client Rust Keystore + DB

**Files:**
- Create: `client/src-tauri/src/keystore.rs`
- Create: `client/src-tauri/src/db.rs`
- Modify: `client/src-tauri/src/lib.rs`
- Modify: `client/src-tauri/Cargo.toml`

**Interfaces:**
- Produces: `keystore::save_refresh_token`, `keystore::load_refresh_token`, `keystore::save_remember_blob`, `keystore::load_remember_blob`, `keystore::clear`, `db::open`, `db::upsert_user_profile`, `db::upsert_keyring`, `db::upsert_vault`, `db::upsert_record`, `db::query_records`, `db::delete_record`

## Steps

1. Add keyring + rusqlite dependencies to Cargo.toml:
```toml
keyring = "3"
rusqlite = { version = "0.32", features = ["bundled"] }
```

2. Write keystore tests:
- save/load refresh token roundtrip
- save/load remember blob roundtrip
- clear removes everything

3. Implement keystore.rs:
- Uses OS keychain via `keyring` crate
- save_refresh_token, load_refresh_token
- save_remember_blob, load_remember_blob
- clear

4. Write db tests:
- open creates tables
- upsert_user_profile roundtrip
- upsert_keyring roundtrip
- upsert_record + query_records roundtrip
- delete_record marks deleted

5. Implement db.rs:
- Uses rusqlite for local encrypted vault
- open, upsert_user_profile, upsert_keyring, upsert_vault, upsert_record, query_records, delete_record

6. Wire into lib.rs, `cd client/src-tauri && cargo test` → PASS

7. `cd client/src-tauri && cargo check` → PASS

8. Commit
