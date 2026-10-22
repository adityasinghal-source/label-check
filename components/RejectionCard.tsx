"use client";

import CopyButton from "@/components/CopyButton";
import { card, chip, chipUnverified, sectionLabel } from "@/components/styles";
import { findRule } from "@/lib/rulepacks";
import type { Explanation, Flag } from "@/lib/types";

// The flags that probably caused a rejection: those the explainer named, or that cover its quote.
export function linkedFlagIndexes(explanation: Explanation, flags: Flag[]): number[] {
  const quote = explanation.evidenceQuote?.toLowerCase();
  return flags
    .map((f, i) => ({ f, i }))
    .filter(
      ({ f }) =>
        !f.confirmOnly &&
        (explanation.ruleIds.includes(f.ruleId) ||
          (quote && f.quotedText && (quote.includes(f.quotedText.toLowerCase()) || f.quotedText.toLowerCase().includes(quote)))),
    )
    .map(({ i }) => i);
}

export default function RejectionCard({
  explanation,
  flags,
  onSelect,
}: {
  explanation: Explanation;
  flags: Flag[] | null;
  onSelect: (index: number) => void;
}) {
  const linked = flags ? linkedFlagIndexes(explanation, flags) : [];

  return (
    <section className={`${card} border-l-4 border-l-high p-5`}>
      <p className={sectionLabel}>Likely reason for rejection</p>
      <p className="mt-1 text-lg">{explanation.likelyCause}</p>

      {flags && linked.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Probably caused by these flags</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {linked.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className="rounded-lg border border-line bg-raised px-2.5 py-1 text-left text-sm hover:border-ink"
                >
                  <span className="font-mono text-xs">{flags[i].ruleId}</span> {flags[i].ruleName}
                  {flags[i].quotedText && <span className="text-muted">: “{flags[i].quotedText}”</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!flags && explanation.ruleIds.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Rules it most likely relates to</p>
          <ul className="mt-1 space-y-1 text-sm">
            {explanation.ruleIds.map((id) => {
              const rule = findRule(id);
              return (
                <li key={id}>
                  <span className="font-mono text-xs">{id}</span> {rule?.name}
                  {rule && !rule.verified && <span className={`${chip} ml-2 ${chipUnverified}`}>Unverified</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {explanation.evidenceQuote && (
        <p className="mt-4 text-sm">
          <span className="font-semibold">Likely trigger on your label: </span>
          <span className="rounded bg-high-soft px-1 underline decoration-high decoration-2 underline-offset-4">
            “{explanation.evidenceQuote}”
          </span>
        </p>
      )}

      <div className="mt-4">
        <p className="text-sm font-semibold">How to fix it</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
          {explanation.fixSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {explanation.appealNote && (
        <div className="mt-4 rounded-lg bg-raised p-3">
          <p className="text-xs font-semibold text-muted">Note to send with your resubmission (AI-written, check before sending)</p>
          <div className="mt-1 flex items-start gap-3">
            <p className="flex-1 text-sm">{explanation.appealNote}</p>
            <CopyButton text={explanation.appealNote} />
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        Found by: AI. Rejection messages are often vague, so this is the most likely cause, not a certainty.
      </p>
    </section>
  );
}
