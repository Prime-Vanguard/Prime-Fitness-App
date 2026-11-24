type Area = "local" | "session";
const area = (where: Area) => (where === "local" ? localStorage : sessionStorage);

/**
 * Device storage for optional UI memory (celebration baselines, "since last visit").
 * Private mode or browser policy can block storage; reads then return null and writes
 * report false, so callers treat it as a first visit.
 */
export function readDevice(key: string, where: Area = "local"): string | null {
  try {
    return area(where).getItem(key);
  } catch {
    return null;
  }
}

export function writeDevice(key: string, value: string, where: Area = "local"): boolean {
  try {
    area(where).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Parsed JSON, or null when missing, unreadable or not JSON. Validate the shape after. */
export function readDeviceJson(key: string, where: Area = "local"): unknown {
  try {
    return JSON.parse(readDevice(key, where) ?? "null");
  } catch {
    return null;
  }
}

export function removeDevice(key: string, where: Area = "local") {
  try {
    area(where).removeItem(key);
  } catch {
    /* Nothing to remove when storage is unavailable. */
  }
}
