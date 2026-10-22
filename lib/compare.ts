import type { Flag, Report } from "./types";

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Flags that only one market raises: what has to change to sell there specifically.
// Two flags count as "the same problem" when they point at the same wording on the label.
export function onlyIn(report: Report, other: Report): Flag[] {
  const otherQuotes = new Set(other.flags.filter((f) => f.quotedText).map((f) => normalize(f.quotedText)));
  return report.flags.filter((f) => !f.quotedText || !otherQuotes.has(normalize(f.quotedText)));
}
