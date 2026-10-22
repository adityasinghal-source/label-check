"use client";

import { useEffect, useState } from "react";
import Report from "@/components/Report";
import { card } from "@/components/styles";
import { MESSAGES } from "@/lib/messages";
import { CHANNELS, MARKETS } from "@/lib/rulepacks";
import type { CheckResponse, Explanation, ReadImageResponse, Report as ReportData } from "@/lib/types";

type Example = { title: string; detail: string; text: string; market: string; channels: string[]; rejection?: string };

const GRANOLA =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";

const EXAMPLES: Example[] = [
  {
    title: "Protein bar with a disease claim",
    detail: "US · FDA",
    text: "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds",
    market: "us",
    channels: [],
  },
  { title: "Granola bites on Amazon", detail: "US · FDA + Amazon", text: GRANOLA, market: "us", channels: ["amazon-us"] },
  {
    title: "Granola bites rejected by Blinkit",
    detail: "India · Blinkit · with a rejection",
    text: GRANOLA,
    market: "india",
    channels: ["blinkit"],
    rejection: "Listing rejected: label information incomplete",
  },
  {
    title: "Makhana across Indian channels",
    detail: "India · all 7 channels",
    text: "Masala makhana. Veg. Net quantity: 80 g. MRP ₹99 (incl. of all taxes). Best before 2 months from manufacture.\nIngredients: fox nuts, rice bran oil, spices, salt.\nManufactured by: Good Snacks Pvt Ltd, Pune. FSSAI Lic. No. 11523999000123",
    market: "india",
    channels: CHANNELS.filter((c) => c.market === "india").map((c) => c.id),
  },
];

type Result = { report: ReportData | null; explanation: Explanation | null; notice?: string };
type Problem = { kind: "input" | "error"; text: string };

async function request<T>(url: string, init: RequestInit): Promise<T | { status: "error"; message: string }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch {
    return { status: "error", message: MESSAGES.checkerFailed };
  }
}

