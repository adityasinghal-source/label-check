import { channelVerdict } from "./matrix";
import { readiness } from "./summary";
import type { Explanation, Report } from "./types";

// A plain-text summary to paste into an email or chat for a designer or compliance team.
export function reportSummary(report: Report, explanation: Explanation | null = null): string {
  const r = readiness(report.flags, report.packVersion);
  const lines = [
    `ShelfReady audit: ${r.verdict} (${r.counts})`,
    `Checked against ${report.packLabel} rule pack v${report.packVersion} · ${report.category.label}` +
      (report.channels.length ? ` · ${report.channels.map((c) => c.label).join(", ")}` : ""),
  ];
  if (explanation) lines.push("", `Likely reason for rejection: ${explanation.likelyCause}`);
  if (report.channels.length) {
    lines.push("", "Channels:");
    for (const c of report.channels) lines.push(`- ${c.label}: ${channelVerdict(report.flags, c.id).label}`);
  }
  const problems = report.flags.filter((f) => !f.confirmOnly);
  if (problems.length) {
    lines.push("", "Issues:");
    for (const f of problems) {
      const quote = f.quotedText ? ` "${f.quotedText}"` : "";
      const fix = f.suggestedRewrite || f.advice;
      lines.push(`- [${f.severity.toUpperCase()}] ${f.ruleId} ${f.ruleName}${quote}${f.verified ? "" : " (unverified)"}`);
      if (fix) lines.push(`  Fix: ${fix}`);
    }
  }
  const confirms = report.flags.filter((f) => f.confirmOnly);
  if (confirms.length) {
    lines.push("", "Confirm with the channel:");
    for (const f of confirms) lines.push(`- ${f.ruleId} ${f.ruleName}`);
  }
  if (report.allergenStatement) lines.push("", `Allergen statement: ${report.allergenStatement}`);
  lines.push("", "A screening aid, not legal advice. Have an expert review flagged items before printing.");
  return lines.join("\n");
}
