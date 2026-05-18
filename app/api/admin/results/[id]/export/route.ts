import { isAdminRequest } from "@/app/lib/admin-auth";
import { isValidDesignId } from "@/app/lib/design";
import { getBackend } from "@/app/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, ctx: Ctx) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isValidDesignId(id))
    return Response.json({ ok: false, error: "invalid id" }, { status: 400 });

  const backend = await getBackend();
  const files = await backend.results.list(id);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      for (const f of files) {
        if (f.deletedAt) continue;
        const r = await backend.results.get(id, f.filename);
        if (!r) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(r.content);
        } catch {
          continue;
        }
        const enriched = {
          _filename: f.filename,
          _receivedAt: f.mtime,
          _sha256: f.sha256,
          _size: f.size,
          ...((parsed as object) ?? {}),
        };
        controller.enqueue(encoder.encode(JSON.stringify(enriched) + "\n"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}__results.jsonl"`,
      "Cache-Control": "no-store",
    },
  });
}
