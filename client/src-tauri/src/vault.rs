use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::ChaCha20Poly1305;
use rand::RngCore;
use serde::{Deserialize, Serialize};

const OPS_LIMIT: u32 = 2;
const MEM_LIMIT: u32 = 67108864;
const KEY_LENGTH: usize = 32;
const NONCE_LENGTH: usize = 12;
const SALT_LENGTH: usize = 16;

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: String,
    pub nonce: String,
}

#[tauri::command]
pub fn generate_salt() -> String {
    let mut salt = [0u8; SALT_LENGTH];
    rand::thread_rng().fill_bytes(&mut salt);
    hex::encode(salt)
}

#[tauri::command]
pub fn derive_key(password: String, salt_hex: String) -> Result<String, String> {
    let salt_bytes = hex::decode(&salt_hex).map_err(|e| e.to_string())?;
    let params = Params::new(MEM_LIMIT, OPS_LIMIT, 1, Some(KEY_LENGTH))
        .map_err(|e| e.to_string())?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LENGTH];
    argon2
        .hash_password_into(password.as_bytes(), &salt_bytes, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(hex::encode(key))
}

#[tauri::command]
pub fn encrypt(plaintext: String, key_hex: String) -> Result<EncryptedData, String> {
    let key_bytes = hex::decode(&key_hex).map_err(|e| e.to_string())?;
    let key = chacha20poly1305::Key::from_slice(&key_bytes);
    let cipher = ChaCha20Poly1305::new(key);

    let mut nonce_bytes = [0u8; NONCE_LENGTH];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = chacha20poly1305::Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(EncryptedData {
        ciphertext: hex::encode(ciphertext),
        nonce: hex::encode(nonce_bytes),
    })
}

#[tauri::command]
pub fn decrypt(ciphertext_hex: String, nonce_hex: String, key_hex: String) -> Result<String, String> {
    let key_bytes = hex::decode(&key_hex).map_err(|e| e.to_string())?;
    let key = chacha20poly1305::Key::from_slice(&key_bytes);
    let cipher = ChaCha20Poly1305::new(key);

    let nonce_bytes = hex::decode(&nonce_hex).map_err(|e| e.to_string())?;
    let nonce = chacha20poly1305::Nonce::from_slice(&nonce_bytes);

    let ciphertext = hex::decode(&ciphertext_hex).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| e.to_string())?;

    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

pub fn encrypt_field(plaintext: &str, key_hex: &str) -> Result<String, String> {
    let result = encrypt(plaintext.to_string(), key_hex.to_string())?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

pub fn decrypt_field(ciphertext_json: &str, key_hex: &str) -> Result<String, String> {
    let encrypted: EncryptedData = serde_json::from_str(ciphertext_json).map_err(|e| e.to_string())?;
    decrypt(encrypted.ciphertext, encrypted.nonce, key_hex.to_string())
}

pub fn is_encrypted_field(value: &str) -> bool {
    if let Ok(data) = serde_json::from_str::<EncryptedData>(value) {
        !data.ciphertext.is_empty() && !data.nonce.is_empty()
    } else {
        false
    }
}
