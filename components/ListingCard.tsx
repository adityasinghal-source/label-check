"use client";

import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { card, chip, chipNeutral, sectionLabel } from "@/components/styles";
import { flaggedClaims, listingAttributes, listingCsv, listingJson, listingText } from "@/lib/listing";
import { MESSAGES } from "@/lib/messages";
import { allRules, getCategory, getChannels, getMarket } from "@/lib/rulepacks";
import type { ListingResponse, Report } from "@/lib/types";

type Copy = { title: string; highlights: string[] };

// Ready-to-paste catalogue copy for marketplace and quick-commerce onboarding. The attributes are read from
// the label by code; the title and highlights are AI-written, with flagged claims removed by code.
export default function ListingCard({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<Copy | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const attributes = listingAttributes(report);
  const missing = attributes.filter((a) => !a.value).length;

  async function generate() {
    setState("loading");
    const market = getMarket(report.market);
    const rules = market
      ? allRules(market, getChannels(report.market, report.channels.map((c) => c.id)), getCategory(report.category.id), report.packType)
      : [];
    const avoidWords = rules.flatMap((r) => (r.match?.when === "present" ? (r.match.words ?? []) : []));
    try {
      const res = await fetch("/api/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labelText: report.labelText,
          market: report.market,
          productName: report.productName,
          flaggedClaims: flaggedClaims(report),
          avoidWords,
        }),
      });
      const body = (await res.json()) as ListingResponse;
      if (body.status === "ok") {
        setCopy({ title: body.title, highlights: body.highlights });
        setState("idle");
      } else {
        setError(body.message);
        setState("error");
      }
    } catch {
      setError(MESSAGES.checkerFailed);
      setState("error");
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !copy && state !== "loading") generate();
  }

  const title = copy?.title ?? report.productName;
  const highlights = copy?.highlights ?? [];

  return (
    <section className={`${card} print:hidden`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="listing-pack"
        onClick={toggle}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>
          <path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="flex-1">
          <span className="block font-semibold">E-commerce catalog listing pack</span>
          <span className="block text-sm text-muted">Title, highlights and onboarding attributes, with flagged claims left out</span>
        </span>
      </button>
      <div id="listing-pack" hidden={!open} className="space-y-4 border-t border-line p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className={sectionLabel}>Product title</p>
            <span className={`${chip} ${chipNeutral}`}>AI-written, check before using</span>
          </div>
          {state === "loading" ? (
            <p className="mt-1 text-sm text-muted" role="status">
              Writing the title and highlights…
            </p>
          ) : state === "error" ? (
            <p className="mt-1 text-sm text-high" role="alert">
              {error}{" "}
              <button type="button" onClick={generate} className="font-semibold underline">
                Try again
              </button>
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold">{title || "No product name found on the label"}</p>
          )}
        </div>

        {highlights.length > 0 && (
          <div>
            <p className={sectionLabel}>Key highlights</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className={sectionLabel}>Mandatory attributes · read from your label by rule check</p>
          <dl className="mt-1 grid gap-x-4 text-sm sm:grid-cols-[max-content_1fr]">
            {attributes.map((a) => (
              <div key={a.key} className="contents">
                <dt className="pt-1.5 font-medium">{a.label}</dt>
                <dd className={`border-b border-line pb-1.5 sm:pt-1.5 ${a.value ? "" : "font-medium text-high"}`}>{a.value ?? "Not on the label yet"}</dd>
              </div>
            ))}
          </dl>
          {missing > 0 && (
            <p className="mt-2 text-xs text-muted">
              {missing} attribute{missing > 1 ? "s are" : " is"} missing. Most channels reject a listing without them.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <CopyButton text={listingJson(title, highlights, attributes)} label="Copy JSON" />
          <CopyButton text={listingCsv(title, highlights, attributes)} label="Copy CSV for catalog upload" />
          <CopyButton text={listingText(title, highlights, attributes)} label="Copy text" />
        </div>
      </div>
    </section>
  );
}
