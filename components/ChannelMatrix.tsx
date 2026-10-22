"use client";

import { useState } from "react";
import { card, chip, chipNeutral, chipUnverified } from "@/components/styles";
import { cellFor, channelVerdict, type Cell } from "@/lib/matrix";
import type { Report } from "@/lib/types";

const CELL = {
  pass: { icon: "✓", text: "Passes", style: "border border-pass bg-pass-soft text-pass" },
  warn: { icon: "!", text: "Warning", style: "border border-medium bg-medium-soft text-medium" },
  fail: { icon: "✕", text: "Fails", style: "border border-high bg-high-soft text-high" },
} satisfies Record<Cell, { icon: string; text: string; style: string }>;

const ORDER: Cell[] = ["fail", "warn", "pass"];

// The same label can pass on one channel and fail on another. Two views, neither scrolls sideways:
// By issue = each issue with its channels grouped into pass / warning / fail pills;
// By channel = one collapsible card per channel with its verdict and issues.
export default function ChannelMatrix({ report, onSelect }: { report: Report; onSelect: (index: number) => void }) {
  const [view, setView] = useState<"issue" | "channel">("issue");
  const notes = report.channels.filter((c) => c.note);

  return (
    <section className={`${card} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Channel by channel</h3>
        <div className="flex rounded-lg border border-line bg-raised p-0.5 text-xs font-semibold print:hidden" role="group" aria-label="Matrix view">
          {(["issue", "channel"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 ${view === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              By {v}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        Fails = a verified label problem. Warning = lower risk, an unverified rule, or something to confirm with the channel.
      </p>

      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Channel verdicts">
        {report.channels.map((c) => {
          const verdict = channelVerdict(report.flags, c.id);
          return (
            <li key={c.id} className={`${chip} gap-1 ${CELL[verdict.tone].style}`}>
              <span aria-hidden>{CELL[verdict.tone].icon}</span> {c.label}: {verdict.label}
            </li>
          );
        })}
      </ul>

      {view === "issue" ? (
        <ul className="mt-4 divide-y divide-line">
          {report.flags.map((flag, i) => {
            const groups = ORDER.map((tone) => ({
              tone,
              channels: report.channels.filter((c) => cellFor(flag, c.id) === tone).map((c) => c.label),
            })).filter((g) => g.channels.length);
            return (
              <li key={`${flag.ruleId}-${flag.quotedText}-${i}`} className="py-2.5">
                <button type="button" onClick={() => onSelect(i)} className="text-left hover:underline">
                  <span className="font-medium">{flag.ruleName}</span>
                  {flag.quotedText && <span className="ml-1 text-sm text-muted">“{flag.quotedText}”</span>}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] text-muted">{flag.ruleId}</span>
                  {!flag.verified && <span className={`${chip} ${chipUnverified}`}>Unverified</span>}
                  {flag.confirmOnly && <span className={`${chip} ${chipNeutral}`}>Confirm</span>}
                  {groups.map((g) => (
                    <span key={g.tone} className={`${chip} gap-1 ${CELL[g.tone].style}`}>
                      <span aria-hidden>{CELL[g.tone].icon}</span>
                      <span className="sr-only">{CELL[g.tone].text} on</span>
                      {g.channels.length === report.channels.length ? "All channels" : g.channels.join(", ")}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
          {report.flags.length === 0 && <li className="py-3 text-muted">No issues found on any selected channel.</li>}
        </ul>
      ) : (
        <div className="mt-4 space-y-2">
          {report.channels.map((c) => {
            const verdict = channelVerdict(report.flags, c.id);
            const issues = report.flags.map((f, i) => ({ f, i, cell: cellFor(f, c.id) })).filter((x) => x.cell !== "pass");
            return (
              <details key={c.id} className="group rounded-lg border border-line" open={verdict.tone === "fail"}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
                  <span className="font-semibold">{c.label}</span>
                  <span className="flex items-center gap-2">
                    <span className={`${chip} ${CELL[verdict.tone].style}`}>
                      {verdict.label} · {issues.length} issue{issues.length === 1 ? "" : "s"}
                    </span>
                    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-muted transition-transform group-open:rotate-90">
                      <path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </span>
                </summary>
                <ul className="space-y-1 px-3 pb-3 text-sm">
                  {issues.map(({ f, i, cell }) => (
                    <li key={`${f.ruleId}-${i}`} className="flex items-start gap-2">
                      <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${CELL[cell].style}`}>
                        <span aria-hidden>{CELL[cell].icon}</span>
                        <span className="sr-only">{CELL[cell].text}</span>
                      </span>
                      <button type="button" onClick={() => onSelect(i)} className="text-left hover:underline">
                        {f.ruleName}
                        {f.quotedText && <span className="text-muted"> “{f.quotedText}”</span>}
                      </button>
                    </li>
                  ))}
                  {issues.length === 0 && <li className="text-muted">No issues found for this channel.</li>}
                  {c.note && <li className="text-xs text-muted">{c.note}</li>}
                </ul>
              </details>
            );
          })}
        </div>
      )}

      {notes.length > 0 && view === "issue" && (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {notes.map((c) => (
            <li key={c.id}>
              <span className="font-semibold">{c.label}:</span> {c.note}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
