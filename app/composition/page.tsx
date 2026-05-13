"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LEVEL_LABEL, Level, sentencesByLevel } from "@/app/lib/sentences";
import { isSpeechAvailable, normalizeForCompare, similarity, speak, stopSpeaking, warmUpVoices } from "@/app/lib/speech";

type Verdict = "perfect" | "close" | "miss" | null;

const subscribeNoop = () => () => {};

export default function CompositionPage() {
  const [level, setLevel] = useState<Level>("beginner");
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [reveal, setReveal] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const available = useSyncExternalStore(
    subscribeNoop,
    () => isSpeechAvailable(),
    () => true
  );

  const list = useMemo(() => sentencesByLevel(level), [level]);
  const current = list[idx];

  useEffect(() => {
    warmUpVoices();
    return () => stopSpeaking();
  }, []);

  const handleLevelChange = (l: Level) => {
    if (l === level) return;
    stopSpeaking();
    setIdx(0);
    setAnswer("");
    setReveal(false);
    setVerdict(null);
    setScore({ correct: 0, total: 0 });
    setLevel(l);
  };

  const handleCheck = () => {
    if (!current || !answer.trim()) return;
    const sim = similarity(answer, current.en);
    const exact = normalizeForCompare(answer) === normalizeForCompare(current.en);
    const v: Verdict = exact ? "perfect" : sim >= 0.7 ? "close" : "miss";
    setVerdict(v);
    setReveal(true);
    setScore((s) => ({
      correct: s.correct + (v === "perfect" || v === "close" ? 1 : 0),
      total: s.total + 1,
    }));
  };

  const handleNext = () => {
    stopSpeaking();
    setAnswer("");
    setReveal(false);
    setVerdict(null);
    setIdx((i) => (i + 1) % list.length);
  };

  const handlePrev = () => {
    stopSpeaking();
    setAnswer("");
    setReveal(false);
    setVerdict(null);
    setIdx((i) => (i - 1 + list.length) % list.length);
  };

  const handlePlay = () => {
    if (!current) return;
    speak(current.en, { rate: 0.95 });
  };

  if (!current) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center px-5 py-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-15%] right-[-10%] w-[55%] h-[45%] bg-indigo-500/15 rounded-full blur-[120px]" />
      </div>

      <header className="w-full max-w-md flex items-center justify-between mb-4">
        <Link href="/" className="text-slate-400 hover:text-indigo-300 text-sm transition-colors flex items-center gap-1">
          <span>←</span>
          <span className="uppercase tracking-widest text-[10px] font-bold">Home</span>
        </Link>
        <div>
          <p className="text-[9px] tracking-[0.3em] uppercase text-slate-500 font-bold text-right">Mode</p>
          <p className="text-sm font-black text-indigo-300">瞬間英作文</p>
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
                  ? "bg-indigo-500 text-white shadow shadow-indigo-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>

        {/* Progress + Score */}
        <div className="flex items-center justify-between text-[10px] tracking-[0.25em] uppercase font-bold text-slate-500">
          <span>
            {String(idx + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
          </span>
          <span className="text-indigo-300">
            {score.correct} / {score.total} OK
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden -mt-2">
          <div
            className="bg-indigo-500 h-full transition-all duration-300"
            style={{ width: `${((idx + 1) / list.length) * 100}%` }}
          />
        </div>

        {/* Japanese Prompt */}
        <section className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6">
          <p className="text-[9px] tracking-[0.3em] uppercase font-bold text-indigo-300 mb-2">日本語</p>
          <p className="text-lg font-semibold text-white leading-relaxed">{current.ja}</p>
        </section>

        {/* Input */}
        <section className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6 flex flex-col gap-3">
          <label className="text-[9px] tracking-[0.3em] uppercase font-bold text-slate-500">
            Your English
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your translation..."
            rows={3}
            spellCheck={false}
            autoCapitalize="sentences"
            autoCorrect="off"
            className="bg-slate-900/60 border border-slate-700/60 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none rounded-2xl p-4 text-white text-base leading-relaxed resize-none transition"
          />
          {!reveal ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setReveal(true)}
                className="py-3 rounded-2xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-700/30 active:scale-[0.98] transition"
              >
                答えを見る
              </button>
              <button
                onClick={handleCheck}
                disabled={!answer.trim()}
                className="py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-black shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                判定する
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePlay}
                disabled={!available}
                className="py-3 rounded-2xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-700/30 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
                  <path d="M7 5v14l12-7z" />
                </svg>
                発音を聴く
              </button>
              <button
                onClick={handleNext}
                className="py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-black shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition"
              >
                次へ →
              </button>
            </div>
          )}
        </section>

        {/* Answer + Verdict */}
        {reveal && (
          <section className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6 flex flex-col gap-3">
            {verdict && <VerdictBadge verdict={verdict} />}
            <div>
              <p className="text-[9px] tracking-[0.3em] uppercase font-bold text-emerald-400 mb-2">Model Answer</p>
              <p className="text-base font-semibold text-white leading-relaxed">{current.en}</p>
            </div>
            {verdict && verdict !== "perfect" && answer.trim() && (
              <div className="pt-3 border-t border-slate-700/60">
                <p className="text-[9px] tracking-[0.3em] uppercase font-bold text-slate-500 mb-2">Your Answer</p>
                <p className="text-sm text-slate-400 leading-relaxed">{answer}</p>
              </div>
            )}
          </section>
        )}

        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            className="flex-1 py-2 rounded-xl border border-slate-700/60 text-slate-400 text-xs font-bold hover:text-white hover:border-slate-600 transition"
          >
            ← 前の文
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-2 rounded-xl border border-slate-700/60 text-slate-400 text-xs font-bold hover:text-white hover:border-slate-600 transition"
          >
            スキップ →
          </button>
        </div>

        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/40 p-4">
          <p className="text-[10px] tracking-[0.25em] uppercase font-bold text-slate-500 mb-2">How to Train</p>
          <ol className="text-[11px] text-slate-400 leading-relaxed list-decimal pl-4 space-y-1">
            <li>日本語を見たら、3秒以内に英文を組み立てる。</li>
            <li>完璧でなくても「言い切る」ことを優先する。</li>
            <li>判定後、発音を聴いて口に出して 3 回リピート。</li>
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

function VerdictBadge({ verdict }: { verdict: NonNullable<Verdict> }) {
  const cfg = {
    perfect: { label: "Perfect", emoji: "◎", color: "from-emerald-500 to-teal-400", text: "完全一致！" },
    close: { label: "Close", emoji: "○", color: "from-amber-500 to-orange-400", text: "もう一歩！意味は通じます。" },
    miss: { label: "Try Again", emoji: "△", color: "from-rose-500 to-pink-500", text: "正解と比べてみましょう。" },
  }[verdict];
  return (
    <div className={`bg-gradient-to-r ${cfg.color} rounded-2xl p-4 text-white flex items-center gap-3 shadow-lg`}>
      <div className="text-3xl font-black">{cfg.emoji}</div>
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase font-black">{cfg.label}</p>
        <p className="text-sm font-bold">{cfg.text}</p>
      </div>
    </div>
  );
}
