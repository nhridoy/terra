let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  cachedDeviceId = "dev-local";
  return cachedDeviceId;
}

export async function setUserId(_userId: string): Promise<void> {}
