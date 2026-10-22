import { ingredientsRange, wordPattern } from "./allergens";
import { sentenceRange } from "./sentences";
import type { Flag, Rule, RulePack } from "./types";

function toFlag(rule: Rule, quotedText: string): Flag {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    citation: rule.citation,
    severity: rule.severity,
    quotedText,
    explanation: rule.explanation ?? "",
    suggestedRewrite: "",
    advice: rule.advice,
    fix: rule.fix ?? { type: "manual" },
    foundBy: "code",
  };
}

// Channel rules checked by plain code: flag each sentence that uses a listed word ("present"),
// or flag once when a required item such as a licence number is missing ("absent").
export function checkCodeRules(labelText: string, pack: RulePack): Flag[] {
  // Claims live outside the ingredient list, so "glucose syrup" as an ingredient isn't a claim.
  const range = ingredientsRange(labelText);
  const claimText = range
    ? labelText.slice(0, range[0]) + " ".repeat(range[1] - range[0]) + labelText.slice(range[1])
    : labelText;

  const flags: Flag[] = [];
  for (const rule of pack.rules) {
    if (rule.checkedBy !== "code" || !rule.match) continue;
    const { when, words, regex } = rule.match;
    const pattern = regex ? new RegExp(regex, "gi") : new RegExp(wordPattern(words ?? []).source, "gi");

    if (when === "absent") {
      if (!pattern.test(labelText)) flags.push(toFlag(rule, ""));
      continue;
    }

    const seen = new Set<number>();
    for (const match of claimText.matchAll(pattern)) {
      const [start, end] = sentenceRange(labelText, match.index, match.index + match[0].length);
      if (seen.has(start)) continue;
      seen.add(start);
      flags.push(toFlag(rule, labelText.slice(start, end).replace(/[.!?]$/, "")));
    }
  }
  return flags;
}
