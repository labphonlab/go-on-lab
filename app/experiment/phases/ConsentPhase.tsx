"use client";

import React, { useState } from "react";
import { Card, PrimaryButton, FieldLabel } from "./Shell";
import type { ConsentRecord } from "../types";
import { EXPERIMENT_CONFIG } from "../config";

export function ConsentPhase({
  onConsent,
  onDecline,
}: {
  onConsent: (c: ConsentRecord) => void;
  onDecline: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [adult, setAdult] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [headphones, setHeadphones] = useState(false);
  const [initials, setInitials] = useState("");

  const canProceed =
    agreed && adult && hearing && headphones && initials.trim().length >= 2;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold mb-3 text-emerald-400">
          研究参加へのご協力のお願い
        </h2>
        <div className="prose prose-invert text-sm text-slate-300 leading-relaxed space-y-3 max-w-none">
          <p>
            本実験は<strong>Go-on Lab</strong>が実施する音声知覚に関する基礎研究の一環です。
            参加者は1000 Hz付近の純音を聴き、2区間のうち
            「より高い音」がどちらに含まれていたかを判断します。
            測定にかかる時間は<strong>およそ15〜20分</strong>です。
          </p>
          <p>
            <strong>収集するデータ:</strong>
            年齢・性別・利き手・母語・音楽訓練歴・聴覚状態などの基本情報、
            および各試行の刺激パラメータと反応・反応時間。
            個人を特定する情報（氏名・連絡先等）は収集しません。
            データは匿名化IDの下で保存され、学術目的にのみ使用されます。
          </p>
          <p>
            <strong>リスクと利益:</strong>
            短時間の音刺激のみを使用するため、
            身体的・心理的リスクは日常生活で経験する程度を超えません。
            参加への直接的な金銭的報酬はありません。
          </p>
          <p>
            <strong>任意性:</strong>
            参加は完全に任意です。理由を述べることなく、
            いつでもブラウザのタブを閉じることで中断できます。
            中断時点までに収集されたデータは破棄されます。
          </p>
          <p className="text-xs text-slate-500">
            同意書バージョン: <code>{EXPERIMENT_CONFIG.consentVersion}</code>
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-white mb-4">
          参加にあたり、以下のすべてに同意します
        </h3>
        <div className="space-y-3">
          {[
            { state: adult, set: setAdult, label: `私は${EXPERIMENT_CONFIG.minAge}歳以上であり、自らの意思で参加します。` },
            { state: hearing, set: setHearing, label: "私の聴覚は実験を実施するうえで支障がないと自己判断しています（耳鳴り・難聴の急性症状はありません）。" },
            { state: headphones, set: setHeadphones, label: "ヘッドホンまたはイヤホンを装着し、静かな環境で実験を行います。" },
            { state: agreed, set: setAgreed, label: "上記の説明を読み、研究目的でのデータ利用に同意します。" },
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
          <FieldLabel>イニシャル (例: T.S.)</FieldLabel>
          <input
            value={initials}
            onChange={(e) => setInitials(e.target.value.slice(0, 16))}
            maxLength={16}
            placeholder="T.S."
            className="w-full sm:w-48 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
          />
          <p className="text-[11px] text-slate-500 mt-2">
            個人特定には使用されません。同意記録の一部として保存されます。
          </p>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <button
          onClick={onDecline}
          className="text-slate-400 hover:text-slate-200 text-sm underline"
        >
          参加しない
        </button>
        <PrimaryButton
          disabled={!canProceed}
          onClick={() =>
            onConsent({
              agreedAt: new Date().toISOString(),
              agreementVersion: EXPERIMENT_CONFIG.consentVersion,
              participantInitials: initials.trim(),
            })
          }
        >
          同意して参加する →
        </PrimaryButton>
      </div>
    </div>
  );
}
