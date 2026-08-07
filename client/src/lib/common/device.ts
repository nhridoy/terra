import { load } from "@tauri-apps/plugin-store";

const AUTH_SETTINGS_FILE = "auth.json";
const DEVICE_ID_KEY = "deviceId";

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const store = await load(AUTH_SETTINGS_FILE, { autoSave: false });
    let id = await store.get<string>(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      await store.set(DEVICE_ID_KEY, id);
      await store.save();
    }
    cachedDeviceId = id;
    return id;
  } catch {
    return "default-device";
  }
}

export async function setUserId(_userId: string): Promise<void> {}
