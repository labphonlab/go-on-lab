"use client";

import { useEffect, useMemo, useState } from "react";
import type { Section, Item } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/storage";
import { CardState, initCardState, isDue, reviewCard, Quality } from "@/lib/srs";
import { useSettings } from "@/lib/settings";
import { useSegmentPlayer } from "@/lib/useAudio";
import { explainFlags } from "@/lib/flagExplanations";

type Deck = Record<string, CardState>;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

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
    setPos((p) => p + 1);
  }

  if (!current) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center space-y-2">
        <p className="font-medium">このセッションの復習は終わりです。</p>
        <p className="text-sm text-slate-500">間隔反復のため、また期日が来たら表示されます。</p>
      </div>
    );
  }

  const explanations = explainFlags(current.difficulty_flags);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <p className="text-xs text-slate-400">
        {pos + 1} / {queue.length}
      </p>

      <div className="text-center space-y-2 py-4">
        <p className="text-2xl font-semibold">{current.text}</p>
        {showIPA && current.ipa && <p className="text-slate-500">/{current.ipa}/</p>}

        {current.audio && (
          <button
            disabled={playing}
            onClick={() => play(current.audio!, 1.0)}
            className="mt-2 rounded-full border border-slate-300 dark:border-slate-600 px-4 py-1 text-sm disabled:opacity-50"
          >
            🔊 音声再生
          </button>
        )}
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="w-full rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 py-2"
        >
          思い出してから答えを見る
        </button>
      ) : (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-lg">{current.ja || "(訳が未登録です)"}</p>
            {current.pos && <p className="text-xs text-slate-400">{current.pos}</p>}
          </div>

          {explanations.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
              {explanations.map((e, i) => (
                <li key={i}>⚠️ {e}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-4 gap-2 text-sm">
            <button onClick={() => rate(0)} className="rounded bg-red-100 dark:bg-red-950/40 py-2">
              もう一度
            </button>
            <button onClick={() => rate(3)} className="rounded bg-orange-100 dark:bg-orange-950/40 py-2">
              難しい
            </button>
            <button onClick={() => rate(4)} className="rounded bg-green-100 dark:bg-green-950/40 py-2">
              良い
            </button>
            <button onClick={() => rate(5)} className="rounded bg-blue-100 dark:bg-blue-950/40 py-2">
              簡単
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