function LoadingState({ steps }: { steps: string[] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1100);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className={`${card} p-6`} role="status" aria-live="polite">
      <p className="font-semibold">Checking your label…</p>
      <ol className="mt-4 space-y-2 text-sm">
        {steps.map((label, i) => (
          <li key={label} className={`flex items-center gap-2 ${i > step ? "text-muted" : ""}`}>
            {i < step ? (
              <span className="text-pass" aria-hidden>✓</span>
            ) : i === step ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden />
            ) : (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-line" aria-hidden />
            )}
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmptyState({ onExample }: { onExample: (e: Example) => void }) {
  return (
    <div className={`${card} p-6`}>
      <p className="text-lg font-semibold">Your report will appear here</p>
      <p className="mt-1 text-sm text-muted">
        Paste your label on the left, pick where you sell, and click Check. Or try one of these:
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <li key={example.title}>
            <button
              type="button"
              onClick={() => onExample(example)}
              className="h-full w-full rounded-lg border border-line bg-raised p-3 text-left hover:border-ink"
            >
              <span className="block font-medium">{example.title}</span>
              <span className="block text-xs text-muted">{example.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const [market, setMarket] = useState("us");
  const [channels, setChannels] = useState<string[]>([]);
  const [rejection, setRejection] = useState("");
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [busy, setBusy] = useState<"check" | "image" | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // Wake the API routes while the user is still typing, so the first check is fast.
  useEffect(() => {
    for (const route of ["/api/check", "/api/read-image"]) fetch(route).catch(() => {});
  }, []);

  const marketChannels = CHANNELS.filter((c) => c.market === market);
  const selectedLabels = marketChannels.filter((c) => channels.includes(c.id)).map((c) => c.label);

  const loadingSteps = [
    ...(text.trim() ? ["Reading your label", "Checking claims with AI", "Checking allergens and label declarations"] : []),
    ...(text.trim() && selectedLabels.length ? [`Checking ${selectedLabels.length} channel rule set${selectedLabels.length > 1 ? "s" : ""}`] : []),
    ...(rejection.trim() ? ["Working out the likely reason for rejection"] : []),
    "Building your report",
  ];

  function chooseMarket(id: string) {
    setMarket(id);
    setChannels([]);
  }

  function toggleChannel(id: string) {
    setChannels((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  function loadExample(example: Example) {
    setText(example.text);
    setMarket(example.market);
    setChannels(example.channels);
    setRejection(example.rejection ?? "");
    setRejectionOpen(!!example.rejection);
    setProblem(null);
    setInfo(null);
    setResult(null);
  }

  async function check(labelText = text) {
    setBusy("check");
    setProblem(null);
    setInfo(null);
    setResult(null);
    const body = { text: labelText, market, channels, rejection: rejectionOpen ? rejection : "" };
    const res = await request<CheckResponse>("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === "ok") setResult({ report: res.report, explanation: res.explanation, notice: res.notice });
    else setProblem({ kind: res.status === "needs_text" ? "input" : "error", text: res.message });
    setBusy(null);
  }

  function recheck(fixedText: string) {
    setText(fixedText);
    window.scrollTo({ top: 0, behavior: "smooth" });
    check(fixedText);
  }

  async function readImage(file: File) {
    setBusy("image");
    setProblem(null);
    setInfo(null);
    const form = new FormData();
    form.append("image", file);
    const res = await request<ReadImageResponse>("/api/read-image", { method: "POST", body: form });
    if (res.status === "ok") {
      setText(res.text);
      setInfo("We read this text from your photo. Fix any mistakes, then click Check.");
    } else {
      setProblem({ kind: res.status === "needs_text" ? "input" : "error", text: res.message });
    }
    setBusy(null);
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-line bg-surface p-3 text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand font-bold text-brand-ink" aria-hidden>
              S
            </span>
            <div>
              <h1 className="text-xl font-bold leading-tight">ShelfReady</h1>
              <p className="text-sm text-muted">Catch label problems before you print, for every market and channel you sell on.</p>
            </div>
          </div>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">Rule packs v0.1 · not legal advice</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-8">
        <section className={`${card} h-fit space-y-5 p-5 lg:sticky lg:top-6`} aria-label="Your label">
          <div>
            <label htmlFor="label-text" className="block text-sm font-semibold">
              Label text
            </label>
            <textarea
              id="label-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder="Paste your label: product name, claims, ingredients, net quantity, MRP…"
              className={inputClass}
            />
            <label className="mt-2 inline-block cursor-pointer text-sm font-medium text-brand underline underline-offset-2">
              {busy === "image" ? "Reading photo…" : "Upload a photo instead"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) readImage(file);
                }}
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Where do you sell?</legend>
            <div className="mt-1 grid grid-cols-2 rounded-lg border border-line bg-raised p-1" role="radiogroup">
              {MARKETS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={market === m.id}
                  onClick={() => chooseMarket(m.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${market === m.id ? "bg-surface shadow-sm" : "text-muted hover:text-ink"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {market === "india" ? "FSSAI and Legal Metrology rules always apply. Add channels:" : "FDA rules always apply. Add channels:"}
            </p>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              {marketChannels.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={channels.includes(c.id)}
                    onChange={() => toggleChannel(c.id)}
                    aria-label={c.label}
                    className="h-4 w-4 accent-[var(--color-brand)]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>

          <details
            open={rejectionOpen}
            onToggle={(e) => setRejectionOpen((e.target as HTMLDetailsElement).open)}
            className="rounded-lg border border-line"
          >
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Got a rejection? Paste the message</summary>
            <div className="px-3 pb-3">
              <textarea
                id="rejection-text"
                value={rejection}
                onChange={(e) => setRejection(e.target.value)}
                rows={3}
                placeholder="e.g. “Listing rejected: label information incomplete”"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-muted">We&apos;ll explain the likely reason and point to the flags behind it.</p>
            </div>
          </details>

          <button
            type="button"
            onClick={() => check()}
            disabled={busy !== null}
            className="w-full rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
          >
            {busy === "check" ? "Checking…" : "Check"}
          </button>
        </section>

        <section aria-label="Results" aria-live="polite" className="min-w-0 space-y-4">
          {info && <p className="rounded-lg border border-low/40 bg-low-soft p-3 text-sm text-low">{info}</p>}
          {problem && (
            <div
              role="alert"
              className={`rounded-xl border p-4 ${problem.kind === "input" ? "border-medium/40 bg-medium-soft text-medium" : "border-high/40 bg-high-soft text-high"}`}
            >
              <p className="font-semibold">{problem.kind === "input" ? "We need a little more" : "Something went wrong"}</p>
              <p className="mt-1 text-sm">{problem.text}</p>
              {problem.kind === "error" && (
                <button type="button" onClick={() => check()} className="mt-2 text-sm font-semibold underline">
                  Try again
                </button>
              )}
            </div>
          )}
          {result?.notice && <p className="rounded-lg border border-low/40 bg-low-soft p-3 text-sm text-low">{result.notice}</p>}

          {busy === "check" ? (
            <LoadingState steps={loadingSteps} />
          ) : result ? (
            <Report report={result.report} explanation={result.explanation} onRecheck={recheck} />
          ) : (
            !problem && <EmptyState onExample={loadExample} />
          )}
        </section>
      </main>
    </div>
  );
}
