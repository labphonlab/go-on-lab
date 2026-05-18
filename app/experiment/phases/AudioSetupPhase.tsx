"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "./Shell";
import { AudioEngine } from "../lib/audio";
import { EXPERIMENT_CONFIG } from "../config";
import type { AudioInfo } from "../types";

export function AudioSetupPhase({
  onReady,
}: {
  onReady: (engine: AudioEngine, info: AudioInfo) => void;
}) {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [tested, setTested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeOk, setVolumeOk] = useState<boolean | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    return () => {
      engineRef.current?.close();
    };
  }, []);

  async function activate() {
    setError(null);
    try {
      const eng = engineRef.current ?? new AudioEngine();
      engineRef.current = eng;
      await eng.resume();
      setEngine(eng);
    } catch (e) {
      setError(
        "音声システムを初期化できませんでした。ブラウザの音声権限を許可するか、別のブラウザをお試しください。",
      );
      console.error(e);
    }
  }

  async function playTest() {
    if (!engine) return;
    const t = engine.currentTime + 0.05;
    engine.scheduleTone(
      {
        frequencyHz: EXPERIMENT_CONFIG.referenceFrequencyHz,
        durationSec: 0.6,
        rampSec: 0.02,
        level: EXPERIMENT_CONFIG.outputLevel,
      },
      t,
    );
    setTested(true);
  }

  function proceed() {
    if (!engine) return;
    const info: AudioInfo = {
      sampleRate: engine.sampleRate,
      baseLatencySec: engine.baseLatency,
      outputLatencySec: engine.outputLatency,
      state: engine.ctx.state,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      screenWidth: typeof window !== "undefined" ? window.screen.width : 0,
      screenHeight: typeof window !== "undefined" ? window.screen.height : 0,
      devicePixelRatio:
        typeof window !== "undefined" ? window.devicePixelRatio : 1,
    };
    onReady(engine, info);
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold text-emerald-400 mb-3">音量の調整</h2>
        <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2 leading-relaxed">
          <li>ヘッドホンまたはイヤホンを装着してください。</li>
          <li>下の「音声を開始」ボタンを押し、ブラウザの音声を有効化します。</li>
          <li>
            「テスト音を再生」を押し、<strong>はっきり聞こえるが大きすぎない</strong>音量にデバイス側で調整してください。
          </li>
          <li>本実験ではこの基準音より<strong>大きな音は出ません</strong>。</li>
        </ol>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {!engine ? (
            <PrimaryButton onClick={activate}>音声を開始</PrimaryButton>
          ) : (
            <>
              <SecondaryButton onClick={playTest}>テスト音を再生</SecondaryButton>
              {tested && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setVolumeOk(true)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                      volumeOk === true
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-200"
                    }`}
                  >
                    ちょうど良い
                  </button>
                  <button
                    type="button"
                    onClick={() => setVolumeOk(false)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                      volumeOk === false
                        ? "bg-rose-600 border-rose-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-200"
                    }`}
                  >
                    調整中
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 text-rose-400 text-sm">{error}</p>
        )}

        {engine && (
          <div className="mt-6 text-[11px] text-slate-500 font-mono">
            sampleRate: {engine.sampleRate} Hz · baseLatency:{" "}
            {engine.baseLatency != null
              ? `${(engine.baseLatency * 1000).toFixed(1)} ms`
              : "n/a"}{" "}
            · outputLatency:{" "}
            {engine.outputLatency != null
              ? `${(engine.outputLatency * 1000).toFixed(1)} ms`
              : "n/a"}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <PrimaryButton
          disabled={!engine || !tested || volumeOk !== true}
          onClick={proceed}
        >
          次へ →
        </PrimaryButton>
      </div>
    </div>
  );
}
