"use client";

import { useState } from "react";
import { card, secondaryButton } from "@/components/styles";

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [note, setNote] = useState("");
  const [previews, setPreviews] = useState<{ owner?: string; reply?: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setNote(json.emailed ? "Thanks! Check your inbox for a confirmation." : "Thanks! Your message was saved.");
      setPreviews(json.previews ?? null);
      setState("done");
      form.reset();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink";
  return (
    <section id="contact" className={`${card} mx-auto my-8 w-full max-w-xl p-6 print:hidden`}>
      <h2 className="text-lg font-semibold">Questions? Ask us</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Send a question and we will reply by email.</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="text-sm font-semibold">Name<input name="name" required maxLength={100} className={field} /></label>
        <label className="text-sm font-semibold">Email<input name="email" type="email" required maxLength={200} className={field} /></label>
        <label className="text-sm font-semibold">Message<textarea name="message" required maxLength={2000} rows={4} className={field} /></label>
        <button type="submit" disabled={state === "sending"} className={`${secondaryButton} self-start`}>
          {state === "sending" ? "Sending…" : "Send question"}
        </button>
        {(state === "done" || state === "error") && <p role="status" className="text-sm">{note}</p>}
        {state === "done" && previews && (
          <p className="text-sm">
            Test inbox:{" "}
            <a className="underline" href={previews.owner} target="_blank" rel="noreferrer">owner notification</a>
            {" · "}
            <a className="underline" href={previews.reply} target="_blank" rel="noreferrer">automatic reply</a>
          </p>
        )}
      </form>
    </section>
  );
}
