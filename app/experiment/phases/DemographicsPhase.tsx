"use client";

import React, { useState } from "react";
import { Card, FieldLabel, PrimaryButton } from "./Shell";
import type { Demographics, Gender, Handedness } from "../types";
import { SCALE_OPTIONS } from "../config";
import { useLocale } from "../contexts/LocaleProvider";
import type { ExperimentDesign } from "@/app/lib/design";

export function DemographicsPhase({
  design,
  onSubmit,
}: {
  design: ExperimentDesign;
  onSubmit: (d: Demographics) => void;
}) {
  const { t } = useLocale();
  const F = design.demographicsFields;

  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [handedness, setHandedness] = useState<Handedness | null>(null);
  const [nativeLanguage, setNativeLanguage] = useState<string>("");
  const [otherLanguages, setOtherLanguages] = useState<string>("");
  const [hearingImpairment, setHearingImpairment] =
    useState<Demographics["hearingImpairment"]>(null);
  const [hearingAids, setHearingAids] = useState<boolean | null>(null);
  const [musicalTrainingYears, setMusicalTrainingYears] = useState<string>("0");
  const [headphoneType, setHeadphoneType] =
    useState<Demographics["headphoneType"]>(null);
  const [environmentQuiet, setEnvironmentQuiet] = useState<boolean | null>(
    null,
  );

  const ageNum = age === "" ? null : Number(age);
  const yrsNum =
    musicalTrainingYears === "" ? null : Number(musicalTrainingYears);

  const ageValid =
    !F.age ||
    (ageNum !== null &&
      Number.isFinite(ageNum) &&
      ageNum >= design.minAge &&
      ageNum <= design.maxAge);
  const yrsValid =
    !F.musicalTrainingYears ||
    (yrsNum !== null && Number.isFinite(yrsNum) && yrsNum >= 0 && yrsNum <= 80);

  const canSubmit =
    ageValid &&
    yrsValid &&
    (!F.gender || gender !== null) &&
    (!F.handedness || handedness !== null) &&
    (!F.nativeLanguage || nativeLanguage.trim().length > 0) &&
    (!F.hearingImpairment || hearingImpairment !== null) &&
    (!F.hearingAids || hearingAids !== null) &&
    (!F.headphoneType || headphoneType !== null) &&
    (!F.environmentQuiet || environmentQuiet !== null);

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      age: F.age ? ageNum : null,
      gender: F.gender ? gender : null,
      handedness: F.handedness ? handedness : null,
      nativeLanguage: F.nativeLanguage ? nativeLanguage.trim() : "",
      otherLanguages: F.otherLanguages ? otherLanguages.trim() : "",
      hearingImpairment: F.hearingImpairment ? hearingImpairment : null,
      hearingAids: F.hearingAids ? hearingAids : null,
      musicalTrainingYears: F.musicalTrainingYears ? yrsNum : null,
      headphoneType: F.headphoneType ? headphoneType : null,
      environmentQuiet: F.environmentQuiet ? environmentQuiet : null,
    });
  }

  const select = t.demographics.select;
  const G = t.demographics.genderOpts;
  const H = t.demographics.handednessOpts;
  const HE = t.demographics.hearingOpts;
  const HP = t.demographics.headphoneOpts;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold text-emerald-400 mb-4">
          {t.demographics.heading}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {F.age && (
            <div>
              <FieldLabel>
                {t.demographics.age} ({t.demographics.ageRange(design.minAge, design.maxAge)})
              </FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={design.minAge}
                max={design.maxAge}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
              />
              {age !== "" && !ageValid && (
                <p className="text-rose-400 text-xs mt-1">
                  {t.demographics.ageInvalid(design.minAge, design.maxAge)}
                </p>
              )}
            </div>
          )}

          {F.gender && (
            <div>
              <FieldLabel>{t.demographics.gender}</FieldLabel>
              <select
                value={gender ?? ""}
                onChange={(e) =>
                  setGender(e.target.value ? (e.target.value as Gender) : null)
                }
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
              >
                <option value="">{select}</option>
                {SCALE_OPTIONS.gender.map((g) => (
                  <option key={g} value={g}>
                    {g === "female" ? G.female : g === "male" ? G.male : g === "non-binary" ? G.nonBinary : G.preferNotToSay}
                  </option>
                ))}
              </select>
            </div>
          )}

          {F.handedness && (
            <div>
              <FieldLabel>{t.demographics.handedness}</FieldLabel>
              <select
                value={handedness ?? ""}
                onChange={(e) =>
                  setHandedness(
                    e.target.value ? (e.target.value as Handedness) : null,
                  )
                }
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
              >
                <option value="">{select}</option>
                {SCALE_OPTIONS.handedness.map((h) => (
                  <option key={h} value={h}>
                    {h === "right" ? H.right : h === "left" ? H.left : H.ambidextrous}
                  </option>
                ))}
              </select>
            </div>
          )}

          {F.nativeLanguage && (
            <div>
              <FieldLabel>{t.demographics.nativeLanguage}</FieldLabel>
              <input
                value={nativeLanguage}
                onChange={(e) => setNativeLanguage(e.target.value.slice(0, 40))}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
              />
            </div>
          )}

          {F.otherLanguages && (
            <div className="sm:col-span-2">
              <FieldLabel>{t.demographics.otherLanguages}</FieldLabel>
              <input
                value={otherLanguages}
                onChange={(e) => setOtherLanguages(e.target.value.slice(0, 200))}
                placeholder={t.demographics.otherLanguagesPlaceholder}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
              />
            </div>
          )}

          {F.musicalTrainingYears && (
            <div>
              <FieldLabel>{t.demographics.musicalTrainingYears}</FieldLabel>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={80}
                value={musicalTrainingYears}
                onChange={(e) => setMusicalTrainingYears(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
              />
            </div>
          )}

          {F.hearingImpairment && (
            <div>
              <FieldLabel>{t.demographics.hearing}</FieldLabel>
              <select
                value={hearingImpairment ?? ""}
                onChange={(e) =>
                  setHearingImpairment(
                    (e.target.value || null) as Demographics["hearingImpairment"],
                  )
                }
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
              >
                <option value="">{select}</option>
                {SCALE_OPTIONS.hearingImpairment.map((h) => (
                  <option key={h} value={h}>
                    {h === "none" ? HE.none : h === "mild" ? HE.mild : h === "moderate" ? HE.moderate : h === "severe" ? HE.severe : HE.unsure}
                  </option>
                ))}
              </select>
            </div>
          )}

          {F.hearingAids && (
            <div>
              <FieldLabel>{t.demographics.hearingAids}</FieldLabel>
              <div className="flex gap-3">
                {[
                  { v: false, l: t.common.no },
                  { v: true, l: t.common.yes },
                ].map(({ v, l }) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setHearingAids(v)}
                    className={`flex-1 py-3 rounded-lg border text-sm font-medium transition ${
                      hearingAids === v
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {F.headphoneType && (
            <div>
              <FieldLabel>{t.demographics.headphoneType}</FieldLabel>
              <select
                value={headphoneType ?? ""}
                onChange={(e) =>
                  setHeadphoneType(
                    (e.target.value || null) as Demographics["headphoneType"],
                  )
                }
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-base"
              >
                <option value="">{select}</option>
                {SCALE_OPTIONS.headphoneType.map((h) => (
                  <option key={h} value={h}>
                    {h === "over-ear" ? HP.overEar : h === "on-ear" ? HP.onEar : h === "in-ear" ? HP.inEar : h === "earbuds" ? HP.earbuds : HP.unknown}
                  </option>
                ))}
              </select>
            </div>
          )}

          {F.environmentQuiet && (
            <div>
              <FieldLabel>{t.demographics.environment}</FieldLabel>
              <div className="flex gap-3">
                {[
                  { v: true, l: t.demographics.quiet },
                  { v: false, l: t.demographics.noisy },
                ].map(({ v, l }) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setEnvironmentQuiet(v)}
                    className={`flex-1 py-3 rounded-lg border text-sm font-medium transition ${
                      environmentQuiet === v
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryButton disabled={!canSubmit} onClick={submit}>
          {t.common.next}
        </PrimaryButton>
      </div>
    </div>
  );
}
