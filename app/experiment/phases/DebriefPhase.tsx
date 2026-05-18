"use client";

import React, { useEffect, useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "./Shell";
import type { ExperimentResult } from "../types";
import {
  downloadFile,
  resultToJson,
  trialsToCsv,
  trialsToTsv,
  headphoneTrialsToCsv,
} from "../lib/csv";
import {
  makeIdempotencyKey,
  submitResultWithRetry,
  type SubmitState,
} from "../lib/submit";
import { useLocale } from "../contexts/LocaleProvider";

export function DebriefPhase({
  result,
  experimentId,
}: {
  result: ExperimentResult;
  experimentId: string;
}) {
  const { t } = useLocale();
  const [state, setState] = useState<SubmitState>({
    status: "pending",
    attempt: 0,
    message: "",
  });

  useEffect(() => {
    const ac = new AbortController();
    submitResultWithRetry(
      { ...result, experimentId },
      {
        idempotencyKey: makeIdempotencyKey(result.participantId, result.startedAt),
        onState: setState,
        signal: ac.signal,
        maxAttempts: 5,
      },
    );
    return () => ac.abort();
  }, [result, experimentId]);

  const thresholdHz = result.finalThresholdHz;
  const thresholdCents = result.finalThresholdCents;

  return (
    <div className="space-y-6">
      <Card>
        <div className="text-center">
          <div className="text-emerald-400 text-5xl mb-3">✓</div>
          <h2 className="text-2xl font-bold mb-2 text-white">
            {t.debrief.heading}
          </h2>
          <p className="text-slate-400 text-sm">{t.debrief.thanks}</p>
        </div>
      </Card>

      {thresholdHz !== null && (
        <Card>
          <div className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase mb-2">
            {t.debrief.dlfLabel}
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <div className="text-4xl sm:text-5xl font-black text-white">
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
            {t.debrief.dlfHelp}
          </p>
        </Card>
      )}

      {result.taskType === "identification" &&
        result.identificationMainTrials.length > 0 && (
          <IdentificationSummary result={result} />
        )}

      {result.taskType !== "identification" && result.staircases.length > 0 && (
        <Card>
          <h3 className="text-sm font-bold text-emerald-400 mb-3">
            {t.debrief.staircaseHeading}
          </h3>
          <div className="space-y-3">
            {result.staircases.map((s) => (
              <div
                key={s.staircaseId}
                className="bg-slate-950/60 border border-slate-800 rounded-xl p-4"
              >
                <div className="flex justify-between items-center mb-2 text-xs text-slate-400 font-mono">
                  <span>Staircase #{s.staircaseId + 1}</span>
                  <span>
                    {t.debrief.trialsLabel(s.numTrials, s.reversals.length)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-500">{t.debrief.threshold}: </span>
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
        <h3 className="text-sm font-bold text-emerald-400 mb-3">
          {t.debrief.dataHeading}
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          {t.debrief.participantIdLabel}:{" "}
          <code className="text-slate-200 font-mono break-all">
            {result.participantId}
          </code>
          <br />
          {t.debrief.dataIntro}
        </p>

        <div className="mb-4 text-xs">
          {state.status === "pending" && (
            <span className="text-slate-400">
              {t.debrief.uploading}
              {state.attempt > 1 && (
                <span className="ml-2 text-slate-500 font-mono">
                  ({state.message})
                </span>
              )}
            </span>
          )}
          {state.status === "ok" && (
            <div className="text-emerald-400">
              <div>{t.debrief.uploaded}</div>
              {state.sha256 && (
                <div className="text-[10px] text-slate-500 font-mono break-all mt-1">
                  SHA-256: {state.sha256}
                </div>
              )}
              {state.filename && (
                <div className="text-[10px] text-slate-500 font-mono break-all">
                  {state.filename}
                  {state.duplicated && " (duplicate ignored)"}
                </div>
              )}
            </div>
          )}
          {state.status === "queued" && (
            <span className="text-amber-400">
              {t.debrief.uploadError}
              {state.message && (
                <span className="ml-2 text-slate-500 font-mono break-all">
                  ({state.message})
                </span>
              )}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SecondaryButton
            onClick={() =>
              downloadFile(
                `${result.participantId}_main-trials.csv`,
                trialsToCsv(result.participantId, result.mainTrials),
                "text/csv;charset=utf-8",
              )
            }
          >
            {t.debrief.dlMainCsv}
          </SecondaryButton>
          <SecondaryButton
            onClick={() =>
              downloadFile(
                `${result.participantId}_main-trials.tsv`,
                trialsToTsv(result.participantId, result.mainTrials),
                "text/tab-separated-values;charset=utf-8",
              )
            }
          >
            {t.debrief.dlMainTsv}
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
            {t.debrief.dlPracticeCsv}
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
              {t.debrief.dlHeadphoneCsv}
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
            {t.debrief.dlAllJson}
          </PrimaryButton>
        </div>
      </Card>

      <div className="text-center pt-4">
        <p className="text-xs text-slate-500">{t.debrief.closeTab}</p>
      </div>
    </div>
  );
}

function IdentificationSummary({ result }: { result: ExperimentResult }) {
  const trials = result.identificationMainTrials;
  // group by stimulusId, compute P(each category)
  const byStim = new Map<
    string,
    { value: number | null; label: string; total: number; counts: Map<string, number> }
  >();
  for (const t of trials) {
    if (t.undone) continue;
    let g = byStim.get(t.stimulusId);
    if (!g) {
      g = {
        value: t.stimulusValue,
        label: t.stimulusLabel,
        total: 0,
        counts: new Map<string, number>(),
      };
      byStim.set(t.stimulusId, g);
    }
    if (t.response) {
      g.total += 1;
      g.counts.set(t.response, (g.counts.get(t.response) ?? 0) + 1);
    }
  }
  const rows = Array.from(byStim.entries()).sort((a, b) => {
    const av = a[1].value;
    const bv = b[1].value;
    if (av != null && bv != null) return av - bv;
    return a[0].localeCompare(b[0]);
  });
  const categoryIds = Array.from(
    new Set(trials.map((t) => t.response).filter((x): x is string => !!x)),
  ).sort();

  return (
    <Card>
      <div className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase mb-3">
        Identification Summary
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1 pr-3 font-medium">Stimulus</th>
              <th className="py-1 pr-3 font-medium text-right">n</th>
              {categoryIds.map((c) => (
                <th key={c} className="py-1 pr-3 font-medium text-right">
                  P({c})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, g]) => (
              <tr
                key={id}
                className="border-t border-slate-800 text-slate-200 font-mono"
              >
                <td className="py-1.5 pr-3">{g.label}</td>
                <td className="py-1.5 pr-3 text-right">{g.total}</td>
                {categoryIds.map((c) => {
                  const p = g.total > 0 ? (g.counts.get(c) ?? 0) / g.total : 0;
                  return (
                    <td key={c} className="py-1.5 pr-3 text-right">
                      {(p * 100).toFixed(0)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        ※ 各刺激音についての応答比率。詳細データはCSVをダウンロードしてください。
      </p>
    </Card>
  );
}
