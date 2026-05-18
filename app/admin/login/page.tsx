"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await resp.json().catch(() => ({}));
      if (resp.ok && j.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(typeof j.error === "string" ? j.error : "Login failed");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 w-full max-w-sm space-y-5"
      >
        <div className="text-center">
          <div className="text-[10px] tracking-[0.3em] text-slate-500 uppercase font-bold mb-1">
            Go-on Lab
          </div>
          <h1 className="text-xl font-bold text-white">Researcher Login</h1>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        {error && (
          <div className="text-rose-400 text-xs">{error}</div>
        )}
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold shadow-lg shadow-emerald-500/20 transition"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          Set the <code>ADMIN_PASSWORD</code> environment variable on the server
          to enable researcher access.
        </p>
      </form>
    </div>
  );
}
