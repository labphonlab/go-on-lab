"use client";

import React, { useState } from "react";
import { Card, PrimaryButton, FieldLabel } from "./Shell";
import type { ConsentRecord } from "../types";
import { useLocale } from "../contexts/LocaleProvider";
import { pickLocalized } from "@/app/lib/i18n";
import type { ExperimentDesign } from "@/app/lib/design";

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
  const [agreed, setAgreed] = useState(false);
  const [adult, setAdult] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [headphones, setHeadphones] = useState(false);
  const [initials, setInitials] = useState("");

  const canProceed =
    agreed && adult && hearing && headphones && initials.trim().length >= 2;

  const customText = design.consentTextOverride
    ? pickLocalized(design.consentTextOverride, locale)
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold mb-3 text-emerald-400">
          {t.consent.heading}
        </h2>
        <div className="text-sm text-slate-300 leading-relaxed space-y-3">
          {customText ? (
            customText
              .split(/\n\s*\n/)
              .map((para, i) => <p key={i}>{para}</p>)
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
        <h3 className="text-sm font-bold text-white mb-4">
          {t.consent.agreementsHeading}
        </h3>
        <div className="space-y-3">
          {[
            { state: adult, set: setAdult, label: t.consent.agreeAdult(design.minAge) },
            { state: hearing, set: setHearing, label: t.consent.agreeHearing },
            { state: headphones, set: setHeadphones, label: t.consent.agreeHeadphones },
            { state: agreed, set: setAgreed, label: t.consent.agreeConsent },
          ].map((it, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer text-sm text-slate-200">
              <input
                type="checkbox"
                checked={it.state}
                onChange={(e) => it.set(e.target.checked)}
                className="mt-1 w-4 h-4 accent-emerald-500"
              />
              <span>{it.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-6">
          <FieldLabel>{t.consent.initialsLabel}</FieldLabel>
          <input
            value={initials}
            onChange={(e) => setInitials(e.target.value.slice(0, 16))}
            maxLength={16}
            placeholder="T.S."
            className="w-full sm:w-48 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
          />
          <p className="text-[11px] text-slate-500 mt-2">
            {t.consent.initialsHelp}
          </p>
        </div>
      </Card>

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
  );
}
