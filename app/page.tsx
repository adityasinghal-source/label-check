"use client";

import { useEffect, useState } from "react";
import Report from "@/components/Report";
import { MESSAGES } from "@/lib/messages";
import { RULE_PACKS } from "@/lib/rulepacks";
import type { CheckResponse, ReadImageResponse, Report as ReportData } from "@/lib/types";

const EXAMPLE =
  "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds";

type Notice = { kind: "info" | "warn"; text: string };

async function request<T>(url: string, init: RequestInit): Promise<T | { status: "error"; message: string }> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch {
    return { status: "error", message: MESSAGES.checkerFailed };
  }
}

export default function Home() {
  const [text, setText] = useState("");
  const [packId, setPackId] = useState(RULE_PACKS[0].id);
  const [busy, setBusy] = useState<"check" | "image" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);

  // Wake both API routes while the user is still typing, so the first check is fast.
  useEffect(() => {
    fetch("/api/check").catch(() => {});
    fetch("/api/read-image").catch(() => {});
  }, []);

  function reset() {
    setNotice(null);
    setReport(null);
  }

  async function check() {
    setBusy("check");
    reset();
    const result = await request<CheckResponse>("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, packId }),
    });
    if (result.status === "ok") setReport(result.report);
    else setNotice({ kind: "warn", text: result.message });
    setBusy(null);
  }

  async function readImage(file: File) {
    setBusy("image");
    reset();
    const form = new FormData();
    form.append("image", file);
    const result = await request<ReadImageResponse>("/api/read-image", { method: "POST", body: form });
    if (result.status === "ok") {
      setText(result.text);
      setNotice({ kind: "info", text: "We read this text from your photo. Fix any mistakes, then click Check label." });
    } else {
      setNotice({ kind: "warn", text: result.message });
    }
    setBusy(null);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Label Check</h1>
      <p className="mt-1 text-gray-600">
        Paste your draft label copy to find risky claims and undeclared allergens before you print.
      </p>

      <label htmlFor="label-text" className="mt-6 block text-sm font-semibold">
        Label text
      </label>
      <textarea
        id="label-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder="Paste your label text here: product name, claims, ingredients…"
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 focus:border-gray-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={() => setText(EXAMPLE)} className="text-sm text-blue-700 underline">
          Use example label
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
        <div>
          <label htmlFor="rule-pack" className="block text-sm font-semibold">
            Rule pack
          </label>
          <select
            id="rule-pack"
            value={packId}
            onChange={(e) => setPackId(e.target.value)}
            className="mt-1 rounded-lg border border-gray-300 bg-white p-2"
          >
            {RULE_PACKS.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.label} v{pack.version}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={check}
          disabled={busy !== null}
          className="rounded-lg bg-gray-900 px-5 py-2 font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy === "check" ? "Checking…" : "Check label"}
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className={`mt-6 rounded-lg p-3 text-sm ${notice.kind === "warn" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`}
        >
          {notice.text}
        </p>
      )}

      {report && <Report report={report} />}
    </main>
  );
}
