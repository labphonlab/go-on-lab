"use client";

import { useSettings } from "@/lib/settings";

export default function SettingsBar() {
  const { darkMode, showIPA, toggleDarkMode, toggleShowIPA } = useSettings();

  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={toggleShowIPA}
        className="rounded px-2 py-1 border border-slate-300 dark:border-slate-600"
        aria-pressed={showIPA}
      >
        IPA {showIPA ? "ON" : "OFF"}
      </button>
      <button
        onClick={toggleDarkMode}
        className="rounded px-2 py-1 border border-slate-300 dark:border-slate-600"
        aria-pressed={darkMode}
      >
        {darkMode ? "🌙" : "☀️"}
      </button>
    </div>
  );
}
