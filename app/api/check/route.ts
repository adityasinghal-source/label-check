import { checkClaims, explainRejection, MissingKeyError } from "@/lib/ai";
import { checkAllergens } from "@/lib/allergens";
import { buildReport, noCompliant } from "@/lib/buildReport";
import { checkCodeRules, ruleFlag } from "@/lib/codeRules";
import { checkInput } from "@/lib/inputGuard";
import { MESSAGES } from "@/lib/messages";
import { allRules, getCategory, getChannels, getMarket, layersFor } from "@/lib/rulepacks";
import { findQuote } from "@/lib/sentences";
import type { CheckResponse, Explanation, Flag, VisualFindings } from "@/lib/types";
import { validateFlags } from "@/lib/validateFlags";
import { connection } from "next/server";

export const maxDuration = 60;

function reply(body: CheckResponse) {
  return Response.json(body);
}

const isFilled = (v: unknown) => typeof v === "string" && v.trim() !== "";

// Warm-up ping from the page on load, so the first real check doesn't wait for the route to start.
// connection() makes it run per request instead of being prerendered as a static file.
export async function GET() {
  await connection();
  return Response.json({ ok: true });
}

// One check: the label (optional if a rejection is given) against the market and each selected
// channel, plus an explanation of a pasted rejection message (optional).
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const market = getMarket(body.market);
  if (!market) return reply({ status: "error", message: MESSAGES.chooseMarket });
  const channels = getChannels(market.id, body.channels);
  const category = getCategory(body.category);
  // What vision saw on uploaded artwork (only true values count; nothing is assumed without a photo).
  const visual: VisualFindings | null =
    body.visual && typeof body.visual === "object"
      ? { vegMark: body.visual.vegMark === true, fssaiLogo: body.visual.fssaiLogo === true, barcode: body.visual.barcode === true }
      : null;

  if (!isFilled(body.text) && !isFilled(body.rejection)) {
    return reply({ status: "needs_text", message: MESSAGES.pasteLabel });
  }

  let labelText: string | null = null;
  if (isFilled(body.text)) {
    const input = checkInput(body.text);
    if (!input.ok) return reply({ status: "needs_text", message: input.message });
    labelText = input.text;
  }

  let rejectionText: string | null = null;
  if (isFilled(body.rejection)) {
    const input = checkInput(body.rejection);
    if (!input.ok) {
      const message = input.message === MESSAGES.tooLong ? MESSAGES.tooLong : MESSAGES.pasteRejection;
      return reply({ status: "needs_text", message });
    }
    rejectionText = input.text;
  }

  // Plain-code checks are instant, so they run first and their findings go to the rejection explainer.
  const allergens = labelText ? checkAllergens(labelText, market.pack) : null;
  const context = { nutrientClaims: market.pack.nutrientClaims, nutrientBasis: market.pack.nutrientBasis, visual };
  const codeFlags: Flag[] = labelText
    ? layersFor(market, channels, category).flatMap((layer) => checkCodeRules(labelText, layer.rules, layer.channels, context))
    : [];
  const rules = allRules(market, channels, category);
  const sellingThrough = channels.length ? channels.map((c) => c.label).join(", ") : market.label;
  const issuesFound = [...(allergens?.flags ?? []), ...codeFlags].filter((f) => !f.confirmOnly);

  // The two AI calls run at the same time, so adding a rejection doesn't double the wait.
  let claims, explained;
  try {
    [claims, explained] = await Promise.all([
      labelText ? checkClaims(labelText, market.pack, rules) : null,
      rejectionText ? explainRejection(rejectionText, labelText ?? "", rules, sellingThrough, issuesFound) : null,
    ]);
  } catch (error) {
    if (error instanceof MissingKeyError) return reply({ status: "error", message: MESSAGES.missingKey });
    console.error("Check failed:", error);
    return reply({ status: "error", message: MESSAGES.checkerFailed });
  }

  if (claims && !claims.is_food_label) return reply({ status: "needs_text", message: MESSAGES.notALabel });

  let report = null;
  if (labelText && claims && allergens) {
    const { flags, dropped } = validateFlags(claims.flags, labelText, market.pack);
    if (dropped > 0) console.warn(`Dropped ${dropped} AI flag(s) without a valid rule ID or real quote`);
    // Statement of identity: the AI names the product; code checks the name is really on the label.
    const identity = market.pack.rules.find((r) => r.id === market.pack.identityRuleId);
    const name = claims.product_name.trim();
    if (identity && (!name || !findQuote(labelText, name))) flags.push(ruleFlag(identity, "", [], { foundBy: "ai" }));
    report = buildReport({ market, channels, category, visual, labelText, aiFlags: flags, allergens, codeFlags, droppedAiFlags: dropped });
  }

  let explanation: Explanation | null = null;
  let notice: string | undefined;
  if (explained) {
    if (!explained.is_rejection) {
      if (!report) return reply({ status: "needs_text", message: MESSAGES.notARejection });
      notice = MESSAGES.rejectionIgnored;
    } else {
      // Same rule as flags: keep rule IDs only if they exist, and a quote only if it's really on the label.
      const known = new Set(rules.map((r) => r.id));
      const found = labelText && explained.evidence_quote.trim() ? findQuote(labelText, explained.evidence_quote) : null;
      explanation = {
        likelyCause: noCompliant(explained.likely_cause.trim()),
        ruleIds: [...new Set(explained.rule_ids.map((id) => id.trim()).filter((id) => known.has(id)))].slice(0, 6),
        evidenceQuote: found && labelText ? labelText.slice(found[0], found[1]) : null,
        fixSteps: explained.fix_steps.map((s) => noCompliant(s.trim())).filter(Boolean).slice(0, 4),
        appealNote: noCompliant(explained.appeal_note.trim()),
      };
      if (!report) notice = MESSAGES.addLabelToConfirm;
    }
  }

  return reply({ status: "ok", report, explanation, notice });
}
