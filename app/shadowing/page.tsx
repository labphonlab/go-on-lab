"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LEVEL_LABEL, Level, sentencesByLevel } from "@/app/lib/sentences";
import { isSpeechAvailable, speak, stopSpeaking, warmUpVoices } from "@/app/lib/speech";

const RATES = [0.7, 0.85, 1.0, 1.15];

const subscribeNoop = () => () => {};

export default function ShadowingPage() {
  const [level, setLevel] = useState<Level>("beginner");
  const [idx, setIdx] = useState(0);
  const [rate, setRate] = useState(1.0);
  const [loop, setLoop] = useState(false);
  const [showJa, setShowJa] = useState(false);
  const [showEn, setShowEn] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const available = useSyncExternalStore(
    subscribeNoop,
    () => isSpeechAvailable(),
    () => true
  );

  const list = useMemo(() => sentencesByLevel(level), [level]);
  const current = list[idx];

  const loopRef = useRef(loop);
  const rateRef = useRef(rate);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    warmUpVoices();
    return () => stopSpeaking();
  }, []);

  const playOnce = (text: string) => {
    setIsPlaying(true);
    speak(text, {
      rate: rateRef.current,
      onEnd: () => {
        if (loopRef.current) {
          window.setTimeout(() => {
            speak(text, { rate: rateRef.current, onEnd: () => setIsPlaying(false) });
          }, 500);
        } else {
          setIsPlaying(false);
        }
      },
    });
  };

  const handleLevelChange = (l: Level) => {
    if (l === level) return;
    stopSpeaking();
    setIsPlaying(false);
    setIdx(0);
    setLevel(l);
  };

  const handlePlay = () => {
    if (!current) return;
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }
    playOnce(current.en);
  };

  const goPrev = () => {
    stopSpeaking();
    setIsPlaying(false);
    setIdx((i) => (i - 1 + list.length) % list.length);
  };

  const goNext = () => {
    stopSpeaking();
    setIsPlaying(false);
    setIdx((i) => (i + 1) % list.length);
  };

  if (!current) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center px-5 py-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[45%] bg-emerald-500/15 rounded-full blur-[120px]" />
      </div>

      <header className="w-full max-w-md flex items-center justify-between mb-4">
        <Link href="/" className="text-slate-400 hover:text-emerald-400 text-sm transition-colors flex items-center gap-1">
          <span>←</span>
          <span className="uppercase tracking-widest text-[10px] font-bold">Home</span>
        </Link>
        <div>
          <p className="text-[9px] tracking-[0.3em] uppercase text-slate-500 font-bold text-right">Mode</p>
          <p className="text-sm font-black text-emerald-400">Shadowing</p>
        </div>
      </header>

      <main className="w-full max-w-md flex-1 flex flex-col gap-4">
        {/* Level Picker */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-2 flex gap-1">
          {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
            <button
              key={l}
              onClick={() => handleLevelChange(l)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                level === l
                  ? "bg-emerald-500 text-white shadow shadow-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between text-[10px] tracking-[0.25em] uppercase font-bold text-slate-500">
          <span>
            {String(idx + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
          </span>
          <span>{LEVEL_LABEL[level]}</span>
        </div>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden -mt-2">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${((idx + 1) / list.length) * 100}%` }}
          />
        </div>

        {/* Sentence Card */}
        <section className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6 min-h-[12rem] flex flex-col gap-5">
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase font-bold text-emerald-500 mb-2">English</p>
            {showEn ? (
              <p className="text-lg font-semibold text-white leading-relaxed">{current.en}</p>
            ) : (
              <p className="text-lg font-semibold text-slate-700 leading-relaxed select-none">
                {current.en.replace(/[A-Za-z]/g, "•")}
              </p>
            )}
          </div>
          <div className="border-t border-slate-700/60 pt-4">
            <p className="text-[9px] tracking-[0.3em] uppercase font-bold text-slate-500 mb-2">日本語</p>
            {showJa ? (
              <p className="text-sm text-slate-300 leading-relaxed">{current.ja}</p>
            ) : (
              <button
                onClick={() => setShowJa(true)}
                className="text-xs text-slate-500 hover:text-emerald-400 underline underline-offset-4 transition-colors"
              >
                タップして日本語訳を表示
              </button>
            )}
          </div>
        </section>

        {/* Play Controls */}
        <section className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={goPrev}
              className="w-12 h-12 rounded-full bg-slate-700/50 hover:bg-slate-700 active:scale-95 transition flex items-center justify-center text-slate-300"
              aria-label="Previous"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>
            <button
              onClick={handlePlay}
              disabled={!available}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                isPlaying
                  ? "bg-gradient-to-br from-rose-500 to-amber-500"
                  : "bg-gradient-to-br from-emerald-500 to-teal-400"
              }`}
              aria-label={isPlaying ? "Stop" : "Play"}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 ml-1">
                  <path d="M7 5v14l12-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={goNext}
              className="w-12 h-12 rounded-full bg-slate-700/50 hover:bg-slate-700 active:scale-95 transition flex items-center justify-center text-slate-300"
              aria-label="Next"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
              </svg>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] tracking-[0.25em] uppercase font-bold text-slate-500">Speed</span>
              <span className="text-xs font-bold text-emerald-400">{rate.toFixed(2)}x</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(r)}
                  className={`py-2 rounded-xl text-[11px] font-bold transition ${
                    rate === r
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-700/40 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {r.toFixed(2)}x
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ToggleChip label="Loop" active={loop} onClick={() => setLoop((v) => !v)} />
            <ToggleChip label="Hide EN" active={!showEn} onClick={() => setShowEn((v) => !v)} />
          </div>
        </section>

        {!available && (
          <p className="text-[11px] text-rose-400 text-center">
            この端末では音声合成 (Speech Synthesis) が利用できません。テキスト表示のみご利用いただけます。
          </p>
        )}

        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/40 p-4">
          <p className="text-[10px] tracking-[0.25em] uppercase font-bold text-slate-500 mb-2">How to Train</p>
          <ol className="text-[11px] text-slate-400 leading-relaxed list-decimal pl-4 space-y-1">
            <li>まず音声だけを聴き、意味を推測する。</li>
            <li>影のように 0.5〜1 秒遅れで声に出して追いかける。</li>
            <li>5 回以上繰り返し、止まらず言えたら次の文へ。</li>
          </ol>
        </div>
      </main>

      <footer className="w-full max-w-md mt-6 mb-2">
        <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em]">
          © 2026 Go-on Lab.
        </p>
      </footer>
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2 rounded-xl text-xs font-bold transition border ${
        active
          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
          : "bg-slate-700/30 border-slate-700/50 text-slate-400 hover:text-white"
      }`}
    >
      <span className="mr-1">{active ? "●" : "○"}</span>
      {label}
    </button>
  );
}
