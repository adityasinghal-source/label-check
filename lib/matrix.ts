import type { Flag } from "./types";

export type Cell = "pass" | "warn" | "fail";

// One cell of the channel matrix. A hard "fail" needs a verified, high-severity label problem;
// unverified rules and things to confirm are only ever warnings, so a guess never reads as fact.
export function cellFor(flag: Flag, channelId: string): Cell {
  const applies = flag.channels.length === 0 || flag.channels.includes(channelId);
  if (!applies) return "pass";
  if (flag.confirmOnly || !flag.verified || flag.severity !== "high") return "warn";
  return "fail";
}

export function channelVerdict(flags: Flag[], channelId: string): { tone: Cell; label: string } {
  const cells = flags.map((f) => cellFor(f, channelId));
  if (cells.includes("fail")) return { tone: "fail", label: "Fails" };
  if (cells.includes("warn")) return { tone: "warn", label: "Warnings" };
  return { tone: "pass", label: "No issues found" };
}
