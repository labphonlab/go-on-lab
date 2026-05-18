"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AdminShell({
  children,
  title = "Researcher Panel",
  back,
}: {
  children: React.ReactNode;
  title?: string;
  back?: { href: string; label: string };
}) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <Link
            href="/admin"
            className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
          >
            <span className="font-black text-white text-sm tracking-tighter">Go</span>
          </Link>
          <div className="flex-1 min-w-0">
            {back ? (
              <Link
                href={back.href}
                className="text-[10px] text-slate-500 hover:text-slate-300 tracking-widest uppercase font-bold"
              >
                ← {back.label}
              </Link>
            ) : (
              <div className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">
                Go-on Lab · Admin
              </div>
            )}
            <div className="text-sm text-slate-200 font-medium truncate">{title}</div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            ログアウト
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
