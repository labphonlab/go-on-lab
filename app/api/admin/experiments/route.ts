import { isAdminRequest } from "@/app/lib/admin-auth";
import { isValidDesignId } from "@/app/lib/design";
import { createDesign, listDesigns } from "@/app/lib/design-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return unauthorized();
  const list = await listDesigns();
  return Response.json({ ok: true, designs: list });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const obj = body as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : "";
  if (!isValidDesignId(id)) {
    return Response.json(
      { ok: false, error: "Invalid id (3-32 chars, [a-z0-9_-])" },
      { status: 400 },
    );
  }
  try {
    const design = await createDesign(id, obj);
    return Response.json({ ok: true, design }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json(
      { ok: false, error: msg === "exists" ? "Design already exists" : msg },
      { status: msg === "exists" ? 409 : 500 },
    );
  }
}
