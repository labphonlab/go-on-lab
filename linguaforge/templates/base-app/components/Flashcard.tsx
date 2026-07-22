"use client";

import { useEffect, useMemo, useState } from "react";
import type { Section, Item } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { CardState, initCardState, isDue, reviewCard, Quality } from "@/lib/srs";
import { useSettings } from "@/lib/settings";
import { useSegmentPlayer } from "@/lib/useAudio";
import { explainFlags } from "@/lib/flagExplanations";
import ProgressBar from "./ProgressBar";

type Deck = Record<string, CardState>;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RATE_BUTTONS: { quality: Quality; label: string; className: string }[] = [
  { quality: 0, label: "もう一度", className: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  { quality: 3, label: "難しい", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  { quality: 4, label: "良い", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { quality: 5, label: "簡単", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" },
];

// Retrieval-practice-first flashcard (Roediger & Karpicke): always recall
// before the answer is revealed, never re-presentation-only.
export default function Flashcard({ section }: { section: Section }) {
  const bucket = `srs:${section.id}`;
  const { showIPA } = useSettings();
  const { play, playing } = useSegmentPlayer();

  const [deck, setDeck] = useState<Deck>({});
  const [queue, setQueue] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);

  function startSession() {
    const now = new Date();
    const stored = loadJSON<Deck>(bucket, {});
    const filled: Deck = { ...stored };
    for (const item of section.items) {
      if (!filled[item.id]) filled[item.id] = initCardState(now);
    }
    setDeck(filled);

    const due = section.items.filter((it) => isDue(filled[it.id], now)).map((it) => it.id);
    setQueue(shuffled(due.length > 0 ? due : section.items.map((it) => it.id)));
    setPos(0);
    setRevealed(false);
  }

  useEffect(startSession, [section.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const itemsById = useMemo(() => {
    const map = new Map<string, Item>();
    for (const it of section.items) map.set(it.id, it);
    return map;
  }, [section.items]);

  const current = pos < queue.length ? itemsById.get(queue[pos]) : undefined;

  function rate(quality: Quality) {
    if (!current) return;
    const now = new Date();
    const updated = reviewCard(deck[current.id], quality, now);
    const nextDeck = { ...deck, [current.id]: updated };
    setDeck(nextDeck);
    saveJSON(bucket, nextDeck);
    setRevealed(false);
    setTimeout(() => setPos((p) => p + 1), 120);
  }

  if (!current) {
    return (
      <div className="card p-8 text-center space-y-3 animate-pop-in">
        <div className="text-4xl">🎉</div>
        <p className="font-medium">このセッションの復習は終わりです。</p>
        <p className="text-sm text-stone-500">間隔反復のため、また期日が来たら表示されます。</p>
        <button
          onClick={startSession}
          className="mt-2 rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          もう一度練習する
        </button>
      </div>
    );
  }

  const explanations = explainFlags(current.difficulty_flags);

  return (
    <div className="space-y-3">
      <ProgressBar current={pos} total={queue.length} />

      <div className="perspective">
        <div
          className={`relative min-h-[19rem] transition-transform duration-500 [transform-style:preserve-3d] ${
            revealed ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* front: recall prompt */}
          <div className="card absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center [backface-visibility:hidden]">
            <p className="text-2xl font-semibold">{current.text}</p>
            {showIPA && current.ipa && <p className="text-stone-500">/{current.ipa}/</p>}

            {current.audio && (
              <button
                disabled={playing}
                onClick={() => play(current.audio!, 1.0)}
                className="rounded-full border border-stone-200 dark:border-stone-700 px-4 py-1.5 text-sm disabled:opacity-50"
              >
                🔊 音声再生
              </button>
            )}

            <button
              onClick={() => setRevealed(true)}
              className="mt-2 w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500"
            >
              思い出してから答えを見る
            </button>
          </div>

          {/* back: answer + self-rating */}
          <div className="card absolute inset-0 flex flex-col justify-center gap-3 overflow-y-auto p-6 [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <div className="text-center">
              <p className="text-lg">{current.ja || "(訳が未登録です)"}</p>
              {current.pos && <p className="text-xs text-stone-400 mt-0.5">{current.pos}</p>}
            </div>

            {explanations.length > 0 && (
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5">
                {explanations.map((e, i) => (
                  <li key={i}>⚠️ {e}</li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-4 gap-1.5 text-xs sm:text-sm">
              {RATE_BUTTONS.map((b) => (
                <button
                  key={b.quality}
                  onClick={() => rate(b.quality)}
                  className={`rounded-lg py-2.5 font-medium hover:brightness-95 ${b.className}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
