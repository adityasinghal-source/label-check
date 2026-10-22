"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import HighlightedLabel from "@/components/HighlightedLabel";
import { sectionLabel } from "@/components/styles";
import { fixAll } from "@/lib/fixAll";
import type { Report } from "@/lib/types";

// One click applies every suggested fix and shows the corrected label next to the original.
export default function FixAllPanel({ report, onRecheck }: { report: Report; onRecheck?: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const result = fixAll(report.labelText, report.flags, report.allergenStatement);
  const nothingToFix = result.applied.length === 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={nothingToFix}
        className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
      >
        {nothingToFix ? "Nothing to fix automatically" : "Fix all"}
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-pass/40 bg-pass-soft p-4">
      <h3 className="font-semibold">Before and after</h3>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <p className={`mb-1 ${sectionLabel}`}>Your draft</p>
          <HighlightedLabel text={report.labelText} flags={report.flags} />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className={sectionLabel}>Fixed draft</p>
            <CopyButton text={result.fixedText} label="Copy fixed label" />
          </div>
          <p className="whitespace-pre-wrap break-words rounded-xl border border-pass/50 bg-surface p-4 leading-8">
            {result.fixedText}
          </p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold">What changed</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {result.applied.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </div>

      {result.needsYou.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-medium">Still needs you</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {result.needsYou.map((f) => (
              <li key={`${f.ruleId}-${f.quotedText}`}>
                {f.ruleId} · {f.quotedText ? `“${f.quotedText}”: ` : ""}
                {f.advice ?? f.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted">
        AI-written rewrites are suggestions, and placeholders in [brackets] need your details. Check the fixed draft and
        have an expert review it before printing.
      </p>
      {onRecheck && (
        <button
          type="button"
          onClick={() => onRecheck(result.fixedText)}
          className="rounded-lg border border-ink px-4 py-2 text-sm font-semibold hover:bg-surface"
        >
          Check the fixed label
        </button>
      )}
    </section>
  );
}
