import type { AiFlag, Flag, RulePack } from "./types";

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// The AI's flags are untrusted. Keep a flag only if it cites an AI-checked rule from this pack
// and quotes words that are really in the label. Severity, name and citation come from the pack.
export function validateFlags(aiFlags: AiFlag[], labelText: string, pack: RulePack) {
  const label = normalize(labelText);
  const seen = new Set<string>();
  const flags: Flag[] = [];

  for (const f of aiFlags) {
    const rule = pack.rules.find((r) => r.id === f.rule_id?.trim() && r.checkedBy === "ai");
    const quote = f.quoted_text?.trim() ?? "";
    if (!rule || !quote || !label.includes(normalize(quote))) continue;

    const key = `${rule.id}|${normalize(quote)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    flags.push({
      ruleId: rule.id,
      ruleName: rule.name,
      citation: rule.citation,
      severity: rule.severity,
      quotedText: quote,
      explanation: f.explanation?.trim() ?? "",
      suggestedRewrite: f.suggested_rewrite?.trim() ?? "",
      foundBy: "ai",
    });
  }

  return { flags, dropped: aiFlags.length - flags.length };
}
