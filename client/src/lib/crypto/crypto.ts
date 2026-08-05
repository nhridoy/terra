import { invoke } from "@tauri-apps/api/core";
import {
  deletePasswords,
  getPasswords,
  setPasswords,
} from "tauri-plugin-keyring-store-api";

export interface AccountMaterial {
  salt_cl: string;
  recovery_code: string;
  public_key: string;
  private_key_wrapped_by_dek: string;
}

export interface KeyringRows {
  dek_wrapped_by_kek: string;
  dek_wrapped_by_recovery: string;
  private_key_wrapped_by_dek: string;
}

export interface LoginProof {
  verifier: string;
  proof: string;
}

let currentUserId: string | null = null;

export function setCurrentUser(userId: string | null): void {
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function getStoredSalt(_userId: string): string | null {
  return null;
}

export function isEncrypted(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const parsed = JSON.parse(value);
    return (
      parsed.v === 1 &&
      typeof parsed.alg === "string" &&
      typeof parsed.nonce === "string" &&
      typeof parsed.ct === "string"
    );
  } catch {
    return false;
  }
}

export async function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[],
): Promise<T> {
  const result = { ...obj } as Record<string, unknown>;
  for (const field of fields) {
    const value = result[field];
    if (typeof value === "string") {
      result[field] = await invoke<string>("encrypt_secret", {
        plaintext: value,
        recordType: field,
      });
    }
  }
  return result as T;
}

export async function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[],
): Promise<T> {
  const result = { ...obj } as Record<string, unknown>;
  for (const field of fields) {
    const value = result[field];
    if (typeof value === "string") {
      result[field] = await invoke<string>("decrypt_secret", {
        payload: value,
      });
    }
  }
  return result as T;
}

export async function generateAccountMaterial(): Promise<AccountMaterial> {
  return invoke<AccountMaterial>("generate_account_material");
}

export async function deriveKek(
  password: string,
  saltCl: string,
): Promise<void> {
  return invoke<void>("derive_kek", { password, saltCl });
}

export async function computeLoginProof(
  serverSalt: string,
  nonce: string,
): Promise<LoginProof> {
  return invoke<LoginProof>("compute_login_proof", {
    serverSalt,
    nonce,
  });
}

export async function buildKeyringRows(
  kek: string,
  recoveryCode: string,
): Promise<KeyringRows> {
  return invoke<KeyringRows>("build_keyring_rows", { kek, recoveryCode });
}

export async function encryptSecret(
  plaintext: string,
  recordType: string,
): Promise<string> {
  return invoke<string>("encrypt_secret", { plaintext, recordType });
}

export async function decryptSecret(payload: string): Promise<string> {
  return invoke<string>("decrypt_secret", { payload });
}

export async function unwrapDek(wrapped: string): Promise<void> {
  return invoke<void>("unwrap_dek", { wrapped });
}

export async function recoveryUnwrapDek(
  recoveryCode: string,
  saltCl: string,
  wrapped: string,
): Promise<void> {
  return invoke<void>("recovery_unwrap_dek", { recoveryCode, saltCl, wrapped });
}

export async function signChallenge(nonce: string): Promise<string> {
  return invoke<string>("sign_challenge", { nonce });
}

export async function lockSession(): Promise<void> {
  return invoke<void>("lock_session");
}

export async function unlock(
  password: string,
  saltCl: string,
  wrappedDek: string,
): Promise<void> {
  return invoke<void>("unlock", { password, saltCl, wrappedDek });
}

export async function wrapDek(): Promise<string> {
  return invoke<string>("wrap_dek");
}

const REFRESH_TOKEN_ACCOUNT = "auth.refresh_token";

export async function saveRefreshToken(token: string): Promise<void> {
  await setPasswords([{ account: REFRESH_TOKEN_ACCOUNT, secret: token }]);
}

export async function loadRefreshToken(): Promise<string | null> {
  const [value] = await getPasswords([REFRESH_TOKEN_ACCOUNT]);
  return value;
}

export async function clearKeychain(): Promise<void> {
  await deletePasswords([REFRESH_TOKEN_ACCOUNT]);
}

let inMemoryRefreshToken: string | null = null;

export function setRefreshToken(token: string | null): void {
  inMemoryRefreshToken = token;
}

export function getRefreshToken(): string | null {
  return inMemoryRefreshToken;
}
