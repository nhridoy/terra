use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::ChaCha20Poly1305;
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::RngCore;
use rsa::pkcs8::EncodePrivateKey;
use rsa::pkcs1::EncodeRsaPublicKey;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const OPS_LIMIT: u32 = 3;
const MEM_LIMIT: u32 = 65536;
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

#[allow(dead_code)]
pub fn encrypt_field(plaintext: &str, key_hex: &str) -> Result<String, String> {
    let result = encrypt(plaintext.to_string(), key_hex.to_string())?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[allow(dead_code)]
pub fn decrypt_field(ciphertext_json: &str, key_hex: &str) -> Result<String, String> {
    let encrypted: EncryptedData = serde_json::from_str(ciphertext_json).map_err(|e| e.to_string())?;
    decrypt(encrypted.ciphertext, encrypted.nonce, key_hex.to_string())
}

#[allow(dead_code)]
pub fn is_encrypted_field(value: &str) -> bool {
    if let Ok(data) = serde_json::from_str::<EncryptedData>(value) {
        !data.ciphertext.is_empty() && !data.nonce.is_empty()
    } else {
        false
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecoveryKit {
    pub version: u32,
    pub encrypted_key: EncryptedData,
    pub salt: String,
    pub created_at: String,
}

#[tauri::command]
pub fn generate_recovery_kit(key_hex: String, password: String) -> Result<RecoveryKit, String> {
    let salt = generate_salt();
    let derived_key = derive_key(password, salt.clone())?;
    let encrypted = encrypt(key_hex, derived_key)?;
    Ok(RecoveryKit {
        version: 1,
        encrypted_key: encrypted,
        salt,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn recover_from_kit(kit_json: String, password: String) -> Result<String, String> {
    let kit: RecoveryKit = serde_json::from_str(&kit_json).map_err(|e| e.to_string())?;
    let derived_key = derive_key(password, kit.salt)?;
    decrypt(
        kit.encrypted_key.ciphertext,
        kit.encrypted_key.nonce,
        derived_key,
    )
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratedKeyPair {
    pub public_key: String,
    pub private_key: String,
    pub fingerprint: String,
}

#[tauri::command]
pub fn generate_ed25519_keypair() -> Result<GeneratedKeyPair, String> {
    use rand::RngCore;
    let mut secret_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut secret_bytes);
    let signing_key = SigningKey::from_bytes(&secret_bytes);
    let verifying_key: VerifyingKey = signing_key.verifying_key();

    // OpenSSH public key format
    let public_bytes = verifying_key.as_bytes();
    let mut public_key_data = Vec::new();
    // SSH public key wire format: type_len(4) + type + key_len(4) + key
    let type_str = "ssh-ed25519";
    public_key_data.extend_from_slice(&(type_str.len() as u32).to_be_bytes());
    public_key_data.extend_from_slice(type_str.as_bytes());
    public_key_data.extend_from_slice(&(public_bytes.len() as u32).to_be_bytes());
    public_key_data.extend_from_slice(public_bytes);
    let public_key = format!("ssh-ed25519 {}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &public_key_data));

    // Private key in PKCS8 PEM format
    let private_key_pem = signing_key
        .to_pkcs8_pem(rsa::pkcs8::LineEnding::LF)
        .map_err(|e| format!("Failed to encode private key: {}", e))?
        .to_string();

    // Fingerprint: SHA256 of the public key wire format
    let mut hasher = Sha256::new();
    hasher.update(&public_key_data);
    let hash = hasher.finalize();
    let fingerprint = format!("SHA256:{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD_NO_PAD, &hash));

    Ok(GeneratedKeyPair {
        public_key,
        private_key: private_key_pem,
        fingerprint,
    })
}

#[tauri::command]
pub fn generate_rsa_keypair(bits: Option<u32>) -> Result<GeneratedKeyPair, String> {
    let bit_length = bits.unwrap_or(4096);
    let mut rng = rand::thread_rng();
    let private_key = rsa::RsaPrivateKey::new(&mut rng, bit_length as usize)
        .map_err(|e| format!("Failed to generate RSA key: {}", e))?;
    let public_key = rsa::RsaPublicKey::from(&private_key);

    // OpenSSH public key format
    let public_key_der = public_key
        .to_pkcs1_der()
        .map_err(|e| format!("Failed to encode public key: {}", e))?;
    let type_str = "ssh-rsa";
    let mut public_key_data = Vec::new();
    public_key_data.extend_from_slice(&(type_str.len() as u32).to_be_bytes());
    public_key_data.extend_from_slice(type_str.as_bytes());
    public_key_data.extend_from_slice(&(public_key_der.as_bytes().len() as u32).to_be_bytes());
    public_key_data.extend_from_slice(public_key_der.as_bytes());
    let public_key = format!("ssh-rsa {}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &public_key_data));

    // Private key in PKCS8 PEM format
    let private_key_pem = private_key
        .to_pkcs8_pem(rsa::pkcs8::LineEnding::LF)
        .map_err(|e| format!("Failed to encode private key: {}", e))?
        .to_string();

    // Fingerprint: SHA256 of the public key wire format
    let mut hasher = Sha256::new();
    hasher.update(&public_key_data);
    let hash = hasher.finalize();
    let fingerprint = format!("SHA256:{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD_NO_PAD, &hash));

    Ok(GeneratedKeyPair {
        public_key,
        private_key: private_key_pem,
        fingerprint,
    })
}
