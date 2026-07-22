// Partial-segment playback via Web Audio API (AGENTS.md: timestamp-based
// partial playback, 0.75x/1.0x speed required). Buffers are decoded once and
// cached by URL since the same section's audio file backs many items.

const bufferCache = new Map<string, Promise<AudioBuffer>>();
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedContext;
}

function loadBuffer(url: string): Promise<AudioBuffer> {
  let cached = bufferCache.get(url);
  if (!cached) {
    cached = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => getContext().decodeAudioData(data));
    bufferCache.set(url, cached);
  }
  return cached;
}

export interface PlaybackHandle {
  stop: () => void;
  onEnded: Promise<void>;
}

export async function playSegment(
  audioUrl: string,
  start: number,
  end: number,
  rate: 0.75 | 1.0 = 1.0
): Promise<PlaybackHandle> {
  const ctx = getContext();
  if (ctx.state === "suspended") await ctx.resume();

  const buffer = await loadBuffer(audioUrl);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;

  const duration = Math.max(0, end - start);
  source.connect(ctx.destination);

  let resolveEnded!: () => void;
  const onEnded = new Promise<void>((resolve) => {
    resolveEnded = resolve;
  });
  source.onended = () => resolveEnded();

  source.start(0, start, duration / rate);

  return {
    stop: () => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    },
    onEnded,
  };
}
