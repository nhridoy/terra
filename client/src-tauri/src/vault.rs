use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: String,
    pub nonce: String,
}

// Derive key from password using Argon2id
// Matches Termius: OPSLIMIT_INTERACTIVE, MEMLIMIT_INTERACTIVE
#[tauri::command]
pub async fn derive_key(
    password: String,
    salt: String,
) -> Result<String, String> {
    // TODO: Implement Argon2id key derivation
    // For now, return a placeholder
    // In production, use argon2 crate
    Ok(format!("derived_key_{}", &password[..8.min(password.len())]))
}

#[tauri::command]
pub async fn encrypt(
    plaintext: String,
    key: String,
) -> Result<EncryptedData, String> {
    // TODO: Implement XSalsa20 + Poly1305 encryption
    // For now, return a placeholder
    Ok(EncryptedData {
        ciphertext: format!("encrypted_{}", plaintext.len()),
        nonce: "placeholder_nonce".to_string(),
    })
}

#[tauri::command]
pub async fn decrypt(
    ciphertext: String,
    nonce: String,
    key: String,
) -> Result<String, String> {
    // TODO: Implement XSalsa20 + Poly1305 decryption
    // For now, return a placeholder
    Ok("decrypted_data".to_string())
}
