"use client";

import CopyButton from "@/components/CopyButton";
import type { Explanation } from "@/lib/types";

export default function ExplanationCard({ explanation, packLabel }: { explanation: Explanation; packLabel: string }) {
  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <div>
        <p className="text-xs font-semibold uppercase text-gray-600">Likely cause</p>
        <p className="mt-1 text-lg">{explanation.likelyCause}</p>
      </div>

      <div className="text-sm">
        <p className="text-xs font-semibold uppercase text-gray-600">Matching rule in {packLabel}</p>
        {explanation.ruleId ? (
          <p className="mt-1">
            <span className="font-mono">{explanation.ruleId}</span> · {explanation.ruleName}
            <span className="block text-xs text-gray-500">{explanation.citation}</span>
          </p>
        ) : (
          <p className="mt-1 text-gray-600">No rule in this pack matches. Treat the cause as a best guess.</p>
        )}
      </div>

      {explanation.evidenceQuote && (
        <div className="text-sm">
          <p className="text-xs font-semibold uppercase text-gray-600">Likely trigger on your label</p>
          <p className="mt-1">
            <span className="rounded bg-red-100 px-1 underline decoration-red-500 decoration-2 underline-offset-4">
              “{explanation.evidenceQuote}”
            </span>
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase text-gray-600">How to fix it</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
          {explanation.fixSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {explanation.appealNote && (
        <div className="rounded bg-green-50 p-3">
          <p className="text-xs font-semibold text-green-900">Note to send with your resubmission (AI-written, check before sending)</p>
          <div className="mt-1 flex items-start gap-3">
            <p className="flex-1 text-sm">{explanation.appealNote}</p>
            <CopyButton text={explanation.appealNote} />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Found by: AI. Rejection messages are often vague, so this is the most likely cause, not a certainty. Confirm with
        the channel before relying on it.
      </p>
    </section>
  );
}
