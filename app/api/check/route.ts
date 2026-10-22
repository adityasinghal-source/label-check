import { checkClaims, MissingKeyError } from "@/lib/ai";
import { checkAllergens } from "@/lib/allergens";
import { buildReport } from "@/lib/buildReport";
import { checkInput } from "@/lib/inputGuard";
import { MESSAGES } from "@/lib/messages";
import { getRulePack } from "@/lib/rulepacks";
import type { CheckResponse } from "@/lib/types";
import { validateFlags } from "@/lib/validateFlags";

export const maxDuration = 60;

function reply(body: CheckResponse) {
  return Response.json(body);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const pack = getRulePack(body.packId);
  if (!pack) return reply({ status: "error", message: MESSAGES.choosePack });

  const input = checkInput(body.text);
  if (!input.ok) return reply({ status: "needs_text", message: input.message });

  let ai;
  try {
    ai = await checkClaims(input.text, pack);
  } catch (error) {
    if (error instanceof MissingKeyError) return reply({ status: "error", message: MESSAGES.missingKey });
    console.error("Claim check failed:", error);
    return reply({ status: "error", message: MESSAGES.checkerFailed });
  }

  if (!ai.is_food_label) return reply({ status: "needs_text", message: MESSAGES.notALabel });

  const { flags, dropped } = validateFlags(ai.flags, input.text, pack);
  if (dropped > 0) console.warn(`Dropped ${dropped} AI flag(s) without a valid rule ID or real quote`);

  const report = buildReport(pack, flags, checkAllergens(input.text, pack), dropped);
  return reply({ status: "ok", report });
}
