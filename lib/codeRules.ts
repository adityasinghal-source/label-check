import { ingredientsRange, wordPattern } from "./allergens";
import { sentenceRange } from "./sentences";
import { declaredShelfLife } from "./shelfLife";
import type { Flag, Rule } from "./types";

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

// Rules checked by plain code. `channels` is stamped on every flag: [] for the market's own rules,
// or the channel IDs the rules belong to.
export function checkCodeRules(labelText: string, rules: Rule[], channels: string[] = []): Flag[] {
  // Claims live outside the ingredient list, so "glucose syrup" as an ingredient isn't a claim.
  const range = ingredientsRange(labelText);
  const claimText = range
    ? labelText.slice(0, range[0]) + " ".repeat(range[1] - range[0]) + labelText.slice(range[1])
    : labelText;

  const flags: Flag[] = [];
  for (const rule of rules) {
    const match = rule.match;
    if (rule.checkedBy !== "code" || !match) continue;

    if (match.when === "confirm") {
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
      if (!new RegExp(match.regex, "i").test(labelText)) flags.push(ruleFlag(rule, "", channels));
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
