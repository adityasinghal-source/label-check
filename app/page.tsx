"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Report from "@/components/Report";
import { card, chip, secondaryButton } from "@/components/styles";
import { historySnapshot, NO_HISTORY, saveToHistory, subscribeHistory, type HistoryEntry } from "@/lib/history";
import { MESSAGES } from "@/lib/messages";
import { CATEGORIES, CHANNELS, MARKETS } from "@/lib/rulepacks";
import { readiness } from "@/lib/summary";
import type { CheckResponse, Explanation, PanelId, ReadImageResponse, Report as ReportData, VisualFindings } from "@/lib/types";

type Inputs = { text: string; market: string; channels: string[]; category: string; rejection: string };
type Example = Inputs & { title: string; detail: string };

const GRANOLA =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";
const INDIA_CHANNELS = CHANNELS.filter((c) => c.market === "india").map((c) => c.id);

const EXAMPLES: Example[] = [
  {
    title: "Protein bar with a disease claim",
    detail: "US · FDA",
    text: "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds",
    market: "us",
    channels: [],
    category: "general",
    rejection: "",
  },
  { title: "Granola bites on Amazon", detail: "US · FDA + Amazon", text: GRANOLA, market: "us", channels: ["amazon-us"], category: "general", rejection: "" },
  {
    title: "Granola bites rejected by Blinkit",
    detail: "India · Blinkit · with a rejection",
    text: GRANOLA,
    market: "india",
    channels: ["blinkit"],
    category: "general",
    rejection: "Listing rejected: label information incomplete",
  },
  {
    title: "Makhana across Indian channels",
    detail: "India · all 7 channels",
    text: "Masala makhana. Veg. Net quantity: 80 g. MRP ₹99 (incl. of all taxes). Mfd. on: 10/2026. Best before 2 months from manufacture. Batch No.: MK2610.\nIngredients: fox nuts, rice bran oil, spices, salt.\nNutritional information per 100 g / per serve (20 g): Energy 480 kcal / 96 kcal, Protein 9 g / 1.8 g, Total fat 22 g / 4.4 g, Sodium 610 mg / 122 mg.\nManufactured by: Good Snacks Pvt Ltd, Pune. Country of origin: India. Customer care: 1800 123 4567 | care@goodsnacks.in\nFSSAI Lic. No. 11523999000123 · EAN 8901234567890",
    market: "india",
    channels: INDIA_CHANNELS,
    category: "general",
    rejection: "",
  },
];

