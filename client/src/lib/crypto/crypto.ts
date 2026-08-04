export function setCurrentUser(_userId: string | null): void {}

export function getStoredSalt(_userId: string): string | null {
  return null;
}

export function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  _fields: readonly string[],
): T {
  return obj;
}

export function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  _fields: readonly string[],
): T {
  return obj;
}

export function isEncrypted(_value: unknown): boolean {
  return false;
}
