const DEVICE_ID_STORAGE_KEY = "shareit_device_id";

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  try {
    const existingId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existingId) return existingId;

    const nextId = generateDeviceId();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return generateDeviceId();
  }
}
