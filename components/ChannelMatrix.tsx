"use client";

import { card, chip } from "@/components/styles";
import { cellFor, channelVerdict, type Cell } from "@/lib/matrix";
import type { Report } from "@/lib/types";

const CELL = {
  pass: { icon: "✓", text: "Pass", style: "bg-pass-soft text-pass" },
  warn: { icon: "!", text: "Warning", style: "bg-medium-soft text-medium" },
  fail: { icon: "✕", text: "Fail", style: "bg-high-soft text-high" },
} satisfies Record<Cell, { icon: string; text: string; style: string }>;

// Each issue is a row, each selected channel a column: the same label can pass on one channel and fail on another.
export default function ChannelMatrix({ report, onSelect }: { report: Report; onSelect: (index: number) => void }) {
  const notes = report.channels.filter((c) => c.note);

  return (
    <section className={`${card} p-4`}>
      <h3 className="font-semibold">Channel by channel</h3>
      <p className="mt-0.5 text-sm text-muted">
        Fail = a verified label problem. Warning = lower risk, an unverified rule, or something to confirm with the
        channel.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 pr-3 font-semibold">Issue</th>
              {report.channels.map((c) => {
                const verdict = channelVerdict(report.flags, c.id);
                return (
                  <th key={c.id} className="px-2 py-2 text-center align-bottom font-semibold">
                    <span className="block">{c.label}</span>
                    <span className={`${chip} mt-1 ${CELL[verdict.tone].style}`}>{verdict.label}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {report.flags.map((flag, i) => (
              <tr key={`${flag.ruleId}-${flag.quotedText}-${i}`} className="border-b border-line last:border-0">
                <td className="py-2 pr-3">
                  <button type="button" onClick={() => onSelect(i)} className="text-left hover:underline">
                    <span className="font-medium">{flag.ruleName}</span>
                    {flag.quotedText && <span className="block text-xs text-muted">“{flag.quotedText}”</span>}
                  </button>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    <span className="font-mono text-[11px] text-muted">{flag.ruleId}</span>
                    {!flag.verified && <span className={`${chip} bg-raised text-muted`}>Unverified</span>}
                    {flag.confirmOnly && <span className={`${chip} bg-raised text-muted`}>Confirm</span>}
                  </span>
                </td>
                {report.channels.map((c) => {
                  const cell = CELL[cellFor(flag, c.id)];
                  return (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-bold ${cell.style}`}
                        title={`${c.label}: ${cell.text}`}
                      >
                        <span aria-hidden>{cell.icon}</span>
                        <span className="sr-only">{cell.text}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {report.flags.length === 0 && (
              <tr>
                <td colSpan={report.channels.length + 1} className="py-3 text-muted">
                  No issues found on any selected channel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {notes.length > 0 && (
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
