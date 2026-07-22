import { loadJSON } from "./storage";
import type { Section } from "./types";
import type { CardState } from "./srs";

// Best-effort "how far along is this section" number for the home page.
// Deliberately approximate — it only has to be encouraging and roughly
// truthful, not a precise mastery metric.
export function computeProgress(section: Section): number | null {
  if (section.content_type === "vocabulary_list") {
    const deck = loadJSON<Record<string, CardState>>(`srs:${section.id}`, {});
    const total = section.items.length;
    if (total === 0) return null;
    const mastered = section.items.filter((it) => (deck[it.id]?.repetition ?? 0) >= 2).length;
    return Math.round((mastered / total) * 100);
  }
  if (section.content_type === "dialogue") {
    const done = loadJSON<Record<string, boolean>>(`dictation:${section.id}`, {});
    const withAudio = section.items.filter((it) => it.audio);
    if (withAudio.length === 0) return null;
    const finished = withAudio.filter((it) => done[it.id]).length;
    return Math.round((finished / withAudio.length) * 100);
  }
  return null;
}
