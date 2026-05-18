import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  type ExperimentDesign,
  isValidDesignId,
} from "../design";
import type {
  Backend,
  DesignStore,
  PutResult,
  ResultFileInfo,
  ResultsStore,
  SecretsStore,
  StoredResult,
} from "./types";

const ROOT_DIR = process.env.EXPERIMENT_DATA_DIR
  ? path.resolve(process.env.EXPERIMENT_DATA_DIR)
  : path.join(process.cwd(), "data");
const DESIGNS_DIR = path.join(ROOT_DIR, "experiments");
const RESULTS_DIR = path.join(ROOT_DIR, "results");
const SECRET_PATH = path.join(ROOT_DIR, ".admin-secret");

async function ensureDirs() {
  await fs.mkdir(DESIGNS_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });
}

function designPath(id: string): string {
  if (!isValidDesignId(id)) throw new Error("invalid id");
  return path.join(DESIGNS_DIR, `${id}.json`);
}

function resultsDirFor(experimentId: string): string {
  if (!isValidDesignId(experimentId)) throw new Error("invalid id");
  return path.join(RESULTS_DIR, experimentId);
}

class FsDesignStore implements DesignStore {
  async list(): Promise<ExperimentDesign[]> {
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
        /* skip */
      }
    }
    out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return out;
  }
  async get(id: string): Promise<ExperimentDesign | null> {
    if (!isValidDesignId(id)) return null;
    await ensureDirs();
    try {
      const txt = await fs.readFile(designPath(id), "utf8");
      return JSON.parse(txt) as ExperimentDesign;
    } catch {
      return null;
    }
  }
  async put(id: string, design: ExperimentDesign): Promise<ExperimentDesign> {
    await ensureDirs();
    await fs.writeFile(designPath(id), JSON.stringify(design, null, 2), {
      encoding: "utf8",
    });
    return design;
  }
  async delete(id: string): Promise<boolean> {
    if (!isValidDesignId(id)) return false;
    try {
      await fs.unlink(designPath(id));
      return true;
    } catch {
      return false;
    }
  }
}

class FsResultsStore implements ResultsStore {
  async put(args: {
    experimentId: string;
    participantId: string;
    idempotencyKey: string | null;
    payload: string;
    sha256: string;
  }): Promise<PutResult> {
    const dir = resultsDirFor(args.experimentId);
    await fs.mkdir(dir, { recursive: true });
    const receivedAt = new Date().toISOString();
    const idemDir = path.join(dir, ".idem");
    if (args.idempotencyKey) {
      try {
        await fs.mkdir(idemDir, { recursive: true });
        const idemPath = path.join(idemDir, args.idempotencyKey);
        const previous = await fs.readFile(idemPath, "utf8").catch(() => null);
        if (previous) {
          const parsed = JSON.parse(previous) as PutResult;
          return { ...parsed, duplicated: true };
        }
      } catch {
        /* fall through */
      }
    }
    const safePid = args.participantId.replace(/[^A-Z0-9-]/g, "_");
    const stamp = receivedAt.replace(/[:.]/g, "-");
    const filename = `${safePid}__${stamp}__${args.sha256.slice(0, 8)}.json`;
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, args.payload, { encoding: "utf8", flag: "wx" });
    const result: PutResult = {
      filename,
      sha256: args.sha256,
      receivedAt,
      duplicated: false,
    };
    if (args.idempotencyKey) {
      const idemPath = path.join(idemDir, args.idempotencyKey);
      await fs
        .writeFile(idemPath, JSON.stringify(result), { encoding: "utf8" })
        .catch(() => undefined);
    }
    return result;
  }
  async list(experimentId: string): Promise<ResultFileInfo[]> {
    const dir = resultsDirFor(experimentId);
    try {
      const files = await fs.readdir(dir);
      const out: ResultFileInfo[] = [];
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        if (f.startsWith(".")) continue;
        const st = await fs.stat(path.join(dir, f)).catch(() => null);
        if (st) {
          const m = f.match(/^(P-[^_]+)__.+__([a-f0-9]{8})\.json$/i);
          out.push({
            filename: f,
            size: st.size,
            mtime: st.mtime.toISOString(),
            participantId: m?.[1],
            sha256: m?.[2],
          });
        }
      }
      out.sort((a, b) => b.mtime.localeCompare(a.mtime));
      return out;
    } catch {
      return [];
    }
  }
  async get(experimentId: string, filename: string): Promise<StoredResult | null> {
    if (!/^[A-Z0-9_.-]+\.json$/i.test(filename)) return null;
    const fp = path.join(resultsDirFor(experimentId), filename);
    try {
      const content = await fs.readFile(fp, "utf8");
      return { content, contentType: "application/json; charset=utf-8" };
    } catch {
      return null;
    }
  }
  async softDelete(experimentId: string, filename: string): Promise<boolean> {
    if (!/^[A-Z0-9_.-]+\.json$/i.test(filename)) return false;
    const dir = resultsDirFor(experimentId);
    const fp = path.join(dir, filename);
    try {
      const txt = await fs.readFile(fp, "utf8");
      const parsed = JSON.parse(txt) as Record<string, unknown>;
      parsed.deletedAt = new Date().toISOString();
      const tombstoneDir = path.join(dir, ".deleted");
      await fs.mkdir(tombstoneDir, { recursive: true });
      await fs.writeFile(
        path.join(tombstoneDir, filename),
        JSON.stringify(parsed),
        { encoding: "utf8" },
      );
      await fs.unlink(fp);
      return true;
    } catch {
      return false;
    }
  }
}

class FsSecretsStore implements SecretsStore {
  async getOrCreateAdminSecret(): Promise<string> {
    if (process.env.ADMIN_SECRET && process.env.ADMIN_SECRET.length >= 32) {
      return process.env.ADMIN_SECRET;
    }
    try {
      const s = await fs.readFile(SECRET_PATH, "utf8");
      if (s.length >= 32) return s;
    } catch {
      /* fall through */
    }
    const fresh = crypto.randomBytes(48).toString("hex");
    await fs.mkdir(ROOT_DIR, { recursive: true });
    await fs.writeFile(SECRET_PATH, fresh, { encoding: "utf8", mode: 0o600 });
    return fresh;
  }
}

export class FilesystemBackend implements Backend {
  readonly name = "filesystem";
  readonly designs = new FsDesignStore();
  readonly results = new FsResultsStore();
  readonly secrets = new FsSecretsStore();
}
