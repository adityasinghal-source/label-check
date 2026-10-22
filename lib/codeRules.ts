import { findBareAdditives } from "./additives";
import { ingredientsRange, wordPattern } from "./allergens";
import { checkFssaiNumber, findFssaiNumbers } from "./fssaiNumber";
import { findBarcodes } from "./gs1";
import { sentenceRange } from "./sentences";
import { checkNutrientClaims, thresholdWords } from "./nutrition";
import { declaredShelfLife } from "./shelfLife";
import type { Flag, NutrientClaim, Rule, VisualFindings } from "./types";

export function ruleFlag(rule: Rule, quotedText: string, channels: string[], extra: Partial<Flag> = {}): Flag {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    citation: rule.citation,
    source: rule.source,
    verified: rule.verified,
    severity: rule.severity,
    quotedText,
    explanation: rule.explanation ?? "",
    suggestedRewrite: "",
    advice: rule.advice,
    fix: rule.fix ?? { type: "manual" },
    foundBy: "code",
    channels,
    ...extra,
  };
}

// Unfilled placeholders: [MRP], <address>, XXXXXXXX, TBD, or dummy numbers such as 12345678901234.
const PLACEHOLDER = /\[[^\]\n]{1,80}\]|<[^>\n]{1,40}>|\bX{4,}\b|\b(?:TBD|TODO|TBC)\b|\b(?:0{8,}|1{8,}|9{8,}|12345678\d*)\b/gi;

export function findPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[0]))];
}

export type RuleContext = {
  nutrientClaims?: NutrientClaim[];
  nutrientBasis?: string;
  visual?: VisualFindings | null;
  // Imported food needs a Central FSSAI licence.
  categoryId?: string;
};

// Rules checked by plain code. `channels` is stamped on every flag: [] for the market's own rules,
// or the channel IDs the rules belong to.
export function checkCodeRules(labelText: string, rules: Rule[], channels: string[] = [], context: RuleContext = {}): Flag[] {
  // Claims live outside the ingredient list, so "glucose syrup" as an ingredient isn't a claim.
  const range = ingredientsRange(labelText);
  const claimText = range
    ? labelText.slice(0, range[0]) + " ".repeat(range[1] - range[0]) + labelText.slice(range[1])
    : labelText;

  const flags: Flag[] = [];
  for (const rule of rules) {
    const match = rule.match;
    if (rule.checkedBy !== "code" || !match) continue;
    // A symbol vision saw on the uploaded artwork (e.g. the veg mark) satisfies the rule.
    if (rule.visualKey && context.visual?.[rule.visualKey]) continue;

    if (match.when === "placeholder") {
      for (const token of findPlaceholders(labelText)) {
        flags.push(
          ruleFlag(rule, token, channels, {
            fix: { type: "fill_in" },
            explanation: `"${token}" is a placeholder, not a real value. ${rule.explanation ?? ""}`,
          }),
        );
      }
    } else if (match.when === "nutrient_backing" || match.when === "nutrient_threshold") {
      for (const check of checkNutrientClaims(labelText, context.nutrientClaims ?? [])) {
        const basis = context.nutrientBasis ? ` ${context.nutrientBasis}` : "";
        if (match.when === "nutrient_backing" && !check.value) {
          flags.push(
            ruleFlag(rule, check.quote, channels, {
              explanation: `"${check.quote}" is a ${check.claim.claim.toLowerCase()} claim, but no ${check.claim.nutrient === "transFat" ? "trans fat" : check.claim.nutrient} amount was found in a nutrition table to back it.`,
            }),
          );
        } else if (match.when === "nutrient_threshold" && check.value && check.meets === false) {
          flags.push(
            ruleFlag(rule, check.quote, channels, {
              explanation: `"${check.claim.claim}" needs ${thresholdWords(check.claim)}${basis}; the nutrition table shows ${check.value.amount} ${check.value.unit}.`,
            }),
          );
        }
      }
    } else if (match.when === "fssai_number") {
      const placeholders = findPlaceholders(labelText);
      for (const { number, raw } of findFssaiNumbers(labelText)) {
        // Dummy numbers like 12345678901234 are already flagged as placeholders.
        if (placeholders.some((p) => raw.includes(p) || p.includes(number))) continue;
        const result = checkFssaiNumber(number, { needsCentral: context.categoryId === "imported" });
        if (!result.ok) flags.push(ruleFlag(rule, raw, channels, { explanation: `${result.problem} ${rule.explanation ?? ""}`.trim() }));
      }
    } else if (match.when === "barcode") {
      for (const { raw, check } of findBarcodes(labelText)) {
        if (check.valid) continue;
        flags.push(
          ruleFlag(rule, raw, channels, {
            explanation: `${check.format} ${check.code} fails the Modulo-10 check: its last digit should be ${check.expected}, not ${check.code.at(-1)}. ${rule.explanation ?? ""}`.trim(),
          }),
        );
      }
    } else if (match.when === "additives") {
      for (const additive of findBareAdditives(labelText)) {
        flags.push(
          ruleFlag(rule, additive.quote, channels, {
            suggestedRewrite: additive.rewrite,
            fix: { type: "replace_text" },
            explanation: `"${additive.quote}" is a food additive (${additive.functionalClass.toLowerCase()}). ${rule.explanation ?? ""}`.trim(),
          }),
        );
      }
    } else if (match.when === "confirm") {
      flags.push(ruleFlag(rule, "", channels, { confirmOnly: true, fix: { type: "manual" } }));
    } else if (match.when === "shelf_life") {
      const shelfLife = declaredShelfLife(labelText);
      if (!shelfLife) {
        flags.push(
          ruleFlag(rule, "", channels, {
            confirmOnly: true,
            fix: { type: "manual" },
            explanation: `No best-before period was found on the label, so this couldn't be checked. ${rule.explanation ?? ""}`,
          }),
        );
      } else if (shelfLife.days < match.minDays) {
        flags.push(
          ruleFlag(rule, shelfLife.phrase, channels, {
            fix: { type: "manual" },
            explanation: `The label gives a shelf life of about ${shelfLife.days} days. ${rule.explanation ?? ""}`,
          }),
        );
      }
    } else if (match.when === "absent") {
      const applies = !match.onlyIf || new RegExp(match.onlyIf, "i").test(labelText);
      if (applies && !new RegExp(match.regex, "i").test(labelText)) flags.push(ruleFlag(rule, "", channels));
    } else {
      const pattern = match.regex ? new RegExp(match.regex, "gi") : new RegExp(wordPattern(match.words ?? []).source, "gi");
      const seen = new Set<number>();
      for (const found of claimText.matchAll(pattern)) {
        const [start, end] = sentenceRange(labelText, found.index, found.index + found[0].length);
        if (seen.has(start)) continue;
        seen.add(start);
        flags.push(ruleFlag(rule, labelText.slice(start, end).replace(/[.!?]$/, ""), channels));
      }
    }
  }
  return flags;
}
