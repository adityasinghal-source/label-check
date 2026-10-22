"use client";

import { useState } from "react";
import { noIssuesHeading } from "@/lib/messages";
import type { Flag, Report as ReportData } from "@/lib/types";

const SEVERITY_STYLE = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-gray-100 text-gray-700",
};

function FlagCard({ flag }: { flag: Flag }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(flag.suggestedRewrite);
      ok = true;
    } catch {
      // Some browsers block the clipboard API; fall back to the older copy command.
      const box = document.createElement("textarea");
      box.value = flag.suggestedRewrite;
      document.body.appendChild(box);
      box.select();
      ok = document.execCommand("copy");
      box.remove();
    }
    setCopyState(ok ? "copied" : "failed");
    setTimeout(() => setCopyState("idle"), 2500);
  }

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-semibold uppercase ${SEVERITY_STYLE[flag.severity]}`}>
          {flag.severity}
        </span>
        <span className="font-mono text-gray-700">{flag.ruleId}</span>
        <span className="text-gray-700">{flag.ruleName}</span>
        <span className="ml-auto rounded bg-gray-100 px-2 py-0.5 text-gray-600">
          Found by: {flag.foundBy === "ai" ? "AI" : "rule check"}
        </span>
      </div>
      <p className="mt-3 text-lg">“{flag.quotedText}”</p>
      <p className="mt-1 text-sm text-gray-700">{flag.explanation}</p>
      <p className="mt-1 text-xs text-gray-500">{flag.citation}</p>
      {flag.suggestedRewrite && (
        <div className="mt-3 rounded bg-green-50 p-3">
          <p className="text-xs font-semibold text-green-900">
            Suggested rewrite {flag.foundBy === "ai" && "(AI-written, check before using)"}
          </p>
          <div className="mt-1 flex items-start gap-3">
            <p className="flex-1 text-sm">{flag.suggestedRewrite}</p>
            <button onClick={copy} className="rounded border border-green-700 px-2 py-1 text-xs text-green-800 hover:bg-green-100">
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Blocked: select the text" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Report({ report }: { report: ReportData }) {
  const noIssues = report.ruleStatuses.filter((r) => r.status === "no_issues");
  const notChecked = report.ruleStatuses.filter((r) => r.status === "not_checked");

  return (
    <section className="mt-8 space-y-6">
      <h2 className="text-lg font-semibold">
        Checked against {report.packLabel} rule pack v{report.packVersion}
      </h2>

      {report.flags.length > 0 && (
        <ul className="space-y-3">
          {report.flags.map((flag) => (
            <FlagCard key={`${flag.ruleId}-${flag.quotedText}`} flag={flag} />
          ))}
        </ul>
      )}

      {report.droppedAiFlags > 0 && (
        <p className="text-sm text-gray-600">
          {report.droppedAiFlags} AI suggestion{report.droppedAiFlags > 1 ? "s were" : " was"} removed because it
          didn&apos;t cite a valid rule or quote your text.
        </p>
      )}

      {noIssues.length > 0 && (
        <div>
          <h3 className="font-semibold">{noIssuesHeading(report.packVersion)}</h3>
          <ul className="mt-1 text-sm text-gray-700">
            {noIssues.map((r) => (
              <li key={r.ruleId}>
                <span className="font-mono">{r.ruleId}</span> · {r.ruleName}
                {r.note && `: ${r.note}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notChecked.length > 0 && (
        <div>
          <h3 className="font-semibold">Not checked</h3>
          <ul className="mt-1 text-sm text-gray-700">
            {notChecked.map((r) => (
              <li key={r.ruleId}>
                <span className="font-mono">{r.ruleId}</span> · {r.ruleName}: {r.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
