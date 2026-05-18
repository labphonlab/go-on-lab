"use client";

import React, { useEffect, useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "./Shell";
import type { ExperimentResult } from "../types";
import {
  downloadFile,
  resultToJson,
  trialsToCsv,
  headphoneTrialsToCsv,
} from "../lib/csv";

export function DebriefPhase({ result }: { result: ExperimentResult }) {
  const [submitting, setSubmitting] = useState<"idle" | "pending" | "ok" | "error">(
    "idle",
  );
  const [submitMessage, setSubmitMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function submit() {
      setSubmitting("pending");
      try {
        const resp = await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result),
        });
        if (cancelled) return;
        if (resp.ok) {
          const j = await resp.json().catch(() => ({}));
          setSubmitting("ok");
          setSubmitMessage(
            typeof j.filename === "string"
              ? `保存ファイル: ${j.filename}`
              : "サーバ保存完了",
          );
        } else {
          setSubmitting("error");
          const j = await resp.json().catch(() => ({}));
          setSubmitMessage(j.error || `HTTP ${resp.status}`);
        }
      } catch (e) {
        if (cancelled) return;
        setSubmitting("error");
        setSubmitMessage((e as Error).message);
      }
    }
    submit();
    return () => {
      cancelled = true;
    };
  }, [result]);

  const thresholdHz = result.finalThresholdHz;
  const thresholdCents = result.finalThresholdCents;

  return (
    <div className="space-y-6">
      <Card>
        <div className="text-center">
          <div className="text-emerald-400 text-5xl mb-3">✓</div>
          <h2 className="text-2xl font-bold mb-2 text-white">実験が完了しました</h2>
          <p className="text-slate-400 text-sm">
            ご協力ありがとうございました。
          </p>
        </div>
      </Card>

      {thresholdHz !== null && (
        <Card>
          <div className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase mb-2">
            Your Frequency Difference Limen (DLF)
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-5xl font-black text-white">
              {thresholdHz.toFixed(2)}
              <span className="text-xl font-normal text-slate-400 ml-2">Hz</span>
            </div>
            {thresholdCents !== null && (
              <div className="text-sm text-emerald-300 font-mono">
                ≈ {thresholdCents.toFixed(1)} cents
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            この値は、1000 Hz の純音について、あなたが
            70.7% の正答率で「より高い音」を判別できる
            最小の周波数差の推定値です（2-down/1-up 法による収束推定）。
            一般成人の典型値は 1〜5 Hz 程度です。
          </p>
        </Card>
      )}

      {result.staircases.length > 0 && (
        <Card>
          <h3 className="text-sm font-bold text-emerald-400 mb-3">
            階段法の収束
          </h3>
          <div className="space-y-3">
            {result.staircases.map((s) => (
              <div
                key={s.staircaseId}
                className="bg-slate-950/60 border border-slate-800 rounded-xl p-4"
              >
                <div className="flex justify-between items-center mb-2 text-xs text-slate-400 font-mono">
                  <span>Staircase #{s.staircaseId + 1}</span>
                  <span>{s.numTrials} trials · {s.reversals.length} reversals</span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-500">Threshold: </span>
                  <span className="text-white font-bold">
                    {s.threshold != null ? s.threshold.toFixed(2) : "—"} Hz
                  </span>
                  {s.thresholdCents != null && (
                    <span className="text-slate-500 ml-2 font-mono text-xs">
                      ({s.thresholdCents.toFixed(1)} cents)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-bold text-emerald-400 mb-3">データ</h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          参加者ID: <code className="text-slate-200 font-mono">{result.participantId}</code>
          <br />
          全データはCSV/JSON形式でダウンロードできます。
          研究目的での再現性確保のため、必要に応じてダウンロードを保管してください。
        </p>

        <div className="mb-4 text-xs">
          {submitting === "pending" && (
            <span className="text-slate-400">サーバへ送信中…</span>
          )}
          {submitting === "ok" && (
            <span className="text-emerald-400">✓ サーバ保存完了 · {submitMessage}</span>
          )}
          {submitting === "error" && (
            <span className="text-amber-400">
              ⚠ サーバ送信に失敗 ({submitMessage})。下のボタンからローカルへ保存してください。
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <SecondaryButton
            onClick={() =>
              downloadFile(
                `${result.participantId}_main-trials.csv`,
                trialsToCsv(result.participantId, result.mainTrials),
                "text/csv;charset=utf-8",
              )
            }
          >
            本試行 CSV
          </SecondaryButton>
          <SecondaryButton
            onClick={() =>
              downloadFile(
                `${result.participantId}_practice-trials.csv`,
                trialsToCsv(result.participantId, result.practiceTrials),
                "text/csv;charset=utf-8",
              )
            }
          >
            練習 CSV
          </SecondaryButton>
          {result.headphoneCheck && (
            <SecondaryButton
              onClick={() =>
                downloadFile(
                  `${result.participantId}_headphone-check.csv`,
                  headphoneTrialsToCsv(
                    result.participantId,
                    result.headphoneCheck!.trials,
                  ),
                  "text/csv;charset=utf-8",
                )
              }
            >
              音響チェック CSV
            </SecondaryButton>
          )}
          <PrimaryButton
            onClick={() =>
              downloadFile(
                `${result.participantId}_session.json`,
                resultToJson(result),
                "application/json",
              )
            }
          >
            全体 JSON
          </PrimaryButton>
        </div>
      </Card>

      <div className="text-center pt-4">
        <p className="text-xs text-slate-500">
          このタブを閉じて終了してください。
        </p>
      </div>
    </div>
  );
}
