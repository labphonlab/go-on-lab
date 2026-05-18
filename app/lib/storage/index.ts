import "server-only";
import type { Backend } from "./types";

let cached: Backend | null = null;

export async function getBackend(): Promise<Backend> {
  if (cached) return cached;
  const which = (process.env.STORAGE_BACKEND || "filesystem").toLowerCase();
  if (which === "firestore") {
    const { FirestoreBackend } = await import("./firestore");
    cached = new FirestoreBackend();
    return cached;
  }
  const { FilesystemBackend } = await import("./fs");
  cached = new FilesystemBackend();
  return cached;
}

export type { Backend } from "./types";
