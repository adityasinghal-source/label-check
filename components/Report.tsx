"use client";

import { useState } from "react";
import ChannelMatrix from "@/components/ChannelMatrix";
import CopyButton from "@/components/CopyButton";
import FixAllPanel from "@/components/FixAllPanel";
import HighlightedLabel from "@/components/HighlightedLabel";
import RejectionCard from "@/components/RejectionCard";
import { card, chip, sectionLabel, SEVERITY_CHIP } from "@/components/styles";
import { noIssuesHeading } from "@/lib/messages";
import { readiness } from "@/lib/summary";
import type { Explanation, Flag, Report as ReportData } from "@/lib/types";

const TONE_STYLE = {
  red: "border-high/40 bg-high-soft text-high",
  amber: "border-medium/40 bg-medium-soft text-medium",
  green: "border-pass/40 bg-pass-soft text-pass",
};

function FlagCard({
  flag,
  id,
  selected,
  channelLabels,
  onSelect,
}: {
  flag: Flag;
  id: string;
  selected: boolean;
  channelLabels: string[];
  onSelect: () => void;
}) {
  const fixLabel =
    flag.fix?.type === "allergen_statement"
      ? "Add this allergen line"
      : flag.foundBy === "ai"
        ? "Suggested rewrite (AI-written, check before using)"
        : "Suggested rewrite";

  return (
    <li
      id={id}
      onClick={onSelect}
      className={`scroll-mt-6 rounded-xl border bg-surface p-4 ${selected ? "border-ink ring-2 ring-ink" : "border-line"}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {flag.confirmOnly ? (
          <span className={`${chip} bg-raised text-muted`}>Confirm</span>
        ) : (
          <span className={`${chip} uppercase ${SEVERITY_CHIP[flag.severity]}`}>{flag.severity}</span>
        )}
        <a
          href={flag.source.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
          title={`Source: ${flag.source.label}`}
        >
          {flag.ruleId} ↗
        </a>
        <span className="text-muted">{flag.ruleName}</span>
        {!flag.verified && <span className={`${chip} border border-medium/50 text-medium`}>Unverified</span>}
        {channelLabels.length > 0 && <span className={`${chip} bg-raised text-muted`}>{channelLabels.join(", ")}</span>}
        <span className="ml-auto text-muted">Found by: {flag.foundBy === "ai" ? "AI" : "rule check"}</span>
      </div>
      <p className="mt-3 text-lg">{flag.quotedText ? `“${flag.quotedText}”` : flag.confirmOnly ? "Confirm before listing" : "Missing from the label"}</p>
      <p className="mt-1 text-sm">{flag.explanation}</p>
      <p className="mt-1 text-xs text-muted">
        {flag.citation}. Source:{" "}
        <a href={flag.source.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline">
          {flag.source.label}
        </a>
      </p>
      {flag.suggestedRewrite ? (
        <div className="mt-3 rounded-lg bg-pass-soft p-3">
          <p className="text-xs font-semibold text-pass">{fixLabel}</p>
          <div className="mt-1 flex items-start gap-3">
            <p className="flex-1 text-sm">{flag.suggestedRewrite}</p>
            <CopyButton text={flag.suggestedRewrite} />
          </div>
        </div>
      ) : (
        flag.advice && (
          <div className="mt-3 rounded-lg bg-raised p-3">
            <p className="text-xs font-semibold text-muted">What to do</p>
            <p className="mt-1 text-sm">{flag.advice}</p>
          </div>
        )
      )}
    </li>
  );
}

export default function Report({
  report,
  explanation,
  onRecheck,
}: {
  report: ReportData | null;
  explanation: Explanation | null;
  onRecheck?: (text: string) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const cardId = (i: number) => `flag-${i}`;

  function select(i: number) {
    setSelected(i);
    document.getElementById(cardId(i))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!report) {
    return explanation ? <RejectionCard explanation={explanation} flags={null} onSelect={select} /> : null;
  }

  const summary = readiness(report.flags, report.packVersion);
  const labelFlags = report.flags.filter((f) => !f.confirmOnly).length;
  const noIssues = report.ruleStatuses.filter((r) => r.status === "no_issues");
  const notChecked = report.ruleStatuses.filter((r) => r.status === "not_checked");
  const allergensChecked = !notChecked.some((r) => r.note === "No ingredient list found");
  const channelNames = new Map(report.channels.map((c) => [c.id, c.label]));

  return (
    <div className="space-y-5">
      {explanation && <RejectionCard explanation={explanation} flags={report.flags} onSelect={select} />}

      <section className={`rounded-xl border p-5 ${TONE_STYLE[summary.tone]}`}>
        <p className="text-2xl font-bold">{summary.verdict}</p>
        <p className="mt-1 font-medium">{summary.counts}</p>
        <p className="mt-2 text-xs opacity-80">
          Checked against {report.packLabel} rule pack v{report.packVersion}
          {report.channels.length > 0 && ` + ${report.channels.map((c) => c.label).join(", ")}`}
        </p>
      </section>

      {report.channels.length > 0 && <ChannelMatrix report={report} onSelect={select} />}

      {allergensChecked && (
        <section className={`${card} p-4`}>
          <p className={sectionLabel}>Allergen statement for your pack</p>
          {report.allergenStatement ? (
            <div className="mt-1 flex items-start gap-3">
              <p className="flex-1 text-lg font-semibold">{report.allergenStatement}</p>
              <CopyButton text={report.allergenStatement} />
            </div>
          ) : (
            <p className="mt-1 text-sm">No major allergens found in the ingredient list.</p>
          )}
          <p className="mt-1 text-xs text-muted">Generated by rule check from your ingredient list.</p>
        </section>
      )}

      <section>
        <p className={`mb-1 ${sectionLabel}`}>
          Your label{report.flags.some((f) => f.quotedText) && ": click a highlighted phrase to see its rule and fix"}
        </p>
        <HighlightedLabel text={report.labelText} flags={report.flags} selected={selected} onSelect={select} />
      </section>

      {labelFlags > 0 && <FixAllPanel key={report.labelText + report.channels.map((c) => c.id).join()} report={report} onRecheck={onRecheck} />}

      {report.flags.length > 0 && (
        <ul className="space-y-3">
          {report.flags.map((flag, i) => (
            <FlagCard
              key={`${flag.ruleId}-${flag.quotedText}-${i}`}
              flag={flag}
              id={cardId(i)}
              selected={selected === i}
              channelLabels={flag.channels.map((id) => channelNames.get(id) ?? id)}
              onSelect={() => setSelected(i)}
            />
          ))}
        </ul>
      )}

      {report.droppedAiFlags > 0 && (
        <p className="text-sm text-muted">
          {report.droppedAiFlags} AI suggestion{report.droppedAiFlags > 1 ? "s were" : " was"} removed because it
          didn&apos;t cite a valid rule or quote your text.
        </p>
      )}

      {noIssues.length > 0 && (
        <section>
          <h3 className="font-semibold">{noIssuesHeading(report.packVersion)}</h3>
          <ul className="mt-1 text-sm text-muted">
            {noIssues.map((r) => (
              <li key={r.ruleId}>
                <span className="font-mono">{r.ruleId}</span> · {r.ruleName}
                {r.note && `: ${r.note}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {notChecked.length > 0 && (
        <section>
          <h3 className="font-semibold">Not checked</h3>
          <ul className="mt-1 text-sm text-muted">
            {notChecked.map((r) => (
              <li key={r.ruleId}>
                <span className="font-mono">{r.ruleId}</span> · {r.ruleName}: {r.note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
