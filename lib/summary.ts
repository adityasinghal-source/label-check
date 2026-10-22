import type { Flag } from "./types";

export type Readiness = {
  tone: "red" | "amber" | "green";
  verdict: string;
  counts: string;
};

// The verdict shown above the detail. It never says "compliant": at best, no issues were found.
export function readiness(flags: Flag[], packVersion: string): Readiness {
  const high = flags.filter((f) => f.severity === "high").length;
  const medium = flags.filter((f) => f.severity === "medium").length;
  const low = flags.filter((f) => f.severity === "low").length;

  const parts = [
    high && `${high} high-risk`,
    medium && `${medium} medium`,
    low && `${low} low`,
  ].filter(Boolean);
  const counts = parts.join(", ");

  if (high) return { tone: "red", verdict: "Not ready to print", counts };
  if (medium) return { tone: "amber", verdict: "Review before printing", counts };
  if (low) return { tone: "green", verdict: "Minor suggestions only", counts };
  return {
    tone: "green",
    verdict: `No issues found against rule pack v${packVersion}`,
    counts: "Have an expert confirm before printing.",
  };
}
