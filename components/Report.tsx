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
import type { PrintSizes } from "@/lib/pdp";
import type { Explanation, Flag, Report as ReportData, VisualFindings } from "@/lib/types";
import ArtworkPreview, { type Artwork } from "@/components/ArtworkPreview";
import ListingCard from "@/components/ListingCard";
import ShareButton from "@/components/ShareButton";

type Filter = "all" | "high" | "medium" | "low" | "code" | "ai";
const FILTERS: { id: Filter; label: string; test: (f: Flag) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "high", label: "High risk", test: (f) => f.severity === "high" },
  { id: "medium", label: "Medium", test: (f) => f.severity === "medium" },
  { id: "low", label: "Low", test: (f) => f.severity === "low" },
  { id: "code", label: "Rule check", test: (f) => f.foundBy === "code" },
  { id: "ai", label: "AI check", test: (f) => f.foundBy === "ai" },
];

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
  hidden,
  channelLabels,
  applied,
  onSelect,
  onLocate,
  onApply,
}: {
  flag: Flag;
  id: string;
  selected: boolean;
  hidden: boolean;
  channelLabels: string[];
  applied: boolean;
  onSelect: () => void;
  onLocate?: () => void;
  onApply?: () => void;
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
      hidden={hidden}
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
          <div className="mt-1 flex flex-wrap items-start gap-2">
            <p className="min-w-0 flex-1 basis-48 text-sm">{flag.suggestedRewrite}</p>
            <div className="flex gap-2">
              <CopyButton text={flag.suggestedRewrite} />
              {onApply && (
                <button
                  type="button"
                  disabled={applied}
                  onClick={(e) => {
                    e.stopPropagation();
                    onApply();
                  }}
                  className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold print:hidden ${
                    applied ? "border-pass bg-pass-soft text-pass" : "border-ink bg-surface text-ink hover:bg-raised"
                  }`}
                >
                  <span aria-live="polite">{applied ? "✓ Applied to draft" : "Apply to draft"}</span>
                </button>
              )}
            </div>
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

function PrintSizesList({ sizes }: { sizes: PrintSizes | null }) {
  if (!sizes) {
    return (
      <p className="mt-3 rounded-lg bg-raised p-3 text-sm">
        Add your pack dimensions under <span className="font-semibold">Pack dimensions &amp; font calculator</span> to get the exact minimum print sizes.
      </p>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-line bg-raised p-3">
      <p className="text-sm font-semibold">
        Principal display panel: {sizes.area.toLocaleString()} {sizes.areaUnit}{" "}
        <span className="font-normal text-muted">({sizes.areaNote})</span>
      </p>
      <ul className="mt-2 space-y-2 text-sm">
        {sizes.specs.map((spec) => (
          <li key={spec.item}>
            <span className="font-semibold">{spec.item}:</span> {spec.minimum}
            {!spec.verified && <span className={`${chip} ${chipUnverified} ml-2`}>Unverified</span>}
            <span className="block text-xs text-muted">
              {spec.citation}.{" "}
              <a href={spec.source.url} target="_blank" rel="noreferrer" className="underline">
                {spec.source.label}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VisualChecklist({ report }: { report: ReportData }) {
  const { visualChecklist: items, visual, printSizes, barcodes } = report;
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
      <PrintSizesList sizes={printSizes} />
      {barcodes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {barcodes.map((b) => (
            <li key={b.code}>
              <span className="font-semibold">
                Barcode {b.code} ({b.format}):
              </span>{" "}
              {b.valid ? (
                <span className="text-pass">✓ check digit correct</span>
              ) : (
                <span className="font-semibold text-high">check digit wrong (should end in {b.expected})</span>
              )}{" "}
              · {b.prefix}
            </li>
          ))}
        </ul>
      )}
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
  artwork,
  onRecheck,
  onApply,
  onShare,
}: {
  report: ReportData | null;
  explanation: Explanation | null;
  artwork?: Artwork | null;
  onRecheck?: (text: string) => void;
  // Applies one flag's fix to the label being edited; false when the phrase is no longer there.
  onApply?: (flag: Flag) => boolean;
  // Builds a link that re-runs this check.
  onShare?: () => Promise<string | null>;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [applied, setApplied] = useState<Set<number>>(() => new Set());
  const [applyMiss, setApplyMiss] = useState<number | null>(null);
  const cardId = (i: number) => `flag-${i}`;

  function select(i: number) {
    setSelected(i);
    // A card hidden by a filter pill can't be shown, so jumping to it clears the filter.
    if (report && !FILTERS.find((f) => f.id === filter)!.test(report.flags[i])) setFilter("all");
    pulse(() => document.getElementById(cardId(i)));
  }

  function apply(i: number, flag: Flag) {
    if (onApply?.(flag)) {
      setApplied((s) => new Set(s).add(i));
      setApplyMiss(null);
    } else {
      setApplyMiss(i);
    }
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
          {onShare && <ShareButton onShare={onShare} />}
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

      <ListingCard report={report} />

      {artwork && <ArtworkPreview artwork={artwork} report={report} onSelect={select} />}

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
        <section aria-label="Rule cards" className="space-y-3">
          <div className="flex flex-wrap gap-2 print:hidden" role="group" aria-label="Filter rule cards">
            {FILTERS.map((f) => {
              const count = report.flags.filter(f.test).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  disabled={count === 0 && f.id !== "all"}
                  className={`rounded-full border px-3 py-1 text-sm font-semibold disabled:opacity-40 ${
                    filter === f.id ? "border-ink bg-ink text-page" : "border-line bg-surface text-ink hover:bg-raised"
                  }`}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>
          {applied.size > 0 && (
            <p className="rounded-lg border border-pass/50 bg-pass-soft p-2.5 text-sm text-pass print:hidden" role="status">
              {applied.size} fix{applied.size > 1 ? "es" : ""} applied to your draft on the left. Click Check to re-run the audit.
            </p>
          )}
          {applyMiss !== null && (
            <p className="rounded-lg border border-medium/50 bg-medium-soft p-2.5 text-sm text-medium print:hidden" role="alert">
              That phrase is no longer in your draft, so the fix couldn&apos;t be applied. Click Check to refresh the report.
            </p>
          )}
          <ul className="space-y-3">
            {report.flags.map((flag, i) => (
              <FlagCard
                key={`${flag.ruleId}-${flag.quotedText}-${i}`}
                flag={flag}
                id={cardId(i)}
                selected={selected === i}
                hidden={!FILTERS.find((f) => f.id === filter)!.test(flag)}
                applied={applied.has(i)}
                channelLabels={flag.channels.map((id) => channelNames.get(id) ?? id)}
                onSelect={() => setSelected(i)}
                onLocate={flag.quotedText ? () => locate(i) : undefined}
                onApply={onApply && flag.suggestedRewrite && !flag.confirmOnly ? () => apply(i, flag) : undefined}
              />
            ))}
          </ul>
        </section>
      )}

      {report.droppedAiFlags > 0 && (
        <p className="text-sm text-muted">
          {report.droppedAiFlags} AI suggestion{report.droppedAiFlags > 1 ? "s were" : " was"} removed because it
          didn&apos;t cite a valid rule or quote your text.
        </p>
      )}

      <VisualChecklist report={report} />

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
