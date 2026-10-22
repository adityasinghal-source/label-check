"use client";

import { useEffect, useState } from "react";
import CompareView from "@/components/CompareView";
import ExplanationCard from "@/components/ExplanationCard";
import Report from "@/components/Report";
import { MESSAGES } from "@/lib/messages";
import { RULE_PACKS } from "@/lib/rulepacks";
import type { CheckResponse, ExplainResponse, Explanation, ReadImageResponse, Report as ReportData } from "@/lib/types";

const EXAMPLE_A =
  "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds";
const EXAMPLE_B =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";
const EXAMPLE_REJECTION =
  "(Example notice) Your listing has been removed. Reason: this product appears to make prohibited claims. Products marketed for diabetes or blood sugar conditions are not permitted without FDA approval. To reinstate, revise the listing and submit a plan of action.";

type Tab = "check" | "compare" | "explain";
type Notice = { kind: "info" | "warn"; text: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "check", label: "Check a label" },
  { id: "compare", label: "Compare markets" },
  { id: "explain", label: "Explain a rejection" },
];

async function request<T>(url: string, init: RequestInit): Promise<T | { status: "error"; message: string }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch {
    return { status: "error", message: MESSAGES.checkerFailed };
  }
}

const postJson = (body: object): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function PackSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded-lg border border-gray-300 bg-white p-2">
        {RULE_PACKS.map((pack) => (
          <option key={pack.id} value={pack.id}>
            {pack.label} v{pack.version}
          </option>
        ))}
      </select>
    </div>
  );
}

const primaryButton =
  "rounded-lg bg-gray-900 px-5 py-2 font-semibold text-white hover:bg-gray-700 disabled:opacity-50";

export default function Home() {
  const [tab, setTab] = useState<Tab>("check");
  const [text, setText] = useState("");
  const [packId, setPackId] = useState(RULE_PACKS[0].id);
  const [compareIds, setCompareIds] = useState<[string, string]>(["us-fda", "fssai"]);
  const [rejection, setRejection] = useState("");
  const [busy, setBusy] = useState<"check" | "image" | "compare" | "explain" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [comparison, setComparison] = useState<[ReportData, ReportData] | null>(null);
  const [explanation, setExplanation] = useState<{ explanation: Explanation; packLabel: string } | null>(null);

  // Wake the API routes while the user is still typing, so the first request is fast.
  useEffect(() => {
    for (const route of ["/api/check", "/api/read-image", "/api/explain"]) fetch(route).catch(() => {});
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    setNotice(null);
  }

  async function check(labelText = text) {
    setBusy("check");
    setNotice(null);
    setReport(null);
    const result = await request<CheckResponse>("/api/check", postJson({ text: labelText, packId }));
    if (result.status === "ok") setReport(result.report);
    else setNotice({ kind: "warn", text: result.message });
    setBusy(null);
  }

  function recheck(fixedText: string) {
    setText(fixedText);
    window.scrollTo({ top: 0, behavior: "smooth" });
    check(fixedText);
  }

  async function compare() {
    setBusy("compare");
    setNotice(null);
    setComparison(null);
    const [left, right] = await Promise.all(
      compareIds.map((id) => request<CheckResponse>("/api/check", postJson({ text, packId: id }))),
    );
    if (left.status === "ok" && right.status === "ok") setComparison([left.report, right.report]);
    else setNotice({ kind: "warn", text: left.status !== "ok" ? left.message : (right as { message: string }).message });
    setBusy(null);
  }

  async function explain() {
    setBusy("explain");
    setNotice(null);
    setExplanation(null);
    const result = await request<ExplainResponse>("/api/explain", postJson({ rejection, labelText: text, packId }));
    if (result.status === "ok") setExplanation({ explanation: result.explanation, packLabel: result.packLabel });
    else setNotice({ kind: "warn", text: result.message });
    setBusy(null);
  }

  async function readImage(file: File) {
    setBusy("image");
    setNotice(null);
    setReport(null);
    const form = new FormData();
    form.append("image", file);
    const result = await request<ReadImageResponse>("/api/read-image", { method: "POST", body: form });
    if (result.status === "ok") {
      setText(result.text);
      setNotice({ kind: "info", text: "We read this text from your photo. Fix any mistakes, then run the check." });
    } else {
      setNotice({ kind: "warn", text: result.message });
    }
    setBusy(null);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">Label Check</h1>
      <p className="mt-1 text-gray-600">
        Find risky claims and undeclared allergens before you print, for each market and sales channel.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 border-b border-gray-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => switchTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === t.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "explain" && (
        <div className="mt-6">
          <label htmlFor="rejection-text" className="block text-sm font-semibold">
            Rejection message
          </label>
          <textarea
            id="rejection-text"
            value={rejection}
            onChange={(e) => setRejection(e.target.value)}
            rows={4}
            placeholder="Paste the message from Amazon, a retailer or a regulator…"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 focus:border-gray-500 focus:outline-none"
          />
          <button onClick={() => setRejection(EXAMPLE_REJECTION)} className="mt-2 text-sm text-blue-700 underline">
            Use example rejection
          </button>
        </div>
      )}

      <label htmlFor="label-text" className="mt-6 block text-sm font-semibold">
        Label text{tab === "explain" && " (optional: helps find what triggered the rejection)"}
      </label>
      <textarea
        id="label-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={tab === "explain" ? 4 : 6}
        placeholder="Paste your label text here: product name, claims, ingredients…"
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 focus:border-gray-500 focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button onClick={() => setText(EXAMPLE_A)} className="text-sm text-blue-700 underline">
          Use example label
        </button>
        <button onClick={() => setText(EXAMPLE_B)} className="text-sm text-blue-700 underline">
          Try granola example
        </button>
        <label className="cursor-pointer text-sm text-blue-700 underline">
          {busy === "image" ? "Reading photo…" : "Upload photo instead"}
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

      <div className="mt-6 flex flex-wrap items-end gap-3">
        {tab === "compare" ? (
          <>
            <PackSelect id="compare-left" label="Market A" value={compareIds[0]} onChange={(v) => setCompareIds([v, compareIds[1]])} />
            <PackSelect id="compare-right" label="Market B" value={compareIds[1]} onChange={(v) => setCompareIds([compareIds[0], v])} />
            <button onClick={compare} disabled={busy !== null} className={primaryButton}>
              {busy === "compare" ? "Comparing…" : "Compare markets"}
            </button>
          </>
        ) : (
          <>
            <PackSelect id="rule-pack" label="Rule pack" value={packId} onChange={setPackId} />
            {tab === "check" ? (
              <button onClick={() => check()} disabled={busy !== null} className={primaryButton}>
                {busy === "check" ? "Checking…" : "Check label"}
              </button>
            ) : (
              <button onClick={explain} disabled={busy !== null} className={primaryButton}>
                {busy === "explain" ? "Explaining…" : "Explain rejection"}
              </button>
            )}
          </>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-6 rounded-lg p-3 text-sm ${notice.kind === "warn" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-8">
        {tab === "check" && report && <Report report={report} onRecheck={recheck} />}
        {tab === "compare" && comparison && <CompareView left={comparison[0]} right={comparison[1]} />}
        {tab === "explain" && explanation && (
          <ExplanationCard explanation={explanation.explanation} packLabel={explanation.packLabel} />
        )}
      </div>
    </main>
  );
}
