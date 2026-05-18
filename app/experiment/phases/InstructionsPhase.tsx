"use client";

import React from "react";
import { Card, PrimaryButton } from "./Shell";
import { useLocale } from "../contexts/LocaleProvider";
import { pickLocalized } from "@/app/lib/i18n";
import type { ExperimentDesign } from "@/app/lib/design";

export function InstructionsPhase({
  forBlock,
  design,
  onProceed,
}: {
  forBlock: "practice" | "main";
  design: ExperimentDesign;
  onProceed: () => void;
}) {
  const { t, locale } = useLocale();
  const showReplayHelp =
    design.taskType === "identification"
      ? (forBlock === "practice" &&
          design.identification.maxReplaysPractice > 0) ||
        (forBlock === "main" && design.identification.maxReplaysMain > 0)
      : (forBlock === "practice" && design.maxReplaysPractice > 0) ||
        (forBlock === "main" && design.maxReplaysMain > 0);

  if (design.taskType === "identification") {
    const cats = design.identification.categories
      .map((c) => pickLocalized(c.label, locale))
      .join(" / ");
    return (
      <div className="space-y-6">
        <Card>
          <h2 className="text-lg font-bold text-emerald-400 mb-3">
            {forBlock === "practice"
              ? t.instructions.headingPractice
              : t.instructions.headingMain}
          </h2>
          <div className="text-sm text-slate-300 leading-relaxed space-y-4">
            <p>
              {forBlock === "practice"
                ? t.identification.practiceIntro
                : t.identification.mainIntro}
            </p>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 font-mono text-[12px] text-slate-400">
              <div className="mb-1">{cats}</div>
            </div>
            {design.breakAfterEvery > 0 &&
              design.identification.breakAfterEvery > 0 &&
              forBlock === "main" && <p>{t.instructions.breakInfo}</p>}
            {showReplayHelp && <p>{t.instructions.replayHelp}</p>}
            {design.allowUndo && <p>{t.instructions.undoHelp}</p>}
          </div>
        </Card>
        <div className="flex justify-end">
          <PrimaryButton onClick={onProceed}>
            {forBlock === "practice"
              ? t.identification.startPractice
              : t.identification.startMain}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold text-emerald-400 mb-3">
          {forBlock === "practice"
            ? t.instructions.headingPractice
            : t.instructions.headingMain}
        </h2>
        <div className="text-sm text-slate-300 leading-relaxed space-y-4">
          <p>{t.instructions.intro}</p>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 font-mono text-[12px] text-slate-400">
            <div className="mb-1">{t.instructions.flowDiagram}</div>
            <div className="text-slate-500 text-[11px]">
              {t.instructions.flowDetail}
            </div>
          </div>
          <p>{t.instructions.respondLabel}</p>
          <p>{t.instructions.forcedChoice}</p>
          {forBlock === "practice" && (
            <p className="text-emerald-300">{t.instructions.practiceFeedback}</p>
          )}
          {forBlock === "main" && (
            <p className="text-amber-300">{t.instructions.mainNoFeedback}</p>
          )}
          {design.breakAfterEvery > 0 && forBlock === "main" && (
            <p>{t.instructions.breakInfo}</p>
          )}
          {showReplayHelp && <p>{t.instructions.replayHelp}</p>}
          {design.allowUndo && <p>{t.instructions.undoHelp}</p>}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryButton onClick={onProceed}>
          {forBlock === "practice"
            ? t.instructions.startPractice
            : t.instructions.startMain}
        </PrimaryButton>
      </div>
    </div>
  );
}
