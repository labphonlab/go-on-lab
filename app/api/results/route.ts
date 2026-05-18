import { promises as fs } from "node:fs";
import path from "node:path";
import { isValidDesignId } from "@/app/lib/design";
import { resultsDirFor, ROOT_DIR } from "@/app/lib/design-store";

const MAX_BODY_BYTES = 4_000_000;
const ID_PATTERN = /^P-[A-Z0-9-]{6,64}$/;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const ctype = request.headers.get("content-type") ?? "";
  if (!ctype.includes("application/json")) {
    return Response.json(
      { ok: false, error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  const cl = request.headers.get("content-length");
  if (cl && Number(cl) > MAX_BODY_BYTES) {
    return Response.json(
      { ok: false, error: "Payload too large" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const obj = body as Record<string, unknown>;
  const pid = typeof obj.participantId === "string" ? obj.participantId : "";
  if (!ID_PATTERN.test(pid)) {
    return Response.json(
      { ok: false, error: "Invalid participantId" },
      { status: 400 },
    );
  }
  const experimentId =
    typeof obj.experimentId === "string" && isValidDesignId(obj.experimentId)
      ? obj.experimentId
      : "default";

  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) {
    return Response.json(
      { ok: false, error: "Payload too large" },
      { status: 413 },
    );
  }

  const targetDir = resultsDirFor(experimentId);
  try {
    await fs.mkdir(targetDir, { recursive: true });
  } catch (e) {
    return Response.json(
      { ok: false, error: "Storage unavailable", detail: String(e) },
      { status: 500 },
    );
  }

  const safePid = pid.replace(/[^A-Z0-9-]/g, "_");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${safePid}__${stamp}.json`;
  const filepath = path.join(targetDir, filename);

  try {
    await fs.writeFile(filepath, serialized, { encoding: "utf8", flag: "wx" });
  } catch (e) {
    return Response.json(
      { ok: false, error: "Write failed", detail: String(e) },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    experimentId,
    filename,
    relativePath: path.relative(ROOT_DIR, filepath),
  });
}

export async function GET() {
  return Response.json(
    { ok: false, error: "Use POST" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
