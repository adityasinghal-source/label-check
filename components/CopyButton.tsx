"use client";

import { useState } from "react";

// Copies text, then says so for 2 seconds (announced to screen readers too).
export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Some browsers block the clipboard API; fall back to the older copy command.
      const box = document.createElement("textarea");
      box.value = text;
      document.body.appendChild(box);
      box.select();
      ok = document.execCommand("copy");
      box.remove();
    }
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold print:hidden ${
        state === "copied" ? "border-pass bg-pass-soft text-pass" : "border-line bg-surface text-ink hover:bg-raised"
      }`}
    >
      <span aria-live="polite">{state === "copied" ? "✓ Copied!" : state === "failed" ? "Blocked: select the text" : label}</span>
    </button>
  );
}
