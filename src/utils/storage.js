export function readList(key) {
  try {
    const raw = globalThis.PortalStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeList(key, value) {
  globalThis.PortalStorage.setItem(key, JSON.stringify(value));
}
