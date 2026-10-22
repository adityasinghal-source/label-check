"use client";

import { useState } from "react";

// Builds a link that re-runs this exact check and copies it (announced to screen readers too).
export default function ShareButton({ onShare }: { onShare: () => Promise<string | null> }) {
  const [state, setState] = useState<"idle" | "copied" | "shown" | "failed">("idle");
  const [link, setLink] = useState("");

  async function share() {
    const url = await onShare();
    if (!url) {
      setState("failed");
      return;
    }
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      // The clipboard is blocked: show the link so it can be copied by hand.
      setState("shown");
    }
  }

  return (
    <span className="contents">
      <button
        type="button"
        onClick={share}
        className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold print:hidden ${
          state === "copied" ? "border-pass bg-pass-soft text-pass" : "border-line bg-surface text-ink hover:bg-raised"
        }`}
      >
        <span aria-live="polite">
          {state === "copied" ? "✓ Link copied!" : state === "failed" ? "Couldn't make a link" : "Share link"}
        </span>
      </button>
      {state === "shown" && (
        <input
          readOnly
          value={link}
          aria-label="Share link"
          onFocus={(e) => e.target.select()}
          autoFocus
          className="w-full rounded-md border border-line bg-surface px-2 py-1 text-xs print:hidden"
        />
      )}
    </span>
  );
}
