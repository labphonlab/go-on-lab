import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  type ExperimentDesign,
  isValidDesignId,
  makeDefaultDesign,
  sanitizeDesign,
} from "./design";

const ROOT_DIR =
  process.env.EXPERIMENT_DATA_DIR
    ? path.resolve(process.env.EXPERIMENT_DATA_DIR)
    : path.join(process.cwd(), "data");

const DESIGNS_DIR = path.join(ROOT_DIR, "experiments");
const RESULTS_DIR = path.join(ROOT_DIR, "results");

async function ensureDirs(): Promise<void> {
  await fs.mkdir(DESIGNS_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });
}

function designPath(id: string): string {
  if (!isValidDesignId(id)) throw new Error("invalid id");
  return path.join(DESIGNS_DIR, `${id}.json`);
}

export function resultsDirFor(experimentId: string): string {
  if (!isValidDesignId(experimentId)) throw new Error("invalid id");
  return path.join(RESULTS_DIR, experimentId);
}

export async function listDesigns(): Promise<ExperimentDesign[]> {
  await ensureDirs();
  const entries = await fs.readdir(DESIGNS_DIR).catch(() => []);
  const out: ExperimentDesign[] = [];
  for (const file of entries) {
    if (!file.endsWith(".json")) continue;
    try {
      const txt = await fs.readFile(path.join(DESIGNS_DIR, file), "utf8");
      const parsed = JSON.parse(txt);
      if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
        out.push(parsed as ExperimentDesign);
      }
    } catch {
      /* skip malformed */
    }
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

export async function getDesign(id: string): Promise<ExperimentDesign | null> {
  if (!isValidDesignId(id)) return null;
  await ensureDirs();
  try {
    const txt = await fs.readFile(designPath(id), "utf8");
    return JSON.parse(txt) as ExperimentDesign;
  } catch {
    return null;
  }
}

export async function createDesign(
  id: string,
  patch: unknown,
): Promise<ExperimentDesign> {
  if (!isValidDesignId(id)) throw new Error("invalid id");
  await ensureDirs();
  const existing = await getDesign(id);
  if (existing) throw new Error("exists");
  const base = makeDefaultDesign(id);
  const sanitized = sanitizeDesign(base, patch);
  sanitized.id = id;
  await fs.writeFile(designPath(id), JSON.stringify(sanitized, null, 2), {
    encoding: "utf8",
    flag: "wx",
  });
  return sanitized;
}

export async function upsertDesign(
  id: string,
  patch: unknown,
): Promise<ExperimentDesign> {
  if (!isValidDesignId(id)) throw new Error("invalid id");
  await ensureDirs();
  const existing = (await getDesign(id)) ?? makeDefaultDesign(id);
  const sanitized = sanitizeDesign(existing, patch);
  sanitized.id = id;
  await fs.writeFile(designPath(id), JSON.stringify(sanitized, null, 2), {
    encoding: "utf8",
  });
  return sanitized;
}

export async function deleteDesign(id: string): Promise<boolean> {
  if (!isValidDesignId(id)) return false;
  try {
    await fs.unlink(designPath(id));
    return true;
  } catch {
    return false;
  }
}

export async function ensureDefaultDesign(): Promise<ExperimentDesign> {
  const existing = await getDesign("default");
  if (existing) return existing;
  const d = makeDefaultDesign("default");
  d.status = "active";
  d.title.ja = "サンプル実験 (default)";
  d.title.en = "Sample Experiment (default)";
  await fs.writeFile(designPath("default"), JSON.stringify(d, null, 2), {
    encoding: "utf8",
  });
  return d;
}

export async function listResultsFor(experimentId: string): Promise<
  { filename: string; size: number; mtime: string }[]
> {
  const dir = resultsDirFor(experimentId);
  try {
    const files = await fs.readdir(dir);
    const out = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const st = await fs.stat(path.join(dir, f)).catch(() => null);
      if (st) {
        out.push({ filename: f, size: st.size, mtime: st.mtime.toISOString() });
      }
    }
    out.sort((a, b) => b.mtime.localeCompare(a.mtime));
    return out;
  } catch {
    return [];
  }
}

export async function readResultFile(
  experimentId: string,
  filename: string,
): Promise<string | null> {
  if (!/^[A-Z0-9_.-]+\.json$/i.test(filename)) return null;
  const fp = path.join(resultsDirFor(experimentId), filename);
  try {
    return await fs.readFile(fp, "utf8");
  } catch {
    return null;
  }
}

export { ROOT_DIR, DESIGNS_DIR, RESULTS_DIR };
