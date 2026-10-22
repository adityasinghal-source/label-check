import type { AllergenResult } from "./allergens";
import type { Flag, Report, RulePack, RuleStatus } from "./types";

// This tool can only say "no issues found against this rule pack", never that a label is compliant.
export function noCompliant(s: string) {
  return s.replace(/\bnon-?compliant\b/gi, "risky").replace(/\bcompliant\b/gi, "lower-risk");
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function buildReport({
  pack,
  labelText,
  aiFlags,
  allergens,
  codeFlags = [],
  droppedAiFlags,
}: {
  pack: RulePack;
  labelText: string;
  aiFlags: Flag[];
  allergens: AllergenResult;
  codeFlags?: Flag[];
  droppedAiFlags: number;
}): Report {
  const flags = [...aiFlags, ...allergens.flags, ...codeFlags]
    .map((f) => ({
      ...f,
      explanation: noCompliant(f.explanation),
      suggestedRewrite: noCompliant(f.suggestedRewrite),
    }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const ruleStatuses: RuleStatus[] = [];
  for (const rule of pack.rules) {
    const base = { ruleId: rule.id, ruleName: rule.name };
    if (rule.id === pack.allergenRuleId) {
      // The allergen rule lists each allergen that came back clean, even if others were flagged.
      if (!allergens.checked) ruleStatuses.push({ ...base, status: "not_checked", note: "No ingredient list found" });
      else if (allergens.clear.length > 0)
        ruleStatuses.push({ ...base, status: "no_issues", note: `no issues for ${allergens.clear.join(", ").toLowerCase()}` });
    } else if (rule.id === pack.allergenAdviceRuleId && !allergens.checked) {
      ruleStatuses.push({ ...base, status: "not_checked", note: "No ingredient list found" });
    } else if (!flags.some((f) => f.ruleId === rule.id)) {
      ruleStatuses.push({ ...base, status: "no_issues" });
    }
  }

  return {
    packId: pack.id,
    packLabel: pack.label,
    packVersion: pack.version,
    basedOn: pack.basedOn,
    labelText,
    flags,
    ruleStatuses,
    allergenStatement: allergens.statement,
    droppedAiFlags,
  };
}
