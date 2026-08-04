use keyring::Entry;

const SERVICE_NAME: &str = "com.termvault";

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, key).map_err(|e| format!("Keyring error: {e}"))
}

pub fn save_refresh_token(token: &str) -> Result<(), String> {
    let e = entry("refresh_token")?;
    e.set_password(token).map_err(|e| format!("Failed to save refresh token: {e}"))
}

pub fn load_refresh_token() -> Result<String, String> {
    let e = entry("refresh_token")?;
    e.get_password().map_err(|e| format!("Failed to load refresh token: {e}"))
}

pub fn save_remember_blob(blob: &str) -> Result<(), String> {
    let e = entry("remember_blob")?;
    e.set_password(blob).map_err(|e| format!("Failed to save remember blob: {e}"))
}

pub fn load_remember_blob() -> Result<String, String> {
    let e = entry("remember_blob")?;
    e.get_password().map_err(|e| format!("Failed to load remember blob: {e}"))
}

pub fn clear() -> Result<(), String> {
    let entries = ["refresh_token", "remember_blob"];
    let mut last_err = None;
    for key in &entries {
        if let Ok(e) = entry(key) {
            if let Err(err) = e.delete_credential() {
                // Ignore "not found" errors
                if !matches!(err, keyring::Error::NoEntry) {
                    last_err = Some(format!("Failed to clear {key}: {err}"));
                }
            }
        }
    }
    match last_err {
        Some(e) => Err(e),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // NOTE: keyring tests require a keychain daemon to be available.
    // On CI without a keychain, these tests will be skipped.

    fn has_keychain() -> bool {
        // Try creating an entry; if it fails we likely don't have a keychain
        Entry::new(SERVICE_NAME, "test_probe").is_ok()
    }

    #[test]
    fn test_save_load_refresh_token_roundtrip() {
        if !has_keychain() {
            eprintln!("Skipping keyring test: no keychain available");
            return;
        }
        let _ = clear();
        save_refresh_token("test_token_abc123").unwrap();
        let loaded = load_refresh_token().unwrap();
        assert_eq!(loaded, "test_token_abc123");
        let _ = clear();
    }

    #[test]
    fn test_save_load_remember_blob_roundtrip() {
        if !has_keychain() {
            eprintln!("Skipping keyring test: no keychain available");
            return;
        }
        let _ = clear();
        save_remember_blob("remember_me_data_xyz").unwrap();
        let loaded = load_remember_blob().unwrap();
        assert_eq!(loaded, "remember_me_data_xyz");
        let _ = clear();
    }

    #[test]
    fn test_clear_removes_everything() {
        if !has_keychain() {
            eprintln!("Skipping keyring test: no keychain available");
            return;
        }
        save_refresh_token("token").unwrap();
        save_remember_blob("blob").unwrap();
        clear().unwrap();

        let rt = load_refresh_token();
        assert!(rt.is_err());

        let rb = load_remember_blob();
        assert!(rb.is_err());
    }

    #[test]
    fn test_overwrite_refresh_token() {
        if !has_keychain() {
            eprintln!("Skipping keyring test: no keychain available");
            return;
        }
        let _ = clear();
        save_refresh_token("old_token").unwrap();
        save_refresh_token("new_token").unwrap();
        let loaded = load_refresh_token().unwrap();
        assert_eq!(loaded, "new_token");
        let _ = clear();
    }
}
