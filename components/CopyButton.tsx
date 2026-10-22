"use client";

import { useState } from "react";

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
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-raised"
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Blocked: select the text" : label}
    </button>
  );
}
