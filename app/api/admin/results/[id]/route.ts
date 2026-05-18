import { isAdminRequest } from "@/app/lib/admin-auth";
import { isValidDesignId } from "@/app/lib/design";
import { listResultsFor, readResultFile } from "@/app/lib/design-store";

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
  const url = new URL(request.url);
  const file = url.searchParams.get("file");
  if (file) {
    const content = await readResultFile(id, file);
    if (content === null)
      return Response.json({ ok: false, error: "not found" }, { status: 404 });
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  }
  const list = await listResultsFor(id);
  return Response.json({ ok: true, files: list });
}
