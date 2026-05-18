"use client";

import React, { useState } from "react";
import { Card, FieldLabel, PrimaryButton } from "./Shell";
import type { Demographics, Gender, Handedness } from "../types";
import { EXPERIMENT_CONFIG, SCALE_OPTIONS } from "../config";

const GENDER_LABEL: Record<Gender, string> = {
  female: "女性",
  male: "男性",
  "non-binary": "ノンバイナリー",
  "prefer-not-to-say": "回答しない",
};

const HANDEDNESS_LABEL: Record<Handedness, string> = {
  right: "右利き",
  left: "左利き",
  ambidextrous: "両利き",
};

const HEARING_LABEL: Record<string, string> = {
  none: "問題なし",
  mild: "軽度",
  moderate: "中等度",
  severe: "重度",
  unsure: "わからない",
};

const HEADPHONE_LABEL: Record<string, string> = {
  "over-ear": "オーバーイヤー型",
  "on-ear": "オンイヤー型",
  "in-ear": "イヤホン (カナル型)",
  earbuds: "イヤホン (インナーイヤー型)",
  unknown: "わからない",
};

export function DemographicsPhase({
  onSubmit,
}: {
  onSubmit: (d: Demographics) => void;
}) {
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [handedness, setHandedness] = useState<Handedness | null>(null);
  const [nativeLanguage, setNativeLanguage] = useState<string>("日本語");
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
    ageNum !== null &&
    Number.isFinite(ageNum) &&
    ageNum >= EXPERIMENT_CONFIG.minAge &&
    ageNum <= EXPERIMENT_CONFIG.maxAge;

  const yrsValid =
    yrsNum !== null && Number.isFinite(yrsNum) && yrsNum >= 0 && yrsNum <= 80;

  const canSubmit =
    ageValid &&
    yrsValid &&
    gender !== null &&
    handedness !== null &&
    nativeLanguage.trim().length > 0 &&
    hearingImpairment !== null &&
    hearingAids !== null &&
    headphoneType !== null &&
    environmentQuiet !== null;

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      age: ageNum!,
      gender,
      handedness,
      nativeLanguage: nativeLanguage.trim(),
      otherLanguages: otherLanguages.trim(),
      hearingImpairment,
      hearingAids,
      musicalTrainingYears: yrsNum,
      headphoneType,
      environmentQuiet,
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <FieldLabel>年齢 ({EXPERIMENT_CONFIG.minAge}〜{EXPERIMENT_CONFIG.maxAge}歳)</FieldLabel>
            <input
              type="number"
              inputMode="numeric"
              min={EXPERIMENT_CONFIG.minAge}
              max={EXPERIMENT_CONFIG.maxAge}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
            {age !== "" && !ageValid && (
              <p className="text-rose-400 text-xs mt-1">
                {EXPERIMENT_CONFIG.minAge}〜{EXPERIMENT_CONFIG.maxAge}の範囲で入力してください。
              </p>
            )}
          </div>

          <div>
            <FieldLabel>性別</FieldLabel>
            <select
              value={gender ?? ""}
              onChange={(e) =>
                setGender(e.target.value ? (e.target.value as Gender) : null)
              }
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">選択してください</option>
              {SCALE_OPTIONS.gender.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABEL[g]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>利き手</FieldLabel>
            <select
              value={handedness ?? ""}
              onChange={(e) =>
                setHandedness(
                  e.target.value ? (e.target.value as Handedness) : null,
                )
              }
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">選択してください</option>
              {SCALE_OPTIONS.handedness.map((h) => (
                <option key={h} value={h}>
                  {HANDEDNESS_LABEL[h]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>母語</FieldLabel>
            <input
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value.slice(0, 40))}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>その他に流暢な言語 (任意, カンマ区切り)</FieldLabel>
            <input
              value={otherLanguages}
              onChange={(e) => setOtherLanguages(e.target.value.slice(0, 200))}
              placeholder="English, 中文 など"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <FieldLabel>音楽の訓練・実技年数 (年)</FieldLabel>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={80}
              value={musicalTrainingYears}
              onChange={(e) => setMusicalTrainingYears(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <FieldLabel>聴覚の自己評価</FieldLabel>
            <select
              value={hearingImpairment ?? ""}
              onChange={(e) =>
                setHearingImpairment(
                  (e.target.value || null) as Demographics["hearingImpairment"],
                )
              }
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">選択してください</option>
              {SCALE_OPTIONS.hearingImpairment.map((h) => (
                <option key={h} value={h}>
                  {HEARING_LABEL[h]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>補聴器の使用</FieldLabel>
            <div className="flex gap-3">
              {[
                { v: false, l: "いいえ" },
                { v: true, l: "はい" },
              ].map(({ v, l }) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setHearingAids(v)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
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

          <div>
            <FieldLabel>使用するヘッドホン/イヤホン</FieldLabel>
            <select
              value={headphoneType ?? ""}
              onChange={(e) =>
                setHeadphoneType(
                  (e.target.value || null) as Demographics["headphoneType"],
                )
              }
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">選択してください</option>
              {SCALE_OPTIONS.headphoneType.map((h) => (
                <option key={h} value={h}>
                  {HEADPHONE_LABEL[h]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>現在の環境は静かですか?</FieldLabel>
            <div className="flex gap-3">
              {[
                { v: true, l: "静か" },
                { v: false, l: "騒がしい" },
              ].map(({ v, l }) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setEnvironmentQuiet(v)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
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
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryButton disabled={!canSubmit} onClick={submit}>
          次へ →
        </PrimaryButton>
      </div>
    </div>
  );
}
