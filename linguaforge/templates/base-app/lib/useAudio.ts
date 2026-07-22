"use client";

import { useCallback, useRef, useState } from "react";
import { playSegment } from "./audio";
import type { AudioRef } from "./types";

export function useSegmentPlayer() {
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const play = useCallback(async (audio: AudioRef, rate: 0.75 | 1.0 = 1.0) => {
    stopRef.current?.();
    setPlaying(true);
    const handle = await playSegment(`/audio/${audio.file}`, audio.start, audio.end, rate);
    stopRef.current = handle.stop;
    await handle.onEnded;
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    stopRef.current?.();
    setPlaying(false);
  }, []);

  return { play, stop, playing };
}
