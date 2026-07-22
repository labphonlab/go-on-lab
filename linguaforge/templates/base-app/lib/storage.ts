// All progress is client-only (phase 1 has no server), namespaced under one
// localStorage key so a course's save data doesn't collide with another
// generated app opened from the same origin during local testing.
const NAMESPACE = "linguaforge";

function key(bucket: string): string {
  return `${NAMESPACE}:${bucket}`;
}

export function loadJSON<T>(bucket: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key(bucket));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(bucket: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(bucket), JSON.stringify(value));
  } catch {
    // storage full or disabled — progress just won't persist this session
  }
}
