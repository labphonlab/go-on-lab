"use client";

export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onStart?: () => void;
};

export function isSpeechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechAvailable()) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const preferred =
    voices.find((v) => v.lang === "en-US" && /female|samantha|google/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang.startsWith("en-")) ||
    voices[0];
  cachedVoice = preferred ?? null;
  return cachedVoice;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!isSpeechAvailable()) {
    opts.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = opts.rate ?? 1;
  utter.pitch = opts.pitch ?? 1;
  utter.volume = opts.volume ?? 1;
  const voice = pickEnglishVoice();
  if (voice) utter.voice = voice;
  if (opts.onStart) utter.onstart = opts.onStart;
  utter.onend = () => opts.onEnd?.();
  utter.onerror = () => opts.onEnd?.();
  synth.speak(utter);
}

export function stopSpeaking(): void {
  if (!isSpeechAvailable()) return;
  window.speechSynthesis.cancel();
}

export function warmUpVoices(): void {
  if (!isSpeechAvailable()) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickEnglishVoice();
  };
}

export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'`’“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function similarity(a: string, b: string): number {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const aw = na.split(" ");
  const bw = nb.split(" ");
  const bSet = new Set(bw);
  const match = aw.filter((w) => bSet.has(w)).length;
  return match / Math.max(aw.length, bw.length);
}
