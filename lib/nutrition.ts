import { ingredientsRange } from "./allergens";
import type { NutrientClaim } from "./types";

type Nutrient = NutrientClaim["nutrient"];

// How each nutrient is named in a nutrition table. Fat skips "trans fat" and "saturated fat" lines.
const NUTRIENT_NAMES: Record<Nutrient, string> = {
  protein: "protein",
  fiber: "(?:dietary\\s+)?fib(?:er|re)",
  fat: "(?:total\\s+)?(?<!trans\\s)(?<!saturated\\s)(?<!sat\\.\\s)fat(?!\\s*free)",
  sugar: "(?:total\\s+)?sugars?(?!\\s*free)",
  transFat: "trans\\s+fats?",
  sodium: "sodium",
};

const HEADING = /\b(?:nutrition(?:al)?\s+(?:information|facts|panel|value)|supplement\s+facts)\b/i;

// [start, end) of the nutrition table: from its heading to the end of the text. null if there's none.
export function nutritionRange(text: string): [number, number] | null {
  const heading = HEADING.exec(text);
  return heading ? [heading.index, text.length] : null;
}

export type NutrientValue = { amount: number; unit: "g" | "mg" };

// The first amount after the nutrient's name in the nutrition table, e.g. "Protein 12 g" → 12 g.
export function nutrientValue(text: string, nutrient: Nutrient): NutrientValue | null {
  const range = nutritionRange(text);
  if (!range) return null;
  const table = text.slice(...range);
  const match = new RegExp(`\\b${NUTRIENT_NAMES[nutrient]}\\b[^\\d\\n]{0,24}?(\\d+(?:\\.\\d+)?)\\s*(mg|g)\\b`, "i").exec(table);
  return match ? { amount: Number(match[1]), unit: match[2].toLowerCase() as "g" | "mg" } : null;
}

const inUnit = (v: NutrientValue, unit: "g" | "mg") =>
  v.unit === unit ? v.amount : unit === "mg" ? v.amount * 1000 : v.amount / 1000;

export type ClaimCheck = { claim: NutrientClaim; quote: string; value: NutrientValue | null; meets: boolean | null };

// Every nutrient claim on the label (outside the ingredient list and the nutrition table), with the
// table's value for that nutrient and whether it meets the threshold (null = no value to check).
export function checkNutrientClaims(text: string, claims: NutrientClaim[]): ClaimCheck[] {
  const blank = (t: string, r: [number, number] | null) =>
    r ? t.slice(0, r[0]) + " ".repeat(r[1] - r[0]) + t.slice(r[1]) : t;
  const claimText = blank(blank(text, ingredientsRange(text)), nutritionRange(text));

  const results: ClaimCheck[] = [];
  for (const claim of claims) {
    const found = new RegExp(claim.pattern, "i").exec(claimText);
    if (!found) continue;
    const value = nutrientValue(text, claim.nutrient);
    let meets: boolean | null = null;
    if (value) {
      const amount = inUnit(value, claim.unit);
      meets = claim.op === "min" ? amount >= claim.value : claim.op === "max" ? amount <= claim.value : amount < claim.value;
    }
    results.push({ claim, quote: found[0], value, meets });
  }
  return results;
}

export function thresholdWords(claim: NutrientClaim) {
  const op = claim.op === "min" ? "at least" : claim.op === "max" ? "no more than" : "less than";
  return `${op} ${claim.value} ${claim.unit}`;
}
