const DAYS_PER = { day: 1, week: 7, month: 30, year: 365 } as const;

// Reads a declared shelf life such as "Best before 6 months from manufacture" or "Shelf life: 90 days".
// Returns the period in days and the words it came from, or null if the label doesn't state one.
export function declaredShelfLife(text: string): { days: number; phrase: string } | null {
  const match = /(?:best\s*before|use\s*by|shelf[\s-]*life)[^\n]{0,40}?(\d+(?:\.\d+)?)\s*(day|week|month|year)s?\b/i.exec(text);
  if (!match) return null;
  const unit = match[2].toLowerCase() as keyof typeof DAYS_PER;
  return { days: Math.round(Number(match[1]) * DAYS_PER[unit]), phrase: match[0] };
}
