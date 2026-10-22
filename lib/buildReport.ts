import type { AllergenResult } from "./allergens";
import { CATEGORIES, type Market } from "./rulepacks";
import type { Category, Channel, Flag, Report, RuleStatus, VisualFindings } from "./types";

// This tool can only say "no issues found against this rule pack", never that a label is compliant.
export function noCompliant(s: string) {
  return s.replace(/\bnon-?compliant\b/gi, "risky").replace(/\bcompliant\b/gi, "lower-risk");
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function buildReport({
  market,
  channels = [],
  category = CATEGORIES[0],
  visual = null,
  labelText,
  aiFlags,
  allergens,
  codeFlags = [],
  droppedAiFlags,
}: {
  market: Market;
  channels?: Channel[];
  category?: Category;
  visual?: VisualFindings | null;
  labelText: string;
  aiFlags: Flag[];
  allergens: AllergenResult;
  codeFlags?: Flag[];
  droppedAiFlags: number;
}): Report {
  const pack = market.pack;
  // Label problems first (by severity), then things to confirm with each channel.
  const flags = [...aiFlags, ...allergens.flags, ...codeFlags]
    .map((f) => ({
      ...f,
      explanation: noCompliant(f.explanation),
      suggestedRewrite: noCompliant(f.suggestedRewrite),
    }))
    .sort(
      (a, b) =>
        Number(!!a.confirmOnly) - Number(!!b.confirmOnly) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );

  // "No issues found" covers the market's own rules; channel rules show in the channel matrix.
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
    market: market.id,
    packLabel: pack.label,
    packVersion: pack.version,
    category: { id: category.id, label: category.label },
    channels: channels.map((c) => ({ id: c.id, label: c.label, note: c.note })),
    visualChecklist: pack.visualChecklist,
    visual,
    labelText,
    flags,
    ruleStatuses,
    allergenStatement: allergens.statement,
    droppedAiFlags,
  };
}
