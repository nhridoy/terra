// Stub - encryption utilities will be implemented with libsodium
// Termius-compatible: Argon2id + XSalsa20 + Poly1305

export async function initSodium(): Promise<void> {
  // Will initialize libsodium
}

export function generateSalt(): Uint8Array {
  return new Uint8Array(16)
}

export function generateNonce(): Uint8Array {
  return new Uint8Array(24)
}

export async function deriveKey(
  _password: string,
  _salt: Uint8Array,
): Promise<CryptoKey> {
  throw new Error('Not yet implemented')
}

export async function encryptSecret(
  _plaintext: string,
  _key: CryptoKey,
  _nonce: Uint8Array,
): Promise<string> {
  throw new Error('Not yet implemented')
}

export async function decryptSecret(
  _ciphertext: string,
  _key: CryptoKey,
  _nonce: Uint8Array,
): Promise<string> {
  throw new Error('Not yet implemented')
}

export function bufferToBase64(_buffer: ArrayBuffer): string {
  return ''
}

export function base64ToBuffer(_base64: string): ArrayBuffer {
  return new ArrayBuffer(0)
}

export function bufferToString(_buffer: ArrayBuffer): string {
  return ''
}

export function stringToBuffer(_str: string): ArrayBuffer {
  return new ArrayBuffer(0)
}
