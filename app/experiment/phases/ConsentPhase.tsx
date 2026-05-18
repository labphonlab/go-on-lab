"use client";

import React, { useState, useSyncExternalStore } from "react";
import { Card, PrimaryButton, FieldLabel } from "./Shell";
import type { ConsentRecord } from "../types";
import { useLocale } from "../contexts/LocaleProvider";
import { pickLocalized } from "@/app/lib/i18n";
import type { ExperimentDesign } from "@/app/lib/design";

const subscribeNoop = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export function ConsentPhase({
  design,
  onConsent,
  onDecline,
}: {
  design: ExperimentDesign;
  onConsent: (c: ConsentRecord) => void;
  onDecline: () => void;
}) {
  const { t, locale } = useLocale();
  const hydrated = useHydrated();
  const [agreed, setAgreed] = useState(false);
  const [adult, setAdult] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [headphones, setHeadphones] = useState(false);
  const [initials, setInitials] = useState("");

  const checks = [adult, hearing, headphones, agreed];
  const checkedCount = checks.filter(Boolean).length;
  const totalChecks = checks.length;
  const initialsOk = initials.trim().length >= 2;
  const canProceed = checkedCount === totalChecks && initialsOk;

  const customText = design.consentTextOverride
    ? pickLocalized(design.consentTextOverride, locale)
    : null;

  const items: { state: boolean; set: (b: boolean) => void; label: string }[] =
    [
      { state: adult, set: setAdult, label: t.consent.agreeAdult(design.minAge) },
      { state: hearing, set: setHearing, label: t.consent.agreeHearing },
      {
        state: headphones,
        set: setHeadphones,
        label: t.consent.agreeHeadphones,
      },
      { state: agreed, set: setAgreed, label: t.consent.agreeConsent },
    ];

  let hint: string;
  let hintColor: string;
  if (canProceed) {
    hint = t.consent.allReady;
    hintColor = "text-emerald-300";
  } else if (checkedCount < totalChecks) {
    hint = t.consent.needCheckMore(totalChecks - checkedCount);
    hintColor = "text-amber-300";
  } else {
    hint = t.consent.needInitials;
    hintColor = "text-amber-300";
  }

  const initialsNeedsAttention = checkedCount === totalChecks && !initialsOk;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold mb-3 text-emerald-400">
          {t.consent.heading}
        </h2>
        <div className="text-sm text-slate-300 leading-relaxed space-y-3">
          {customText ? (
            customText.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)
          ) : (
            <>
              <p>{t.consent.intro1}</p>
              <p>{t.consent.intro2}</p>
              <p>{t.consent.intro3}</p>
              <p>{t.consent.intro4}</p>
            </>
          )}
          <div className="text-xs text-slate-500 pt-2 space-y-1 font-mono">
            <div>
              {t.consent.versionLabel}: <code>{design.consentVersion}</code>
            </div>
            {design.institution && (
              <div>
                {t.consent.institutionLabel}: {design.institution}
              </div>
            )}
            {design.irbReference && (
              <div>
                {t.consent.irbLabel}: {design.irbReference}
              </div>
            )}
            {design.contactEmail && (
              <div>
                {t.consent.contactLabel}:{" "}
                <a
                  href={`mailto:${design.contactEmail}`}
                  className="text-emerald-400 hover:underline"
                >
                  {design.contactEmail}
                </a>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-white mb-1">
          {t.consent.agreementsHeading}
        </h3>
        <div className="text-[11px] font-mono text-slate-500 mb-4">
          {t.consent.progressChecks(checkedCount, totalChecks)} ·{" "}
          {t.consent.progressInitials(initialsOk)}
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <label
              key={i}
              className={`flex items-start gap-3 cursor-pointer text-sm rounded-xl p-3 border transition active:scale-[0.99] ${
                it.state
                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-100"
                  : "bg-slate-800/40 border-slate-700 text-slate-200 hover:border-slate-500"
              }`}
            >
              <input
                type="checkbox"
                checked={it.state}
                disabled={!hydrated}
                onChange={(e) => it.set(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-emerald-500 flex-shrink-0"
              />
              <span className="leading-relaxed">{it.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-6">
          <FieldLabel>
            <span className={initialsNeedsAttention ? "text-amber-300" : ""}>
              {t.consent.initialsLabel}
            </span>
          </FieldLabel>
          <input
            value={initials}
            onChange={(e) => setInitials(e.target.value.slice(0, 16))}
            disabled={!hydrated}
            maxLength={16}
            placeholder="T.S."
            autoComplete="off"
            className={`w-full sm:w-48 px-4 py-3 bg-slate-800 rounded-lg text-white focus:outline-none text-base border-2 transition ${
              initialsNeedsAttention
                ? "border-amber-400 ring-2 ring-amber-400/30 focus:border-amber-300"
                : initialsOk
                  ? "border-emerald-500/60 focus:border-emerald-500"
                  : "border-slate-700 focus:border-emerald-500"
            }`}
          />
          <p className="text-[11px] text-slate-500 mt-2">
            {t.consent.initialsHelp}
          </p>
        </div>
      </Card>

      <div className="space-y-3">
        <div
          className={`text-xs sm:text-sm text-center font-medium ${hintColor}`}
          aria-live="polite"
        >
          {hint}
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end items-stretch sm:items-center">
          <button
            onClick={onDecline}
            className="text-slate-400 hover:text-slate-200 text-sm underline py-2"
          >
            {t.consent.declineLink}
          </button>
          <PrimaryButton
            disabled={!canProceed}
            onClick={() =>
              onConsent({
                agreedAt: new Date().toISOString(),
                agreementVersion: design.consentVersion,
                participantInitials: initials.trim(),
              })
            }
          >
            {t.consent.agreeButton}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
