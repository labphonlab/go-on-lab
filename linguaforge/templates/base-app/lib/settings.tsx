"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { loadJSON, saveJSON } from "./storage";

interface Settings {
  darkMode: boolean;
  showIPA: boolean;
}

interface SettingsContextValue extends Settings {
  toggleDarkMode: () => void;
  toggleShowIPA: () => void;
}

const DEFAULTS: Settings = { darkMode: false, showIPA: true };

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    setSettings(loadJSON("settings", DEFAULTS));
  }, []);

  useEffect(() => {
    saveJSON("settings", settings);
    document.documentElement.classList.toggle("dark", settings.darkMode);
  }, [settings]);

  const value: SettingsContextValue = {
    ...settings,
    toggleDarkMode: () => setSettings((s) => ({ ...s, darkMode: !s.darkMode })),
    toggleShowIPA: () => setSettings((s) => ({ ...s, showIPA: !s.showIPA })),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