const PANELS: { id: PanelId; label: string; hint: string }[] = [
  { id: "front", label: "Front panel (PDP)", hint: "Product name, claims, net quantity" },
  { id: "back", label: "Back panel", hint: "Ingredients, allergens, manufacturer, MRP, dates" },
  { id: "nutrition", label: "Nutrition table", hint: "Nutrition Facts / Nutritional information" },
];
const PANEL_HEADINGS: Record<PanelId, string> = { front: "Front panel (PDP):", back: "Back panel:", nutrition: "Nutrition panel:" };

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
type UploadFile = { id: string; file: File; panel: PanelId | ""; preview: string | null };

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

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function composePanels(panels: Record<PanelId, string>) {
  return PANELS.filter((p) => panels[p.id].trim())
    .map((p) => `${PANEL_HEADINGS[p.id]}\n${panels[p.id].trim()}`)
    .join("\n\n");
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

function SampleCards({ onPick }: { onPick: (e: Example) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {EXAMPLES.map((example) => (
        <li key={example.title}>
          <button
            type="button"
            onClick={() => onPick(example)}
            className="h-full w-full rounded-lg border border-line bg-raised p-3 text-left hover:border-ink"
          >
            <span className="block font-medium">{example.title}</span>
            <span className="block text-xs text-muted">{example.detail} · runs the check</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// A small dropdown that closes itself after a choice (any click on an item inside).
function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="relative">
      <summary className={`${secondaryButton} flex cursor-pointer list-none items-center gap-1`}>
        {label}
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </summary>
      <div
        className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-line bg-surface p-1 shadow-lg"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) e.currentTarget.parentElement?.removeAttribute("open");
        }}
      >
        {children}
      </div>
    </details>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"single" | "panels">("single");
  const [text, setText] = useState("");
  const [panels, setPanels] = useState<Record<PanelId, string>>({ front: "", back: "", nutrition: "" });
  const [market, setMarket] = useState("us");
  const [category, setCategory] = useState("general");
  const [channels, setChannels] = useState<string[]>([]);
  const [rejection, setRejection] = useState("");
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [visual, setVisual] = useState<VisualFindings | null>(null);
  const [busy, setBusy] = useState<"check" | "image" | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const history = useSyncExternalStore(subscribeHistory, historySnapshot, () => NO_HISTORY);

  // Wake the API routes while the user is still typing, so the first check is fast.
  useEffect(() => {
    for (const route of ["/api/check", "/api/read-image"]) fetch(route).catch(() => {});
  }, []);

  const labelText = mode === "single" ? text : composePanels(panels);
  const marketChannels = CHANNELS.filter((c) => c.market === market);
  const selectedLabels = marketChannels.filter((c) => channels.includes(c.id)).map((c) => c.label);

  const loadingSteps = [
    ...(labelText.trim() ? ["Reading your label", "Checking claims with AI", "Checking mandatory declarations and allergens"] : []),
    ...(labelText.trim() && selectedLabels.length ? [`Checking ${selectedLabels.length} channel rule set${selectedLabels.length > 1 ? "s" : ""}`] : []),
    ...(rejectionOpen && rejection.trim() ? ["Working out the likely reason for rejection"] : []),
    "Building your report",
  ];

  function chooseMarket(id: string) {
    setMarket(id);
    setChannels([]);
  }

  function toggleChannel(id: string) {
    setChannels((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  }

  function resetAll() {
    setMode("single");
    setText("");
    setPanels({ front: "", back: "", nutrition: "" });
    setMarket("us");
    setCategory("general");
    setChannels([]);
    setRejection("");
    setRejectionOpen(false);
    uploads.forEach((u) => u.preview && URL.revokeObjectURL(u.preview));
    setUploads([]);
    setVisual(null);
    setProblem(null);
    setInfo(null);
    setResult(null);
  }

  async function check(override?: Inputs) {
    const inputs: Inputs = override ?? { text: labelText, market, channels, category, rejection: rejectionOpen ? rejection : "" };
    setBusy("check");
    setProblem(null);
    setInfo(null);
    setResult(null);
    const res = await request<CheckResponse>("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inputs, visual: override ? null : visual }),
    });
    if (res.status === "ok") {
      setResult({ report: res.report, explanation: res.explanation, notice: res.notice });
      const verdict = res.report ? readiness(res.report.flags, res.report.packVersion) : null;
      const tally = verdict ? (verdict.verdict.startsWith("No issues") ? verdict.verdict : `${verdict.verdict}: ${verdict.counts}`) : "Rejection explained";
      saveToHistory({ inputs, report: res.report, explanation: res.explanation, tally });
    } else {
      setProblem({ kind: res.status === "needs_text" ? "input" : "error", text: res.message });
    }
    setBusy(null);
  }

  // A sample fills the form and runs straight away: one click to a report.
  function runExample(example: Example) {
    resetAll();
    setText(example.text);
    setMarket(example.market);
    setChannels(example.channels);
    setCategory(example.category);
    setRejection(example.rejection);
    setRejectionOpen(!!example.rejection);
    window.scrollTo({ top: 0, behavior: "smooth" });
    check({ text: example.text, market: example.market, channels: example.channels, category: example.category, rejection: example.rejection });
  }

  function restore(entry: HistoryEntry) {
    resetAll();
    setText(entry.inputs.text);
    setMarket(entry.inputs.market);
    setChannels(entry.inputs.channels);
    setCategory(entry.inputs.category);
    setRejection(entry.inputs.rejection);
    setRejectionOpen(!!entry.inputs.rejection);
    setResult({ report: entry.report, explanation: entry.explanation });
  }

  function recheck(fixedText: string) {
    setMode("single");
    setText(fixedText);
    window.scrollTo({ top: 0, behavior: "smooth" });
    check({ text: fixedText, market, channels, category, rejection: rejectionOpen ? rejection : "" });
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = [...list];
    const tooBig = incoming.find((f) => f.size > MAX_FILE_BYTES || !ACCEPT.split(",").includes(f.type));
    if (tooBig) {
      setProblem({ kind: "input", text: MESSAGES.uploadRules });
      return;
    }
    setProblem(null);
    setUploads((current) =>
      [...current, ...incoming]
        .slice(0, 3)
        .map((f, i) =>
          "file" in (f as UploadFile)
            ? (f as UploadFile)
            : {
                id: `${Date.now()}-${i}`,
                file: f as File,
                panel: (["front", "back", "nutrition"] as PanelId[]).at(i) ?? "",
                preview: (f as File).type.startsWith("image/") ? URL.createObjectURL(f as File) : null,
              },
        ),
    );
  }

  async function readFiles() {
    setBusy("image");
    setProblem(null);
    setInfo(null);
    const form = new FormData();
    for (const u of uploads) {
      form.append("files", u.file);
      form.append("panels", u.panel);
    }
    const res = await request<ReadImageResponse>("/api/read-image", { method: "POST", body: form });
    if (res.status === "ok") {
      setMode("panels");
      setPanels({ front: res.panels.front ?? "", back: res.panels.back ?? "", nutrition: res.panels.nutrition ?? "" });
      setVisual(res.visual);
      setInfo("We read this text from your files. Check each panel and fix any mistakes, then click Check.");
    } else {
      setProblem({ kind: res.status === "needs_text" ? "input" : "error", text: res.message });
    }
    setBusy(null);
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-line bg-surface p-3 text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-surface print:hidden">
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
          <div className="flex flex-wrap items-center gap-2">
            <Menu label="Try a sample">
              {EXAMPLES.map((e) => (
                <button
                  key={e.title}
                  type="button"
                  onClick={() => runExample(e)}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-raised"
                >
                  <span className="block font-medium">{e.title}</span>
                  <span className="block text-xs text-muted">{e.detail}</span>
                </button>
              ))}
            </Menu>
            <Menu label={`Recent checks (${history.length})`}>
              {history.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">Your last 5 checks will appear here (saved in this browser only).</p>
              ) : (
                history.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => restore(h)}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-raised"
                    >
                      <span className="block truncate font-medium">{h.inputs.text.split("\n")[0] || h.inputs.rejection || "Rejection only"}</span>
                      <span className="block text-xs text-muted">
                        {new Date(h.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                        {MARKETS.find((m) => m.id === h.inputs.market)?.label} · {h.tally}
                      </span>
                    </button>
                  ))
              )}
            </Menu>
            <span className="hidden rounded-full border border-line px-3 py-1 text-xs text-muted sm:inline">Rule packs v0.1 · not legal advice</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-8 print:block">
        <section className={`${card} h-fit space-y-5 p-5 lg:sticky lg:top-6 print:hidden`} aria-label="Your label">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold" id="label-heading">
                Label text
              </span>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-line bg-raised p-0.5 text-xs font-semibold" role="group" aria-label="Input mode">
                  {(["single", "panels"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => {
                        if (m === "panels" && mode === "single" && text.trim() && !Object.values(panels).some((p) => p.trim())) {
                          setPanels({ front: text, back: "", nutrition: "" });
                        }
                        if (m === "single" && mode === "panels") setText(composePanels(panels));
                        setMode(m);
                      }}
                      className={`rounded-md px-2 py-1 ${mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                    >
                      {m === "single" ? "Single text" : "Panels"}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={resetAll} className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink">
                  Clear
                </button>
              </div>
            </div>

            {mode === "single" ? (
              <textarea
                id="label-text"
                aria-labelledby="label-heading"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder="Paste your label: product name, claims, ingredients, nutrition table, net quantity, MRP…"
                className={inputClass}
              />
            ) : (
              <div className="mt-1 space-y-3">
                {PANELS.map((p) => (
                  <div key={p.id}>
                    <label htmlFor={`panel-${p.id}`} className="block text-xs font-semibold">
                      {p.label} <span className="font-normal text-muted">· {p.hint}</span>
                    </label>
                    <textarea
                      id={`panel-${p.id}`}
                      value={panels[p.id]}
                      onChange={(e) => setPanels((v) => ({ ...v, [p.id]: e.target.value }))}
                      rows={p.id === "front" ? 3 : 4}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-right text-xs text-muted" aria-live="polite">
              {labelText.length.toLocaleString()} characters · {words(labelText).toLocaleString()} words
            </p>
          </div>

          <div>
            <label htmlFor="upload" className="block text-sm font-semibold">
              Or upload the artwork
            </label>
            <p className="text-xs text-muted">PNG, JPG, WebP or PDF up to 10 MB each, up to 3 files (front, back, nutrition panel).</p>
            <input
              id="upload"
              type="file"
              multiple
              accept={ACCEPT}
              disabled={busy !== null || uploads.length >= 3}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-raised file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
            />
            {uploads.length > 0 && (
              <ul className="mt-3 space-y-2">
                {uploads.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 rounded-lg border border-line p-2">
                    {u.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.preview} alt="" className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded bg-raised text-xs font-bold text-muted">PDF</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{u.file.name}</p>
                      <p className="text-xs text-muted">{(u.file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <select
                      aria-label={`Panel for ${u.file.name}`}
                      value={u.panel}
                      onChange={(e) => setUploads((all) => all.map((x) => (x.id === u.id ? { ...x, panel: e.target.value as PanelId | "" } : x)))}
                      className="rounded-md border border-line bg-surface p-1 text-xs"
                    >
                      <option value="">Panel?</option>
                      <option value="front">Front / PDP</option>
                      <option value="back">Back / ingredients</option>
                      <option value="nutrition">Nutrition panel</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove ${u.file.name}`}
                      onClick={() => {
                        if (u.preview) URL.revokeObjectURL(u.preview);
                        setUploads((all) => all.filter((x) => x.id !== u.id));
                      }}
                      className="rounded px-1.5 text-muted hover:text-ink"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {uploads.length > 0 && (
              <button type="button" onClick={readFiles} disabled={busy !== null} className={`${secondaryButton} mt-2`}>
                {busy === "image" ? "Reading files…" : "Read text from files"}
              </button>
            )}
            {visual && (
              <p className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="Seen on the artwork">
                {(
                  [
                    ["vegMark", "Veg / non-veg mark"],
                    ["fssaiLogo", "FSSAI logo"],
                    ["barcode", "Barcode"],
                  ] as const
                ).map(([key, label]) => (
                  <span key={key} className={`${chip} ${visual[key] ? "border border-pass bg-pass-soft text-pass" : "border border-line bg-raised text-ink"}`}>
                    {visual[key] ? "✓ " : "Not seen: "}
                    {label}
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
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
            </fieldset>
            <div>
              <label htmlFor="category" className="block text-sm font-semibold">
                Product category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <div className="flex items-center justify-between gap-2">
              <legend className="text-xs text-muted">
                {market === "india" ? "FSSAI and Legal Metrology rules always apply. Add channels:" : "FDA rules always apply. Add channels:"}
              </legend>
              {marketChannels.length > 1 && (
                <span className="flex gap-2 text-xs font-semibold">
                  <button type="button" onClick={() => setChannels(marketChannels.map((c) => c.id))} className="text-brand underline underline-offset-2">
                    Select all
                  </button>
                  <button type="button" onClick={() => setChannels([])} className="text-brand underline underline-offset-2">
                    Clear all
                  </button>
                </span>
              )}
            </div>
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

          <div className="rounded-lg border border-line">
            <button
              type="button"
              aria-expanded={rejectionOpen}
              aria-controls="rejection-panel"
              onClick={() => setRejectionOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold"
            >
              <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${rejectionOpen ? "rotate-90" : ""}`}>
                <path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              Got a rejection? Paste the message
            </button>
            <div id="rejection-panel" hidden={!rejectionOpen} className="px-3 pb-3">
              <label htmlFor="rejection-text" className="sr-only">
                Rejection message
              </label>
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
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => check()}
              disabled={busy !== null}
              className="flex-1 rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
            >
              {busy === "check" ? "Checking…" : "Check"}
            </button>
            <button type="button" onClick={resetAll} disabled={busy === "check"} className={secondaryButton}>
              Clear / Reset
            </button>
          </div>
        </section>

        <section aria-label="Results" aria-live="polite" className="min-w-0 space-y-4">
          {info && <p className="rounded-lg border border-low bg-low-soft p-3 text-sm text-low print:hidden">{info}</p>}
          {problem && (
            <div
              role="alert"
              className={`rounded-xl border p-4 print:hidden ${problem.kind === "input" ? "border-medium bg-medium-soft text-medium" : "border-high bg-high-soft text-high"}`}
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
          {result?.notice && <p className="rounded-lg border border-low bg-low-soft p-3 text-sm text-low">{result.notice}</p>}

          {busy === "check" ? (
            <LoadingState steps={loadingSteps} />
          ) : result ? (
            <Report report={result.report} explanation={result.explanation} onRecheck={recheck} />
          ) : (
            <div className={`${card} p-6 print:hidden`}>
              <p className="text-lg font-semibold">{problem ? "Or try a sample" : "Your report will appear here"}</p>
              <p className="mb-4 mt-1 text-sm text-muted">
                Paste your label on the left, pick where you sell, and click Check. Or run one of these samples in one click:
              </p>
              <SampleCards onPick={runExample} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
