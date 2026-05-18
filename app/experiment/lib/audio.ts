export type Channel = "left" | "right" | "both";

export interface ToneSpec {
  frequencyHz: number;
  durationSec: number;
  rampSec: number;
  level: number;
  channel?: Channel;
}

export interface ScheduledTone {
  startTime: number;
  endTime: number;
}

export class AudioEngine {
  ctx: AudioContext;
  private masterGain: GainNode;
  private silentMediaEl: HTMLAudioElement | null = null;

  constructor() {
    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined;
    if (!Ctor) {
      throw new Error("Web Audio API is not supported in this browser.");
    }
    this.ctx = new Ctor({ latencyHint: "interactive" });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") {
      await this.ctx.resume();
    }
    this.attachSilentMediaEl();
  }

  /**
   * On iOS Safari, WebAudio is routed through the "ringer" channel and is
   * silenced when the device's physical mute switch is on. Attaching a tiny
   * looping <audio> element and starting it inside the same user gesture
   * that resumes the AudioContext forces iOS to treat subsequent audio as
   * media playback (controlled by the media volume), so a participant who
   * forgot to flip their mute switch still hears the stimuli.
   */
  private attachSilentMediaEl(): void {
    if (typeof document === "undefined") return;
    if (this.silentMediaEl) return;
    try {
      const el = document.createElement("audio");
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.setAttribute("x-webkit-airplay", "deny");
      el.preload = "auto";
      el.loop = true;
      el.muted = false;
      el.volume = 0.001;
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      this.silentMediaEl = el;
    } catch {
      /* not fatal */
    }

    // iOS hardens this further if the AudioContext is routed through a
    // MediaStream, which switches the page audio session to "playback"
    // category. Fail gracefully on browsers without MediaStream support.
    try {
      const ctxWithMs = this.ctx as AudioContext & {
        createMediaStreamDestination?: () => MediaStreamAudioDestinationNode;
      };
      if (
        !this.silentMediaStreamEl &&
        typeof ctxWithMs.createMediaStreamDestination === "function"
      ) {
        const dest = ctxWithMs.createMediaStreamDestination!();
        this.masterGain.connect(dest);
        const el = document.createElement("audio");
        el.setAttribute("playsinline", "");
        el.setAttribute("webkit-playsinline", "");
        el.autoplay = true;
        el.muted = false;
        (el as HTMLAudioElement & { srcObject?: MediaStream }).srcObject =
          dest.stream;
        const p = el.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
        this.silentMediaStreamEl = el;
      }
    } catch {
      /* fall back to the plain silent <audio> */
    }
  }

  private silentMediaStreamEl: HTMLAudioElement | null = null;

  async close(): Promise<void> {
    try {
      if (this.silentMediaEl) {
        this.silentMediaEl.pause();
        this.silentMediaEl.src = "";
        this.silentMediaEl = null;
      }
      if (this.silentMediaStreamEl) {
        this.silentMediaStreamEl.pause();
        (
          this.silentMediaStreamEl as HTMLAudioElement & {
            srcObject?: MediaStream | null;
          }
        ).srcObject = null;
        this.silentMediaStreamEl = null;
      }
    } catch {
      /* ignore */
    }
    try {
      await this.ctx.close();
    } catch {
      /* ignore */
    }
  }

  get currentTime(): number {
    return this.ctx.currentTime;
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  get baseLatency(): number | null {
    return typeof this.ctx.baseLatency === "number"
      ? this.ctx.baseLatency
      : null;
  }

  get outputLatency(): number | null {
    const c = this.ctx as AudioContext & { outputLatency?: number };
    return typeof c.outputLatency === "number" ? c.outputLatency : null;
  }

  scheduleTone(spec: ToneSpec, startTime: number): ScheduledTone {
    const { frequencyHz, durationSec, rampSec, level, channel = "both" } = spec;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequencyHz, startTime);

    const gain = this.ctx.createGain();
    const ramp = Math.min(rampSec, durationSec / 2);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(level, startTime + ramp);
    gain.gain.setValueAtTime(level, startTime + durationSec - ramp);
    gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

    osc.connect(gain);

    if (channel === "both") {
      gain.connect(this.masterGain);
    } else {
      const merger = this.ctx.createChannelMerger(2);
      const idx = channel === "left" ? 0 : 1;
      gain.connect(merger, 0, idx);
      merger.connect(this.masterGain);
    }

    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.02);

    return { startTime, endTime: startTime + durationSec };
  }

  async waitUntil(audioTime: number): Promise<void> {
    const remaining = audioTime - this.ctx.currentTime;
    if (remaining <= 0) return;
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.max(0, remaining * 1000)),
    );
  }

  private bufferCache = new Map<string, Promise<AudioBuffer>>();

  /**
   * Fetch and decode a WAV/MP3 file, caching the result so repeated trials
   * with the same stimulus don't re-decode.
   */
  loadBuffer(url: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;
    const p = (async () => {
      const resp = await fetch(url, { cache: "force-cache" });
      if (!resp.ok) throw new Error(`Failed to load stimulus: ${url} (${resp.status})`);
      const ab = await resp.arrayBuffer();
      return await this.ctx.decodeAudioData(ab.slice(0));
    })();
    this.bufferCache.set(url, p);
    p.catch(() => this.bufferCache.delete(url));
    return p;
  }

  /** Pre-warm the cache so the first trial doesn't pay the decode cost. */
  async preloadBuffers(urls: string[]): Promise<void> {
    await Promise.all(urls.map((u) => this.loadBuffer(u)));
  }

  scheduleBuffer(
    buffer: AudioBuffer,
    startTime: number,
    level: number,
  ): { startTime: number; endTime: number } {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = level;
    src.connect(gain);
    gain.connect(this.masterGain);
    src.start(startTime);
    return { startTime, endTime: startTime + buffer.duration };
  }
}

/**
 * 1 second of zeros at 8000 Hz mono, PCM 16-bit, base64-encoded.
 * Embedded inline so iOS Safari doesn't need a network fetch for the
 * silent-keepalive media element.
 */
const SILENT_WAV =
  "data:audio/wav;base64," +
  ((): string => {
    const sampleRate = 8000;
    const numSamples = sampleRate;
    const byteRate = sampleRate * 2;
    const dataSize = numSamples * 2;
    const fileSize = 36 + dataSize;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    v.setUint32(4, fileSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    v.setUint32(16, 16, true); // fmt chunk size
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, byteRate, true);
    v.setUint16(32, 2, true); // block align
    v.setUint16(34, 16, true); // bits per sample
    writeStr(36, "data");
    v.setUint32(40, dataSize, true);
    // A few non-zero PCM samples scattered through the buffer so the iOS
    // audio system doesn't shortcut the playback as "silent file" and skip
    // engaging the media session. Values are -3..+3 of int16 range, well
    // below any audible threshold.
    for (let i = 0; i < numSamples; i++) {
      const offset = 44 + i * 2;
      const sample = ((i * 7919) % 7) - 3; // deterministic tiny dither
      v.setInt16(offset, sample, true);
    }
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    if (typeof btoa === "function") return btoa(bin);
    return Buffer.from(bin, "binary").toString("base64");
  })();
