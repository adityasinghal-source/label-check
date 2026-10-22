import { explainRejection, MissingKeyError } from "@/lib/ai";
import { noCompliant } from "@/lib/buildReport";
import { checkInput } from "@/lib/inputGuard";
import { MESSAGES } from "@/lib/messages";
import { getRulePack } from "@/lib/rulepacks";
import { findQuote } from "@/lib/sentences";
import type { ExplainResponse } from "@/lib/types";
import { connection } from "next/server";

export const maxDuration = 60;

function reply(body: ExplainResponse) {
  return Response.json(body);
}

// Warm-up ping from the page on load (see app/api/check/route.ts).
export async function GET() {
  await connection();
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const pack = getRulePack(body.packId);
  if (!pack) return reply({ status: "error", message: MESSAGES.choosePack });

  const rejection = checkInput(body.rejection);
  if (!rejection.ok) {
    const message = rejection.message === MESSAGES.tooLong ? MESSAGES.tooLong : MESSAGES.pasteRejection;
    return reply({ status: "needs_text", message });
  }
  // The label is optional; it only sharpens the answer.
  const label = typeof body.labelText === "string" ? body.labelText.trim().slice(0, 5000) : "";

  let ai;
  try {
    ai = await explainRejection(rejection.text, label, pack);
  } catch (error) {
    if (error instanceof MissingKeyError) return reply({ status: "error", message: MESSAGES.missingKey });
    console.error("Rejection explanation failed:", error);
    return reply({ status: "error", message: MESSAGES.checkerFailed });
  }

  if (!ai.is_rejection) return reply({ status: "needs_text", message: MESSAGES.notARejection });

  // Same rule as flags: keep a rule only if it exists in this pack, and a quote only if it's really in the label.
  const rule = pack.rules.find((r) => r.id === ai.rule_id.trim()) ?? null;
  const found = label && ai.evidence_quote.trim() ? findQuote(label, ai.evidence_quote) : null;

  return reply({
    status: "ok",
    packLabel: pack.label,
    explanation: {
      likelyCause: noCompliant(ai.likely_cause.trim()),
      ruleId: rule?.id ?? null,
      ruleName: rule?.name ?? null,
      citation: rule?.citation ?? null,
      evidenceQuote: found ? label.slice(found[0], found[1]) : null,
      fixSteps: ai.fix_steps.map((s) => noCompliant(s.trim())).filter(Boolean).slice(0, 4),
      appealNote: noCompliant(ai.appeal_note.trim()),
    },
  });
}
