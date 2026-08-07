import { load } from "@tauri-apps/plugin-store";
import {
  deletePasswords,
  getPasswords,
  setPasswords,
} from "tauri-plugin-keyring-store-api";

export const KEYCHAIN_INACTIVE_DAYS = 14;
export const KEYCHAIN_MAX_AGE_DAYS = 90;

export const PASSWORD_ACCOUNT = "auth.password";
const META_FILE = "keychain-meta.json";
const META_KEYS = {
  setAt: "set_at",
  lastUsedAt: "last_used_at",
} as const;

interface KeychainMeta {
  set_at: number;
  last_used_at: number;
}

async function readMeta(): Promise<KeychainMeta | null> {
  try {
    const store = await load(META_FILE, { autoSave: false });
    const setAt = await store.get<number>(META_KEYS.setAt);
    const lastUsedAt = await store.get<number>(META_KEYS.lastUsedAt);
    if (typeof setAt !== "number" || typeof lastUsedAt !== "number") {
      return null;
    }
    return { set_at: setAt, last_used_at: lastUsedAt };
  } catch {
    return null;
  }
}

async function writeMeta(meta: KeychainMeta): Promise<void> {
  const store = await load(META_FILE, { autoSave: false });
  await store.set(META_KEYS.setAt, meta.set_at);
  await store.set(META_KEYS.lastUsedAt, meta.last_used_at);
  await store.save();
}

function daysBetween(now: number, then: number): number {
  return Math.max(0, (now - then) / (24 * 60 * 60 * 1000));
}

export function shouldEvict(
  setAt: number | null,
  lastUsedAt: number | null,
  now: number,
  inactiveDays: number = KEYCHAIN_INACTIVE_DAYS,
  maxAgeDays: number = KEYCHAIN_MAX_AGE_DAYS,
): boolean {
  if (typeof setAt !== "number" || typeof lastUsedAt !== "number") {
    return true;
  }
  return (
    daysBetween(now, lastUsedAt) > inactiveDays ||
    daysBetween(now, setAt) > maxAgeDays
  );
}

export async function savePassword(password: string): Promise<void> {
  await setPasswords([{ account: PASSWORD_ACCOUNT, secret: password }]);
  const now = Date.now();
  await writeMeta({ set_at: now, last_used_at: now });
}

async function policyDays(): Promise<{ inactive: number; maxAge: number }> {
  const envInactive = Number(import.meta.env.VITE_KEYCHAIN_INACTIVE_DAYS);
  const envMaxAge = Number(import.meta.env.VITE_KEYCHAIN_MAX_AGE_DAYS);
  const fallback = {
    inactive:
      Number.isFinite(envInactive) && envInactive > 0
        ? envInactive
        : KEYCHAIN_INACTIVE_DAYS,
    maxAge:
      Number.isFinite(envMaxAge) && envMaxAge > 0
        ? envMaxAge
        : KEYCHAIN_MAX_AGE_DAYS,
  };
  try {
    const store = await load(META_FILE, { autoSave: false });
    const rawInactive = await store.get<number>("inactive_days");
    const rawMaxAge = await store.get<number>("max_age_days");
    return {
      inactive:
        typeof rawInactive === "number" && rawInactive >= 0
          ? rawInactive
          : fallback.inactive,
      maxAge:
        typeof rawMaxAge === "number" && rawMaxAge >= 0
          ? rawMaxAge
          : fallback.maxAge,
    };
  } catch {
    return fallback;
  }
}

export async function loadPassword(): Promise<string | null> {
  const [password] = await getPasswords([PASSWORD_ACCOUNT]);
  if (!password) {
    return null;
  }

  const meta = await readMeta();
  const now = Date.now();
  const { inactive, maxAge } = await policyDays();
  if (
    shouldEvict(
      meta?.set_at ?? null,
      meta?.last_used_at ?? null,
      now,
      inactive,
      maxAge,
    )
  ) {
    await deletePassword();
    return null;
  }

  // Refresh last-use timestamp so inactivity is measured from the last unlock.
  const refreshed = {
    set_at: meta?.set_at ?? now,
    last_used_at: now,
  };
  try {
    await writeMeta(refreshed);
  } catch {
    // ignoring meta write failures keeps auto-unlock best-effort
  }
  return password;
}

export async function deletePassword(): Promise<void> {
  await deletePasswords([PASSWORD_ACCOUNT]);
  try {
    await writeMeta({ set_at: 0, last_used_at: 0 });
  } catch {
    // ignore
  }
}

export async function passwordExists(): Promise<boolean> {
  const [password] = await getPasswords([PASSWORD_ACCOUNT]);
  return Boolean(password);
}
