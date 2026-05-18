"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "./Shell";
import { AudioEngine } from "../lib/audio";
import type { AudioInfo } from "../types";
import { useLocale } from "../contexts/LocaleProvider";
import type { ExperimentDesign } from "@/app/lib/design";

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIPad =
    /iPad/.test(ua) ||
    (navigator.platform === "MacIntel" &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! >
        1);
  return /iPhone|iPod/.test(ua) || isIPad;
}

export function AudioSetupPhase({
  design,
  onReady,
}: {
  design: ExperimentDesign;
  onReady: (engine: AudioEngine, info: AudioInfo) => void;
}) {
  const { t } = useLocale();
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [playCount, setPlayCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [volumeOk, setVolumeOk] = useState<boolean | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [isIOS] = useState<boolean>(() => detectIOS());
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
      setError(t.audio.errorInit);
      console.error(e);
    }
  }

  async function playTest() {
    if (!engine) return;
    // Re-resume in case the AudioContext was suspended by iOS in the
    // background between mounts.
    try {
      await engine.resume();
    } catch {
      /* ignore */
    }
    const tStart = engine.currentTime + 0.05;
    engine.scheduleTone(
      {
        frequencyHz: design.referenceFrequencyHz,
        durationSec: 0.6,
        rampSec: 0.02,
        level: design.outputLevel,
      },
      tStart,
    );
    setPlayCount((c) => c + 1);
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
      {isIOS && (
        <Card>
          <div className="flex gap-3 items-start">
            <div className="text-2xl shrink-0" aria-hidden>
              📱
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-300 mb-1">
                {t.audio.iosTitle}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t.audio.iosWarning}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-bold text-emerald-400 mb-3">
          {t.audio.heading}
        </h2>
        <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2 leading-relaxed">
          <li>{t.audio.step1}</li>
          <li>{t.audio.step2}</li>
          <li>{t.audio.step3}</li>
          <li>{t.audio.step4}</li>
        </ol>

        <div className="mt-6 flex flex-col gap-3">
          {!engine ? (
            <PrimaryButton onClick={activate}>{t.audio.startButton}</PrimaryButton>
          ) : (
            <>
              <SecondaryButton onClick={playTest}>
                {playCount === 0
                  ? t.audio.testButton
                  : `🔁 ${t.audio.testButton} (${playCount})`}
              </SecondaryButton>
              {playCount > 0 && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setVolumeOk(true);
                      setShowTroubleshoot(false);
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium ${
                      volumeOk === true
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-200"
                    }`}
                  >
                    {t.audio.justRight}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVolumeOk(false);
                      setShowTroubleshoot(true);
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium ${
                      volumeOk === false
                        ? "bg-rose-600 border-rose-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-200"
                    }`}
                  >
                    {t.audio.adjusting}
                  </button>
                </div>
              )}
              {playCount > 0 && !showTroubleshoot && (
                <button
                  type="button"
                  onClick={() => setShowTroubleshoot(true)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline self-start"
                >
                  {t.audio.cannotHearLink}
                </button>
              )}
            </>
          )}
        </div>

        {showTroubleshoot && (
          <div className="mt-5 bg-slate-950/60 border border-amber-700/40 rounded-xl p-4 text-xs text-slate-300 leading-relaxed">
            <div className="font-bold text-amber-300 mb-2">
              {t.audio.troubleshootHeading}
            </div>
            <ol className="list-decimal list-inside space-y-1.5">
              {isIOS && <li>{t.audio.troubleshootSilentSwitch}</li>}
              <li>{t.audio.troubleshootVolume}</li>
              <li>{t.audio.troubleshootHeadphones}</li>
              <li>{t.audio.troubleshootReplay}</li>
            </ol>
          </div>
        )}

        {error && <p className="mt-4 text-rose-400 text-sm">{error}</p>}

        {engine && (
          <div className="mt-6 text-[11px] text-slate-500 font-mono break-all">
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
          disabled={!engine || playCount === 0 || volumeOk !== true}
          onClick={proceed}
        >
          {t.common.next}
        </PrimaryButton>
      </div>
    </div>
  );
}
