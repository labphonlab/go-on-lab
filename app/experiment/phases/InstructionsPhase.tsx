"use client";

import React from "react";
import { Card, PrimaryButton } from "./Shell";

export function InstructionsPhase({
  forBlock,
  onProceed,
}: {
  forBlock: "practice" | "main";
  onProceed: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold text-emerald-400 mb-3">
          {forBlock === "practice" ? "練習試行の説明" : "本試行の説明"}
        </h2>
        <div className="text-sm text-slate-300 leading-relaxed space-y-4">
          <p>
            これから各試行で<strong>2つの音</strong>が連続して再生されます。
            2つの音はほぼ同じ高さですが、<strong>片方だけがわずかに高い音</strong>です。
          </p>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 font-mono text-[12px] text-slate-400">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-emerald-400">音①</span>
              <span>→ 短い無音 →</span>
              <span className="text-emerald-400">音②</span>
              <span>→ 回答</span>
            </div>
            <div className="text-slate-500 text-[11px]">
              200 ms tone · 500 ms ISI · 200 ms tone · response
            </div>
          </div>
          <p>
            <strong>どちらの音がより高かったか</strong>を、
            画面のボタン (または<kbd className="px-1.5 py-0.5 mx-1 bg-slate-800 border border-slate-600 rounded text-[11px] font-mono">1</kbd>
            /<kbd className="px-1.5 py-0.5 mx-1 bg-slate-800 border border-slate-600 rounded text-[11px] font-mono">2</kbd>
            キー) で回答してください。
          </p>
          <p>
            正しいかどうか分からなくても、<strong>必ずどちらかを選んでください</strong>。
            違いが小さくて分からない場合も、感覚で選択して構いません。
            実験は <strong>あなたが反応した結果に応じて難易度が自動調整される</strong>
            ため、難しく感じても問題ありません。
          </p>
          {forBlock === "practice" && (
            <>
              <p className="text-emerald-300">
                まず<strong>8試行の練習</strong>を行います。練習では正誤フィードバックが表示されます。
              </p>
              <p>
                練習中に音を聞き逃した場合は、回答前に「もう一度聴く」
                (<kbd className="px-1.5 py-0.5 mx-1 bg-slate-800 border border-slate-600 rounded text-[11px] font-mono">R</kbd>キー)
                を押すと最大2回まで再生できます。
                押し間違いに気づいた場合は、回答直後に「↶ 前の回答を取り消す」
                (<kbd className="px-1.5 py-0.5 mx-1 bg-slate-800 border border-slate-600 rounded text-[11px] font-mono">U</kbd>キー)
                を押すと、その試行をやり直せます。
              </p>
            </>
          )}
          {forBlock === "main" && (
            <>
              <p className="text-amber-300">
                本試行ではフィードバックは表示されません。
                測定の妥当性を保つため、刺激の再生は<strong>1回のみ</strong>です。
              </p>
              <p>
                押し間違いの取り消し
                (<kbd className="px-1.5 py-0.5 mx-1 bg-slate-800 border border-slate-600 rounded text-[11px] font-mono">U</kbd>キー)
                は引き続き利用できます。30試行ごとに短い休憩が入ります。
                全体で約 10〜15 分です。
              </p>
            </>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <PrimaryButton onClick={onProceed}>
          {forBlock === "practice" ? "練習を始める →" : "本試行を始める →"}
        </PrimaryButton>
      </div>
    </div>
  );
}
