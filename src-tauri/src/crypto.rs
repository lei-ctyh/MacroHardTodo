use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use rand::RngCore;

const MAGIC: &[u8; 4] = b"MHT1";
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;

fn derive_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|e| format!("密钥派生失败: {e}"))?;
    Ok(key)
}

#[tauri::command]
pub fn crypto_encrypt(passphrase: String, plaintext: String) -> Result<String, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    let mut rng = rand::thread_rng();
    rng.fill_bytes(&mut salt);
    rng.fill_bytes(&mut nonce);

    let key = derive_key(&passphrase, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext.as_bytes())
        .map_err(|e| format!("加密失败: {e}"))?;

    let mut out = Vec::with_capacity(4 + SALT_LEN + NONCE_LEN + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);
    Ok(STANDARD.encode(out))
}

#[tauri::command]
pub fn crypto_decrypt(passphrase: String, payload: String) -> Result<String, String> {
    let raw = STANDARD
        .decode(payload.trim())
        .map_err(|e| format!("密文格式错误: {e}"))?;
    if raw.len() < 4 + SALT_LEN + NONCE_LEN || &raw[..4] != MAGIC {
        return Err("不是 MacroHard Todo 的加密数据".into());
    }
    let salt = &raw[4..4 + SALT_LEN];
    let nonce = &raw[4 + SALT_LEN..4 + SALT_LEN + NONCE_LEN];
    let ciphertext = &raw[4 + SALT_LEN + NONCE_LEN..];

    let key = derive_key(&passphrase, salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| "口令不正确或数据已损坏".to_string())?;
    String::from_utf8(plaintext).map_err(|e| format!("解密结果不是文本: {e}"))
}
