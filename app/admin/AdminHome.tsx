"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExperimentDesign } from "@/app/lib/design";
import { pickLocalized } from "@/app/lib/i18n";
import { AdminShell } from "./AdminShell";

const STATUS_LABEL: Record<ExperimentDesign["status"], string> = {
  draft: "下書き",
  active: "公開中",
  closed: "終了",
};

const STATUS_COLOR: Record<ExperimentDesign["status"], string> = {
  draft: "bg-slate-700 text-slate-300",
  active: "bg-emerald-600 text-white",
  closed: "bg-rose-700 text-rose-100",
};

export function AdminHome({
  initialDesigns,
}: {
  initialDesigns: ExperimentDesign[];
}) {
  const [designs, setDesigns] = useState<ExperimentDesign[]>(initialDesigns);
  const [newId, setNewId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();

  async function createExperiment(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!/^[a-z0-9][a-z0-9_-]{2,32}$/.test(newId)) {
      setCreateError("IDは 3〜33 文字、小文字 + 数字 + - / _ で先頭は英数。");
      return;
    }
    setCreating(true);
    try {
      const resp = await fetch("/api/admin/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId }),
      });
      const j = await resp.json().catch(() => ({}));
      if (resp.ok && j.ok && j.design) {
        setDesigns((d) => [j.design, ...d]);
        setNewId("");
        router.push(`/admin/experiments/${j.design.id}`);
      } else {
        setCreateError(j.error || `HTTP ${resp.status}`);
      }
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-emerald-400 mb-3 tracking-widest uppercase">
            新規実験を作成
          </h2>
          <form onSubmit={createExperiment} className="flex flex-col sm:flex-row gap-3">
            <input
              value={newId}
              onChange={(e) =>
                setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
              }
              placeholder="例: fdl-2026fall"
              maxLength={32}
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={creating || newId.length < 3}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold transition"
            >
              作成して編集 →
            </button>
          </form>
          {createError && (
            <p className="text-rose-400 text-xs mt-2">{createError}</p>
          )}
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            IDはURLに使われます: <code>/e/{newId || "exp-id"}</code>
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-slate-400 mb-3 tracking-widest uppercase">
            実験一覧 ({designs.length})
          </h2>
          {designs.length === 0 ? (
            <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
              実験がまだありません。
            </div>
          ) : (
            <div className="grid gap-3">
              {designs.map((d) => (
                <Link
                  key={d.id}
                  href={`/admin/experiments/${d.id}`}
                  className="bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {pickLocalized(d.title, d.defaultLocale)}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {d.id}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded ${STATUS_COLOR[d.status]}`}
                    >
                      {STATUS_LABEL[d.status]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2 font-mono">
                    Updated: {new Date(d.updatedAt).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
