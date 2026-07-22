const STOPWORDS = new Set([
  "i", "you", "he", "she", "we", "they", "it",
  "a", "an", "the", "is", "are", "was", "were", "am", "be", "been",
  "have", "has", "had", "to", "of", "in", "on", "at", "for", "and", "but",
  "or", "that", "this", "please", "so", "not",
]);

function clean(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

// Picks the most content-bearing word in a sentence (longest non-stopword) —
// used to choose what to blank out in a cloze drill without any extra
// per-item metadata from the analysis layer.
export function pickContentWordIndex(words: string[]): number {
  let bestIdx = words.length - 1;
  let bestLen = -1;
  words.forEach((w, i) => {
    const c = clean(w);
    if (!c || STOPWORDS.has(c)) return;
    if (c.length > bestLen) {
      bestLen = c.length;
      bestIdx = i;
    }
  });
  return bestIdx;
}

export function normalizeWord(word: string): string {
  return clean(word);
}
