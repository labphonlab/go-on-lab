import { isAdminRequest } from "@/app/lib/admin-auth";
import { isValidDesignId } from "@/app/lib/design";
import {
  deleteDesign,
  getDesign,
  upsertDesign,
} from "@/app/lib/design-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: Ctx) {
  if (!(await isAdminRequest(request))) return unauthorized();
  const { id } = await ctx.params;
  if (!isValidDesignId(id))
    return Response.json({ ok: false, error: "invalid id" }, { status: 400 });
  const d = await getDesign(id);
  if (!d)
    return Response.json({ ok: false, error: "not found" }, { status: 404 });
  return Response.json({ ok: true, design: d });
}

export async function PUT(request: Request, ctx: Ctx) {
  if (!(await isAdminRequest(request))) return unauthorized();
  const { id } = await ctx.params;
  if (!isValidDesignId(id))
    return Response.json({ ok: false, error: "invalid id" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const d = await upsertDesign(id, body);
  return Response.json({ ok: true, design: d });
}

export async function DELETE(request: Request, ctx: Ctx) {
  if (!(await isAdminRequest(request))) return unauthorized();
  const { id } = await ctx.params;
  const ok = await deleteDesign(id);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
