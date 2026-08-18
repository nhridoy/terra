# Task 8: Client Rust Crypto Commands

**Files:**
- Create: `client/src-tauri/src/crypto.rs`
- Modify: `client/src-tauri/src/lib.rs`
- Modify: `client/src-tauri/Cargo.toml`

**Interfaces:**
- Produces: Tauri commands matching spec §8.1 (generate_account_material, derive_kek, compute_login_proof, build_keyring_rows, encrypt_secret, decrypt_secret, unwrap_dek, recovery_unwrap_dek, sign_challenge, lock, unlock)

## Steps

1. Add Rust dependencies to Cargo.toml:
```toml
argon2 = "0.5"
xchacha20poly1305 = "0.10"
x25519-dalek = { version = "2", features = ["static_secrets"] }
sha2 = "0.10"
hmac = "0.12"
zeroize = { version = "1", features = ["derive"] }
base64 = "0.22"
```

2. Write crypto test (argon2 KDF roundtrip):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_derive_kek_deterministic() {
        let salt = [1u8; 16];
        let kek1 = derive_kek_bytes("password", &salt).unwrap();
        let kek2 = derive_kek_bytes("password", &salt).unwrap();
        assert_eq!(kek1, kek2);
    }
}
```

3. Implement derive_kek_bytes (internal, not Tauri command)

4. Write encrypt/decrypt roundtrip test, implement encrypt_secret / decrypt_secret

5. Write X25519 keypair + sign/verify test, implement generate_account_material, sign_challenge

6. Write build_keyring_rows test, implement build_keyring_rows, unwrap_dek, recovery_unwrap_dek

7. Implement lock / unlock (session state)

8. Register all Tauri commands in lib.rs

9. `cd client && cargo test` → PASS

10. `cd client && cargo check` → PASS (no warnings)

11. Commit
