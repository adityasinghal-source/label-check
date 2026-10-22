"use client";

import { useState } from "react";
import ChannelMatrix from "@/components/ChannelMatrix";
import CopyButton from "@/components/CopyButton";
import FixAllPanel from "@/components/FixAllPanel";
import HighlightedLabel from "@/components/HighlightedLabel";
import RejectionCard from "@/components/RejectionCard";
import { card, chip, chipNeutral, chipUnverified, secondaryButton, sectionLabel, SEVERITY_CHIP } from "@/components/styles";
import { noIssuesHeading } from "@/lib/messages";
import { reportSummary } from "@/lib/reportSummary";
import { readiness } from "@/lib/summary";
import type { Explanation, Flag, Report as ReportData, VisualFindings } from "@/lib/types";

const TONE_STYLE = {
  red: "border-high/50 bg-high-soft text-high",
  amber: "border-medium/50 bg-medium-soft text-medium",
  green: "border-pass/50 bg-pass-soft text-pass",
};

// Briefly pulse an element so the eye finds where a click landed. It runs just after React re-renders
// the new selection, because that render rewrites the element's class list and would wipe the pulse.
function pulse(find: () => Element | null) {
  setTimeout(() => {
    const el = find();
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("pulse");
    void (el as HTMLElement).offsetWidth;
    el.classList.add("pulse");
    setTimeout(() => el.classList.remove("pulse"), 2000);
  }, 60);
}

function FlagCard({
  flag,
  id,
  selected,
  channelLabels,
  onSelect,
  onLocate,
}: {
  flag: Flag;
  id: string;
  selected: boolean;
  channelLabels: string[];
  onSelect: () => void;
  onLocate?: () => void;
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
          <span className={`${chip} ${chipNeutral}`}>Confirm</span>
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
        {!flag.verified && <span className={`${chip} ${chipUnverified}`}>Unverified</span>}
        {flag.fix?.type === "fill_in" && <span className={`${chip} ${chipNeutral}`}>Requires your input</span>}
        {channelLabels.length > 0 && <span className={`${chip} ${chipNeutral}`}>{channelLabels.join(", ")}</span>}
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
      {onLocate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLocate();
          }}
          className="mt-3 text-sm font-semibold text-brand underline underline-offset-2 print:hidden"
        >
          ↑ Locate in label
        </button>
      )}
    </li>
  );
}

const SEEN: { key: keyof VisualFindings; pattern: RegExp; label: string }[] = [
  { key: "vegMark", pattern: /veg/i, label: "veg / non-veg mark" },
  { key: "fssaiLogo", pattern: /fssai logo/i, label: "FSSAI logo" },
  { key: "barcode", pattern: /barcode/i, label: "barcode" },
];

function VisualChecklist({ items, visual }: { items: string[]; visual: VisualFindings | null }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <section className={`${card} p-4`} aria-labelledby="visual-checklist">
      <h3 id="visual-checklist" className="font-semibold">
        Visual print-readiness checklist
      </h3>
      <p className="mt-0.5 text-sm text-muted">
        Text can&apos;t show sizes, colours or placement. Check these on the final artwork
        {visual ? "; items your photo showed are marked." : ", or upload a photo to have symbols spotted."}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item, i) => {
          const seen = visual ? SEEN.find((s) => s.pattern.test(item) && visual[s.key]) : undefined;
          return (
            <li key={item} className="flex items-start gap-2">
              <input
                id={`visual-${i}`}
                type="checkbox"
                checked={!!done[i]}
                onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
              />
              <label htmlFor={`visual-${i}`}>
                {item}
                {seen && <span className={`${chip} ml-2 border border-pass bg-pass-soft text-pass`}>Seen in your photo: {seen.label}</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
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
    pulse(() => document.getElementById(cardId(i)));
  }

  function locate(i: number) {
    setSelected(i);
    pulse(() => document.querySelector(`#label-preview [data-flags~="${i}"]`));
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
    <div className="report-print space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Audit report</h2>
        <div className="flex flex-wrap gap-2 print:hidden">
          <CopyButton text={reportSummary(report, explanation)} label="Copy report summary" />
          <button type="button" onClick={() => window.print()} className={secondaryButton}>
            Export PDF
          </button>
        </div>
      </div>

      {explanation && <RejectionCard explanation={explanation} flags={report.flags} onSelect={select} />}

      <section className={`rounded-xl border p-5 ${TONE_STYLE[summary.tone]}`}>
        <p className="text-2xl font-bold">{summary.verdict}</p>
        <p className="mt-1 font-medium">{summary.counts}</p>
        <p className="mt-2 text-xs opacity-90">
          Checked against {report.packLabel} rule pack v{report.packVersion} · {report.category.label}
          {report.channels.length > 0 && ` · ${report.channels.map((c) => c.label).join(", ")}`}
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
          Your label{report.flags.some((f) => f.quotedText) && ": hover or click a highlighted phrase to see its rule and fix"}
        </p>
        <HighlightedLabel id="label-preview" text={report.labelText} flags={report.flags} selected={selected} onSelect={select} />
      </section>

      {labelFlags > 0 && (
        <div className="print:hidden">
          <FixAllPanel key={report.labelText + report.channels.map((c) => c.id).join()} report={report} onRecheck={onRecheck} />
        </div>
      )}

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
              onLocate={flag.quotedText ? () => locate(i) : undefined}
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

      <VisualChecklist items={report.visualChecklist} visual={report.visual} />

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

      <p className="hidden text-xs print:block">A screening aid, not legal advice. ShelfReady never says a label is compliant.</p>
    </div>
  );
}
