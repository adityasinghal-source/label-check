"use client";

import Report from "@/components/Report";
import { onlyIn } from "@/lib/compare";
import type { Flag, Report as ReportData } from "@/lib/types";

function OnlyList({ title, flags }: { title: string; flags: Flag[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="font-semibold">{title}</p>
      {flags.length === 0 ? (
        <p className="mt-1 text-sm text-gray-600">Nothing extra.</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {flags.map((f, i) => (
            <li key={`${f.ruleId}-${i}`}>
              <span className="font-mono text-xs">{f.ruleId}</span> {f.ruleName}
              {f.quotedText && `: “${f.quotedText}”`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The same label checked against two markets, with what each one needs on top.
export default function CompareView({ left, right }: { left: ReportData; right: ReportData }) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">What has to change for each market</h2>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <OnlyList title={`Only for ${left.packLabel}`} flags={onlyIn(left, right)} />
          <OnlyList title={`Only for ${right.packLabel}`} flags={onlyIn(right, left)} />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Report report={left} compact />
        <Report report={right} compact />
      </div>
    </section>
  );
}
