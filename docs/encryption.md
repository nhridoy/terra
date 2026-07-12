# Encryption

TermVault uses the same encryption architecture as Termius, implemented with Libsodium.

## Crypto Stack

| Component | Algorithm | Parameters |
|-----------|-----------|------------|
| Crypto Library | Libsodium 1.0.20 | X25519, XSalsa20, Poly1305 |
| Auth Protocol | SRP6a | 2048-bit prime |
| Password Hashing | Argon2id | t=2, 64 MiB |
| Public-key Encryption | crypto_box | X25519 + XSalsa20 + Poly1305 |
| Secret-key Encryption | crypto_secretbox | XSalsa20 + Poly1305 |
| Nonce Generation | randombytes_buf | 24 bytes |

## Key Hierarchy

```
Password
    ↓ Argon2id(password, salt)
Derived Key
    ↓ crypto_secretbox_open_easy(encryptedPrivateKey)
Private Key (X25519)
    ↓ crypto_box_open_easy(encryptedPersonalKey)
Personal Encryption Key
    ↓ crypto_secretbox_open_easy(ciphertext)
Plaintext Data
```

## Account Creation

```javascript
// 1. Generate key pair
const { publicKey, privateKey } = crypto_box_keypair();

// 2. Generate personal encryption key
const personalKey = randombytes_buf(32);

// 3. Encrypt personal key with public key
const encryptedPersonalKey = crypto_box_easy(
  personalKey, publicKey, privateKey
);

// 4. Derive key from password
const derivedKey = crypto_pwhash(
  password, salt,
  OPSLIMIT_INTERACTIVE,  // 2 iterations
  MEMLIMIT_INTERACTIVE,  // 64 MiB
  32
);

// 5. Encrypt private key with derived key
const encryptedPrivateKey = crypto_secretbox_easy(
  privateKey, nonce, derivedKey
);

// 6. Store on server
await api.storeKeys({
  publicKey,
  encryptedPersonalKey,
  encryptedPrivateKey,
  nonce,
  salt
});
```

## Vault Unlock

```javascript
// 1. SRP6a authentication
const srpProof = await srp.login(email, password);
const { token, encryptedKeys } = await api.login(srpProof);

// 2. Derive key from password
const derivedKey = crypto_pwhash(
  password, storedSalt,
  OPSLIMIT_INTERACTIVE,
  MEMLIMIT_INTERACTIVE,
  32
);

// 3. Decrypt private key
const privateKey = crypto_secretbox_open_easy(
  encryptedPrivateKey, nonce, derivedKey
);

// 4. Decrypt personal encryption key
const personalKey = crypto_box_open_easy(
  encryptedPersonalKey, privateKey, publicKey
);

// 5. Decrypt vault data
const plaintext = crypto_secretbox_open_easy(
  ciphertext, vaultNonce, personalKey
);
```

## Team Sharing

```javascript
// Owner shares vault with Alice
const teamVaultKey = randombytes_buf(32);

// Encrypt for Alice
const encryptedForAlice = crypto_box_easy(
  teamVaultKey, alicePublicKey, ownerPrivateKey
);

// Create MAC
const mac = crypto_generichash(teamVaultKey, ownerPublicKey);

// Store on server
await api.shareVault({
  vaultId,
  memberId: alice.id,
  encryptedKey: encryptedForAlice,
  mac
});

// Alice decrypts
const teamVaultKey = crypto_box_open_easy(
  encryptedForAlice, alicePrivateKey, ownerPublicKey
);

// Verify MAC
const expectedMac = crypto_generichash(teamVaultKey, ownerPublicKey);
if (!mac_equal(mac, expectedMac)) throw new Error('Invalid MAC');
```

## Security Properties

- **Zero-Knowledge**: Server never sees plaintext
- **Forward Secrecy**: Ephemeral keys for each session
- **Integrity**: Poly1305 MAC on all encrypted data
- **Authenticity**: SRP6a prevents man-in-the-middle
- **Memory Safety**: Libsodium handles memory securely
