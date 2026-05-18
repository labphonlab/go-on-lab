"use client";

import React, { useState } from "react";
import type { ResultFileInfo } from "@/app/lib/storage/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function ResultsTable({
  experimentId,
  initialFiles,
}: {
  experimentId: string;
  initialFiles: ResultFileInfo[];
}) {
  const [files, setFiles] = useState<ResultFileInfo[]>(initialFiles);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function softDelete(filename: string) {
    if (
      !confirm(
        `${filename} を削除リクエスト中。被験者からの撤回要求の場合などに使用してください。元データはトムストーン領域へ移動されます。よろしいですか？`,
      )
    )
      return;
    setDeleting(filename);
    try {
      const resp = await fetch(
        `/api/admin/results/${experimentId}?file=${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      if (resp.ok) {
        setFiles((prev) => prev.filter((f) => f.filename !== filename));
      }
    } finally {
      setDeleting(null);
    }
  }

  if (files.length === 0) {
    return (
      <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
        まだ結果がありません。被験者が完了するとここに表示されます。
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-slate-950/60">
          <tr className="text-xs text-slate-500 uppercase tracking-wider">
            <th className="px-4 py-3 text-left">参加者</th>
            <th className="px-4 py-3 text-left">SHA-256</th>
            <th className="px-4 py-3 text-right">サイズ</th>
            <th className="px-4 py-3 text-right">受信時刻</th>
            <th className="px-4 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {files.map((f) => (
            <tr key={f.filename} className="hover:bg-slate-800/30">
              <td className="px-4 py-3 font-mono text-xs text-slate-300">
                {f.participantId ?? "—"}
              </td>
              <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                {f.sha256 ? f.sha256.slice(0, 12) : "—"}
              </td>
              <td className="px-4 py-3 text-right text-xs text-slate-400">
                {formatBytes(f.size)}
              </td>
              <td className="px-4 py-3 text-right text-xs text-slate-400 font-mono">
                {new Date(f.mtime).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <a
                  href={`/api/admin/results/${experimentId}?file=${encodeURIComponent(f.filename)}`}
                  className="text-xs text-emerald-400 hover:text-emerald-300 mr-3"
                >
                  DL
                </a>
                <button
                  onClick={() => softDelete(f.filename)}
                  disabled={deleting === f.filename}
                  className="text-xs text-rose-400 hover:text-rose-300 disabled:text-slate-600"
                >
                  撤回
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
