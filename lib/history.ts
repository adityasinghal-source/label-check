import type { SharedInputs } from "./shareState";
import type { Explanation, Report } from "./types";

// The last 5 checks, kept in this browser only. Storage can be blocked (private mode), so every
// read and write is wrapped and the page works without it. React reads it with useSyncExternalStore.
export type HistoryEntry = {
  id: string;
  at: string;
  inputs: SharedInputs;
  report: Report | null;
  explanation: Explanation | null;
  tally: string;
};

// v3: reports gained print sizes, barcodes and pack type, so older entries are not read.
const KEY = "shelfready-history-v3";
const MAX = 5;
export const NO_HISTORY: HistoryEntry[] = [];

const listeners = new Set<() => void>();
let cache: HistoryEntry[] | null = null;

function read(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function subscribeHistory(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function historySnapshot(): HistoryEntry[] {
  cache ??= read();
  return cache;
}

export function saveToHistory(entry: Omit<HistoryEntry, "id" | "at">) {
  const full: HistoryEntry = { ...entry, id: String(Date.now()), at: new Date().toISOString() };
  cache = [full, ...historySnapshot()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked or full: history is kept for this visit only.
  }
  listeners.forEach((l) => l());
}
