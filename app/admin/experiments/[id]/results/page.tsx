import { notFound } from "next/navigation";
import { requireAdmin } from "@/app/lib/admin-guard";
import { getDesign, listResultsFor } from "@/app/lib/design-store";
import { AdminShell } from "../../../AdminShell";
import { pickLocalized } from "@/app/lib/i18n";
import { ResultsTable } from "./ResultsTable";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) notFound();
  const files = await listResultsFor(id);

  return (
    <AdminShell
      title={`結果: ${pickLocalized(design.title, design.defaultLocale)}`}
      back={{ href: `/admin/experiments/${id}`, label: "編集に戻る" }}
    >
      <div className="space-y-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500 mb-1 tracking-widest uppercase font-bold">
            実験 ID
          </div>
          <div className="font-mono text-slate-200">{id}</div>
          <div className="text-xs text-slate-500 mt-3">
            参加者数: <span className="text-white font-bold">{files.length}</span>
          </div>
          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`/api/admin/results/${id}/csv?view=sessions`}
                className="inline-flex items-center px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-lg"
              >
                CSV (1行 = 1参加者)
              </a>
              <a
                href={`/api/admin/results/${id}/csv?view=trials`}
                className="inline-flex items-center px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-lg"
              >
                CSV (1行 = 1試行)
              </a>
              <a
                href={`/api/admin/results/${id}/export`}
                className="inline-flex items-center px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-bold rounded-lg"
              >
                JSONL (生データ)
              </a>
            </div>
          )}
        </div>

        <ResultsTable experimentId={id} initialFiles={files} />
      </div>
    </AdminShell>
  );
}
