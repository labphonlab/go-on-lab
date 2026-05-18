"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LOCALES, MESSAGES, type Locale, type Messages } from "@/app/lib/i18n";

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  enabledLocales: Locale[];
  forceLocale: Locale | null;
  t: Messages;
}

const Ctx = createContext<LocaleCtx | null>(null);

export function LocaleProvider({
  initialLocale,
  enabledLocales,
  forceLocale,
  children,
}: {
  initialLocale: Locale;
  enabledLocales: Locale[];
  forceLocale: Locale | null;
  children: React.ReactNode;
}) {
  const safeInitial: Locale = enabledLocales.includes(initialLocale)
    ? initialLocale
    : enabledLocales[0] ?? "en";
  const [locale, setLocaleState] = useState<Locale>(
    forceLocale ?? safeInitial,
  );

  const setLocale = useCallback(
    (l: Locale) => {
      if (forceLocale) return;
      if (!LOCALES.includes(l)) return;
      if (!enabledLocales.includes(l)) return;
      setLocaleState(l);
    },
    [enabledLocales, forceLocale],
  );

  const value = useMemo<LocaleCtx>(
    () => ({
      locale,
      setLocale,
      enabledLocales,
      forceLocale,
      t: MESSAGES[locale],
    }),
    [enabledLocales, forceLocale, locale, setLocale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocale must be used inside LocaleProvider");
  return v;
}
