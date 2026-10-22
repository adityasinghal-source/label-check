import { MissingKeyError, writeListing } from "@/lib/ai";
import { noCompliant } from "@/lib/buildReport";
import { checkInput } from "@/lib/inputGuard";
import { listingCopyProblems } from "@/lib/listing";
import { MESSAGES } from "@/lib/messages";
import { getMarket } from "@/lib/rulepacks";
import type { ListingResponse } from "@/lib/types";

export const maxDuration = 30;

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, 30) : []);

// Catalogue title and highlights for a checked label. Lines that repeat a flagged claim are dropped by code.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const market = getMarket(body.market);
  if (!market) return Response.json({ status: "error", message: MESSAGES.chooseMarket } satisfies ListingResponse);
  const input = checkInput(typeof body.labelText === "string" ? body.labelText : "");
  if (!input.ok) return Response.json({ status: "needs_text", message: input.message } satisfies ListingResponse);

  const flagged = strings(body.flaggedClaims);
  const avoidWords = strings(body.avoidWords);
  const productName = typeof body.productName === "string" ? body.productName.slice(0, 120) : "";
  try {
    const copy = await writeListing(input.text, productName, market.label, [...flagged, ...avoidWords]);
    const ok = (line: string) => line.trim() && !listingCopyProblems(line, flagged, avoidWords);
    const highlights = copy.highlights.map((h) => noCompliant(h.trim())).filter(ok).slice(0, 5);
    const title = ok(copy.title) ? noCompliant(copy.title.trim()) : productName;
    return Response.json({ status: "ok", title, highlights } satisfies ListingResponse);
  } catch (error) {
    if (error instanceof MissingKeyError) return Response.json({ status: "error", message: MESSAGES.missingKey } satisfies ListingResponse);
    console.error("Listing copy failed:", error);
    return Response.json({ status: "error", message: MESSAGES.checkerFailed } satisfies ListingResponse);
  }
}
