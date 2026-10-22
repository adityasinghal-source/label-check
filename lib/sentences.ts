// [start, end) of the sentence around text[from, to), bounded by . ! ? or a line break.
// The ending punctuation is included; leading spaces are not.
export function sentenceRange(text: string, from: number, to: number): [number, number] {
  let start = from;
  while (start > 0 && !/[.!?\n]/.test(text[start - 1])) start--;
  let end = to;
  while (end < text.length && !/[.!?\n]/.test(text[end])) end++;
  if (end < text.length && /[.!?]/.test(text[end])) end++;
  while (start < end && /\s/.test(text[start])) start++;
  return [start, end];
}

// Where `quote` appears in `text`, ignoring case and differences in spacing. null if it doesn't.
export function findQuote(text: string, quote: string): [number, number] | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i");
  const match = pattern.exec(text);
  return match ? [match.index, match.index + match[0].length] : null;
}
