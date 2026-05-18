"use client";

import React from "react";

interface ShellProps {
  title?: string;
  subtitle?: string;
  progress?: number;
  children: React.ReactNode;
}

export function Shell({ title, subtitle, progress, children }: ShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="font-black text-white text-sm tracking-tighter">Go</span>
          </div>
          <div className="flex-1">
            <div className="text-[10px] tracking-[0.3em] text-slate-500 uppercase font-bold">
              Audio Perception Experiment
            </div>
            <div className="text-sm text-slate-200 font-medium">
              Go-on Lab&nbsp;·&nbsp;Frequency Discrimination Task
            </div>
          </div>
        </div>
        {typeof progress === "number" && (
          <div className="h-1 w-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-10">
          {title && (
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {subtitle}
            </p>
          )}
          <div>{children}</div>
        </div>
      </main>

      <footer className="border-t border-slate-800/60 py-6">
        <div className="max-w-3xl mx-auto px-6 text-[10px] uppercase tracking-[0.3em] text-slate-600 font-bold">
          © 2026 Go-on Lab · Phonetic &amp; Predictive Analytics
        </div>
      </footer>
    </div>
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { className = "", children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { className = "", children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-all active:scale-[0.98] border border-slate-700 ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
      {children}
    </label>
  );
}
