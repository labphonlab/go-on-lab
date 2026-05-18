import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/app/lib/admin-guard";
import { getDesign, listResultsFor } from "@/app/lib/design-store";
import { AdminShell } from "../../../AdminShell";
import { pickLocalized } from "@/app/lib/i18n";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
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
        </div>

        {files.length === 0 ? (
          <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
            まだ結果がありません。被験者が完了するとここに表示されます。
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60">
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">ファイル</th>
                  <th className="px-4 py-3 text-right">サイズ</th>
                  <th className="px-4 py-3 text-right">日時</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {files.map((f) => (
                  <tr key={f.filename} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300 break-all">
                      {f.filename}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">
                      {formatBytes(f.size)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 font-mono">
                      {new Date(f.mtime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/api/admin/results/${id}?file=${encodeURIComponent(f.filename)}`}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        ダウンロード
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
