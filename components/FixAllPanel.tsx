"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import HighlightedLabel from "@/components/HighlightedLabel";
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
        onClick={() => setOpen(true)}
        disabled={nothingToFix}
        className="rounded-lg bg-green-700 px-4 py-2 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
      >
        {nothingToFix ? "Nothing to fix automatically" : "Fix all"}
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4">
      <h3 className="font-semibold">Before and after</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-600">Your draft</p>
          <HighlightedLabel text={report.labelText} flags={report.flags} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-gray-600">Fixed draft</p>
            <CopyButton text={result.fixedText} label="Copy fixed label" />
          </div>
          <p className="whitespace-pre-wrap rounded-lg border border-green-300 bg-white p-4 leading-8">{result.fixedText}</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold">What changed</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-800">
          {result.applied.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </div>

      {result.needsYou.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-amber-900">Still needs you</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {result.needsYou.map((f) => (
              <li key={`${f.ruleId}-${f.quotedText}`}>
                {f.ruleId} · {f.quotedText ? `“${f.quotedText}”: ` : ""}
                {f.advice ?? f.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-600">
        AI-written rewrites are suggestions. Check the fixed draft, and have an expert review it before printing.
      </p>
      {onRecheck && (
        <button
          onClick={() => onRecheck(result.fixedText)}
          className="rounded-lg border border-gray-900 px-4 py-2 text-sm font-semibold hover:bg-white"
        >
          Check the fixed label
        </button>
      )}
    </section>
  );
}
