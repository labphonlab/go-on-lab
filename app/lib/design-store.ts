import "server-only";
import {
  type ExperimentDesign,
  isValidDesignId,
  makeDefaultDesign,
  sanitizeDesign,
} from "./design";
import { getBackend } from "./storage";

export async function listDesigns(): Promise<ExperimentDesign[]> {
  const b = await getBackend();
  return b.designs.list();
}

export async function getDesign(id: string): Promise<ExperimentDesign | null> {
  if (!isValidDesignId(id)) return null;
  const b = await getBackend();
  return b.designs.get(id);
}

export async function createDesign(
  id: string,
  patch: unknown,
): Promise<ExperimentDesign> {
  if (!isValidDesignId(id)) throw new Error("invalid id");
  const b = await getBackend();
  const existing = await b.designs.get(id);
  if (existing) throw new Error("exists");
  const base = makeDefaultDesign(id);
  const sanitized = sanitizeDesign(base, patch);
  sanitized.id = id;
  return b.designs.put(id, sanitized);
}

export async function upsertDesign(
  id: string,
  patch: unknown,
): Promise<ExperimentDesign> {
  if (!isValidDesignId(id)) throw new Error("invalid id");
  const b = await getBackend();
  const existing = (await b.designs.get(id)) ?? makeDefaultDesign(id);
  const sanitized = sanitizeDesign(existing, patch);
  sanitized.id = id;
  return b.designs.put(id, sanitized);
}

export async function deleteDesign(id: string): Promise<boolean> {
  if (!isValidDesignId(id)) return false;
  const b = await getBackend();
  return b.designs.delete(id);
}

export async function ensureDefaultDesign(): Promise<ExperimentDesign> {
  const b = await getBackend();
  const existing = await b.designs.get("default");
  if (existing) return existing;
  const d = makeDefaultDesign("default");
  d.status = "active";
  d.title.ja = "サンプル実験 (default)";
  d.title.en = "Sample Experiment (default)";
  return b.designs.put("default", d);
}

export async function listResultsFor(experimentId: string) {
  const b = await getBackend();
  return b.results.list(experimentId);
}

export async function readResultFile(
  experimentId: string,
  filename: string,
): Promise<string | null> {
  const b = await getBackend();
  const r = await b.results.get(experimentId, filename);
  return r ? r.content : null;
}

export async function softDeleteResult(
  experimentId: string,
  filename: string,
): Promise<boolean> {
  const b = await getBackend();
  return b.results.softDelete?.(experimentId, filename) ?? false;
}
