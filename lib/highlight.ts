import { findQuote } from "./sentences";
import type { Flag } from "./types";

// A run of label text and the flags (by index) that cover it. Empty flagIndexes = plain text.
export type Segment = { text: string; flagIndexes: number[] };

export function highlightSegments(text: string, flags: Flag[]): Segment[] {
  const ranges = flags
    .map((flag, index) => {
      const found = flag.quotedText ? findQuote(text, flag.quotedText) : null;
      return found && { start: found[0], end: found[1], index };
    })
    .filter((r) => r !== null);

  const cuts = [...new Set([0, text.length, ...ranges.flatMap((r) => [r.start, r.end])])].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [start, end] = [cuts[i], cuts[i + 1]];
    if (start === end) continue;
    const flagIndexes = ranges.filter((r) => r.start <= start && r.end >= end).map((r) => r.index);
    segments.push({ text: text.slice(start, end), flagIndexes });
  }
  return segments;
}
