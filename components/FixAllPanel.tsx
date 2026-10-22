"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import HighlightedLabel from "@/components/HighlightedLabel";
import { sectionLabel } from "@/components/styles";
import { factFields, factProblem, fillFacts } from "@/lib/fillIn";
import { fixAll } from "@/lib/fixAll";
import type { Report } from "@/lib/types";
import { wordDiff, type DiffPart } from "@/lib/wordDiff";

const DIFF_STYLE = {
  same: "",
  removed: "rounded bg-high-soft text-high line-through decoration-high",
  added: "rounded bg-pass-soft text-pass font-semibold",
};

function DiffText({ parts, className }: { parts: DiffPart[]; className: string }) {
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.change === "same" ? (
          <span key={i}>{part.text}</span>
        ) : part.change === "removed" ? (
          <del key={i} className={DIFF_STYLE.removed}>
            {part.text}
          </del>
        ) : (
          <ins key={i} className={`no-underline ${DIFF_STYLE.added}`}>
            {part.text}
          </ins>
        ),
      )}
    </p>
  );
}

// One click applies every suggested fix and shows the corrected label next to the original.
// Facts only the brand knows (licence number, MRP…) are typed into a small form, never invented.
export default function FixAllPanel({ report, onRecheck }: { report: Report; onRecheck?: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showChanges, setShowChanges] = useState(true);
  const options = { needsCentral: report.market === "india" && report.category.id === "imported" };
  const result = fixAll(report.labelText, report.flags, report.allergenStatement);
  const fields = factFields(result.fixedText);
  const filled = fillFacts(result.fixedText, fields, values, options);
  const stillEmpty = fields.filter((f) => !(values[f.token] ?? "").trim() || factProblem(f, values[f.token], options)).length;
  const nothingToFix = result.applied.length === 0 && fields.length === 0;

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

  const diff = showChanges ? wordDiff(report.labelText, filled) : null;
  const boxClass = "whitespace-pre-wrap break-words rounded-xl border bg-surface p-4 leading-8";

  return (
    <section id="fix-all" className="space-y-4 rounded-xl border border-pass/40 bg-pass-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Before and after</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showChanges}
            onChange={(e) => setShowChanges(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          Highlight changes
        </label>
      </div>

      {fields.length > 0 && (
        <fieldset className="rounded-lg border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-semibold">Fill missing label facts</legend>
          <p className="text-xs text-muted">
            Only you know these. Anything left empty stays a placeholder, and the next check flags it.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {fields.map((field) => {
              const id = `fact-${field.token.replace(/\W+/g, "-")}`;
              const problem = factProblem(field, values[field.token] ?? "", options);
              return (
                <div key={field.token}>
                  <label htmlFor={id} className="block text-xs font-semibold">
                    {field.label.charAt(0).toUpperCase() + field.label.slice(1)}
                  </label>
                  <input
                    id={id}
                    value={values[field.token] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.token]: e.target.value }))}
                    inputMode={field.kind === "fssai" || field.kind === "barcode" ? "numeric" : field.kind === "phone" ? "tel" : field.kind === "email" ? "email" : "text"}
                    aria-invalid={!!problem}
                    aria-describedby={problem ? `${id}-error` : undefined}
                    className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  {problem && (
                    <p id={`${id}-error`} className="mt-1 text-xs font-medium text-high">
                      {problem}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <p className={`mb-1 ${sectionLabel}`}>Your draft</p>
          {diff ? (
            <DiffText parts={diff.before} className={`${boxClass} border-line`} />
          ) : (
            <HighlightedLabel text={report.labelText} flags={report.flags} />
          )}
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className={sectionLabel}>Fixed draft</p>
            <CopyButton text={filled} label="Copy fixed label" />
          </div>
          {diff ? (
            <DiffText parts={diff.after} className={`${boxClass} border-pass/50`} />
          ) : (
            <p className={`${boxClass} border-pass/50`}>{filled}</p>
          )}
        </div>
      </div>

      {result.applied.length > 0 && (
        <div>
          <p className="text-sm font-semibold">What changed</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {result.applied.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      )}

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

      {stillEmpty > 0 && (
        <p className="rounded-lg border border-medium/40 bg-medium-soft p-2.5 text-sm text-medium" role="status">
          {stillEmpty} label fact{stillEmpty > 1 ? "s are" : " is"} still empty, so the next check will flag {stillEmpty > 1 ? "them" : "it"} as a placeholder.
        </p>
      )}
      <p className="text-xs text-muted">
        AI-written rewrites are suggestions. Check the fixed draft and have an expert review it before printing.
      </p>
      {onRecheck && (
        <button
          type="button"
          onClick={() => onRecheck(filled)}
          className="rounded-lg border border-ink px-4 py-2 text-sm font-semibold hover:bg-surface"
        >
          Check the fixed label
        </button>
      )}
    </section>
  );
}
