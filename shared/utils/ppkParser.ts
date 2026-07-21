export interface PpkKey {
  keyType: string
  publicKey: string
  privateKey: string
  comment?: string
}

export function parsePpk(_content: string): PpkKey {
  // Stub - full PPK parser will be implemented later
  throw new Error('PPK parser not yet implemented')
}
