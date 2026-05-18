import crypto from "node:crypto";
import { isValidDesignId } from "@/app/lib/design";
import { getBackend } from "@/app/lib/storage";

const MAX_BODY_BYTES = 4_000_000;
const ID_PATTERN = /^P-[A-Z0-9-]{6,64}$/;
const IDEM_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

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

  const rawText = await request.text().catch(() => null);
  if (rawText === null) {
    return Response.json({ ok: false, error: "Read failed" }, { status: 400 });
  }
  if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
    return Response.json(
      { ok: false, error: "Payload too large" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
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

  const idempotencyHeader =
    request.headers.get("idempotency-key") ||
    (typeof obj.idempotencyKey === "string" ? obj.idempotencyKey : null);
  const idempotencyKey =
    idempotencyHeader && IDEM_PATTERN.test(idempotencyHeader)
      ? idempotencyHeader
      : null;

  const sha256 = crypto.createHash("sha256").update(rawText).digest("hex");

  try {
    const backend = await getBackend();
    const result = await backend.results.put({
      experimentId,
      participantId: pid,
      idempotencyKey,
      payload: rawText,
      sha256,
    });
    return Response.json({
      ok: true,
      experimentId,
      filename: result.filename,
      sha256: result.sha256,
      receivedAt: result.receivedAt,
      duplicated: result.duplicated,
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/EEXIST|already exists|ALREADY_EXISTS/i.test(msg)) {
      return Response.json({ ok: false, error: "Duplicate" }, { status: 409 });
    }
    return Response.json(
      { ok: false, error: "Storage error", detail: msg },
      { status: 500 },
    );
  }
}

export async function GET() {
  return Response.json(
    { ok: false, error: "Use POST" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
