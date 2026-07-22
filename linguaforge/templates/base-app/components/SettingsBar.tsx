"use client";

import { useSettings } from "@/lib/settings";

export default function SettingsBar() {
  const { darkMode, showIPA, toggleDarkMode, toggleShowIPA } = useSettings();

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <button
        onClick={toggleShowIPA}
        className={`rounded-full px-3 py-1.5 border transition-colors ${
          showIPA
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
            : "border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400"
        }`}
        aria-pressed={showIPA}
      >
        IPA
      </button>
      <button
        onClick={toggleDarkMode}
        className="rounded-full px-3 py-1.5 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
        aria-pressed={darkMode}
        aria-label="ダークモード切替"
      >
        {darkMode ? "🌙" : "☀️"}
      </button>
    </div>
  );
}
