export interface KeyItem {
  id: string;
  name: string;
  description?: string;
  keyType: string;
  publicKey: string;
  fingerprint?: string;
  createdAt: string;
}
