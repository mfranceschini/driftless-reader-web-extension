const MAX_RECAP_CHARS = 220;

/** Splits text into sentences (good enough for recaps; not a full NLP splitter). */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  return normalized.split(/(?<=[.!?…]["'”’)\]]?)\s+(?=[A-Z0-9"“'‘([¿¡À-ÖØ-Þ])/u).filter(Boolean);
}

/**
 * The last sentence of a block — "the last thing you read" — trimmed from
 * the start if it is very long, so the recap stays glanceable.
 */
export function lastSentence(text: string, maxChars = MAX_RECAP_CHARS): string {
  const sentences = splitSentences(text);
  const last = sentences[sentences.length - 1] ?? '';
  if (last.length <= maxChars) return last;
  const cut = last.slice(last.length - maxChars);
  const firstSpace = cut.indexOf(' ');
  return `…${firstSpace > 0 ? cut.slice(firstSpace + 1) : cut}`;
}

/** "3 min", "45 s", "1 h 5 min" */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
