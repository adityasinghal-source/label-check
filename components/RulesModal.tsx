"use client";

import { useRef } from "react";
import { chip, chipUnverified } from "@/components/styles";
import { CATEGORIES, CHANNELS, MARKETS, onlineRules, PACK_TYPES, QUICK_COMMERCE } from "@/lib/rulepacks";
import type { Rule } from "@/lib/types";

type Group = { title: string; rules: Rule[] };

// Every rule a market can apply, grouped by where it comes from. A rule shared by several categories is listed once.
function groupsFor(marketId: string): Group[] {
  const market = MARKETS.find((m) => m.id === marketId)!;
  const unique = (rules: Rule[]) => [...new Map(rules.map((r) => [r.id, r])).values()];
  const channels = CHANNELS.filter((c) => c.market === marketId);
  return [
    { title: `${market.pack.label} rule pack v${market.pack.version}`, rules: market.pack.rules },
    { title: "Product categories", rules: unique(CATEGORIES.flatMap((c) => c.rules[marketId] ?? [])) },
    { title: "Multi-pack / combo pack", rules: unique(PACK_TYPES.flatMap((p) => p.rules[marketId] ?? [])) },
    { title: "Selling online", rules: onlineRules(marketId) },
    { title: "Quick-commerce onboarding", rules: marketId === "india" ? QUICK_COMMERCE.rules : [] },
    ...channels.map((c) => ({ title: c.label, rules: c.rules })),
  ].filter((g) => g.rules.length > 0);
}

export default function RulesModal({ label }: { label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const total = new Set(MARKETS.flatMap((m) => groupsFor(m.id).flatMap((g) => g.rules.map((r) => r.id)))).size;

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-ink hover:text-ink"
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="rules-title"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto max-h-[85vh] w-[min(92vw,760px)] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface p-4">
          <div>
            <h2 id="rules-title" className="text-lg font-bold">
              Rules covered ({total})
            </h2>
            <p className="text-sm text-muted">A screening aid, not legal advice. Unverified rules come from second-hand sources.</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-md px-2 py-1 text-lg" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="grid gap-6 p-4 md:grid-cols-2">
          {MARKETS.map((m) => (
            <section key={m.id} aria-label={m.label}>
              <h3 className="font-bold">{m.label}</h3>
              {groupsFor(m.id).map((g) => (
                <div key={g.title} className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {g.rules.map((r) => (
                      <li key={r.id}>
                        <a href={r.source.url} target="_blank" rel="noreferrer" className="font-mono underline decoration-line underline-offset-2">
                          {r.id}
                        </a>{" "}
                        · {r.name}
                        <span className="text-xs text-muted"> · {r.checkedBy === "ai" ? "AI check" : "rule check"}</span>
                        {!r.verified && <span className={`${chip} ${chipUnverified} ml-1`}>Unverified</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
