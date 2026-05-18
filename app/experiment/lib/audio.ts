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
  }

  async close(): Promise<void> {
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
}
