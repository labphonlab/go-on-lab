"use client";

import { useEffect, useState } from "react";
import type { Section } from "@/lib/types";
import { useSegmentPlayer } from "@/lib/useAudio";
import { useSettings } from "@/lib/settings";
import MeaningMatchQuestion from "./MeaningMatchQuestion";

const VIEWS = [
  { key: "read", label: "音読フォロー" },
  { key: "check", label: "理解度チェック" },
] as const;

const CHECK_COUNT = 3;

export default function KaraokeReader({ section }: { section: Section }) {
  const { showIPA } = useSettings();
  const { play, stop, playing } = useSegmentPlayer();

  const [view, setView] = useState<(typeof VIEWS)[number]["key"]>("read");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rate, setRate] = useState<0.75 | 1.0>(1.0);
  const [runningAll, setRunningAll] = useState(false);

  const items = section.items;
  const checkItems = items.slice(0, CHECK_COUNT);
  const [checkIndex, setCheckIndex] = useState(0);

  async function playOne(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item?.audio) return;
    setActiveId(id);
    await play(item.audio, rate);
    setActiveId(null);
  }

  async function playAll() {
    setRunningAll(true);
    for (const item of items) {
      if (!item.audio) continue;
      setActiveId(item.id);
      await play(item.audio, rate);
    }
    setActiveId(null);
    setRunningAll(false);
  }

  function stopAll() {
    stop();
    setActiveId(null);
    setRunningAll(false);
  }

  useEffect(() => {
    setCheckIndex(0);
  }, [section.id]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-stone-100 dark:bg-stone-900 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => {
              stopAll();
              setView(v.key);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              view === v.key
                ? "bg-white text-indigo-600 shadow-sm dark:bg-stone-800 dark:text-indigo-300"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "read" ? (
        <div className="card p-6 space-y-4">
          <p className="leading-loose text-lg">
            {items.map((item) => (
              <span
                key={item.id}
                onClick={() => item.audio && !runningAll && playOne(item.id)}
                className={`cursor-pointer rounded px-0.5 transition-colors ${
                  activeId === item.id
                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
                    : "hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
              >
                {item.text}{" "}
              </span>
            ))}
          </p>
          {showIPA && (
            <p className="text-xs text-stone-400">
              {items.filter((it) => it.ipa).map((it) => `/${it.ipa}/`).join("  ")}
            </p>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={runningAll || playing ? stopAll : playAll}
              className="rounded-full bg-indigo-600 text-white px-5 py-2.5 font-medium hover:bg-indigo-500"
            >
              {runningAll || playing ? "■ 停止" : "▶ 全文再生"}
            </button>
            <div className="flex text-xs border rounded-full overflow-hidden border-stone-200 dark:border-stone-700">
              {[0.75, 1.0].map((r) => (
                <button
                  key={r}
                  onClick={() => setRate(r as 0.75 | 1.0)}
                  className={`px-3 py-2 ${
                    rate === r ? "bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900" : "text-stone-500"
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-center text-stone-400">文をタップすると、その部分だけ再生されます</p>
        </div>
      ) : checkItems.length === 0 ? (
        <p className="text-sm text-stone-500">確認できる項目がありません。</p>
      ) : (
        <div className="card p-6 space-y-4">
          <p className="text-xs text-center text-stone-400">
            {checkIndex + 1} / {checkItems.length}
          </p>
          <MeaningMatchQuestion item={checkItems[checkIndex]} pool={items} />
          <button
            onClick={() => setCheckIndex((i) => Math.min(i + 1, checkItems.length - 1))}
            disabled={checkIndex === checkItems.length - 1}
            className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-medium hover:bg-indigo-500 disabled:opacity-40"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
