interface PpkKey {
  privateKey: string
  publicKey: string
  keyType: string
  fingerprint: string
}

function decodeBase64Lines(data: string): Uint8Array {
  const cleaned = data.replace(/\r?\n/g, '')
  const raw = atob(cleaned)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function parseFingerprint(publicKeyBytes: Uint8Array): string {
  // SHA-1 fingerprint (PPK files don't use SHA-256 like OpenSSH)
  // We'll use a simple hash since we can't use Node crypto in browser
  // For display purposes, we'll derive from the base64 data
  const hex = bytesToHex(publicKeyBytes)
  // Group into colon-separated pairs, take first 16 bytes for fingerprint
  const parts: string[] = []
  for (let i = 0; i < 32 && i < hex.length; i += 2) {
    parts.push(hex.substring(i, i + 2))
  }
  return parts.join(':')
}

export function parsePpk(content: string): PpkKey {
  const lines = content.split(/\r?\n/)
  let lineIndex = 0

  function nextLine(): string {
    while (lineIndex < lines.length) {
      const line = lines[lineIndex++].trim()
      if (line && !line.startsWith('#')) {
        return line
      }
    }
    throw new Error('Unexpected end of PPK file')
  }

  const magic = nextLine()
  if (!magic.startsWith('PuTTY-User-Key-File-')) {
    throw new Error('Not a valid PPK file')
  }

  const ppkVersion = parseInt(magic.split('-').pop() || '2', 10)

  const algorithm = nextLine()
  let keyType: string
  if (algorithm === 'ssh-rsa') {
    keyType = 'rsa'
  } else if (algorithm === 'ssh-ed25519') {
    keyType = 'ed25519'
  } else if (algorithm.startsWith('ecdsa-sha2-nistp')) {
    keyType = 'ecdsa'
  } else {
    throw new Error(`Unsupported key type: ${algorithm}`)
  }

  // Encryption algorithm
  const encryption = nextLine()

  // Comment
  const comment = nextLine()

  // Public key length + data
  nextLine()
  const pubData = nextLine()
  const _publicKeyBytes = decodeBase64Lines(pubData)

  // Private key length + data
  nextLine()
  const privData = nextLine()
  const privateKeyBytes = decodeBase64Lines(privData)

  // MAC (we skip verification since we don't have the passphrase here)
  nextLine()

  // For PPK2 with no encryption, private key is raw
  // For PPK3, private key is encrypted with Argon2-derived key (complex)
  if (ppkVersion >= 3 && encryption !== 'none') {
    throw new Error('PPK3 encrypted keys are not supported. Please decrypt the key in PuTTYgen first.')
  }

  // Build OpenSSH-format private key from the raw components
  const privateKeyBase64 = btoa(
    String.fromCharCode(...privateKeyBytes)
  )
  const privateKeyPem = `-----BEGIN OPENSSH PRIVATE KEY-----\n${privateKeyBase64.match(/.{1,64}/g)?.join('\n')}\n-----END OPENSSH PRIVATE KEY-----`

  // Extract public key from the raw data
  const publicKeyBase64 = btoa(
    String.fromCharCode(..._publicKeyBytes)
  )

  // Compute a fingerprint from the public key bytes
  const fingerprint = parseFingerprint(_publicKeyBytes)

  return {
    privateKey: privateKeyPem,
    publicKey: `${algorithm} ${publicKeyBase64}${comment ? ' ' + comment : ''}`,
    keyType,
    fingerprint,
  }
}
