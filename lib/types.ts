export type Severity = "high" | "medium" | "low";

// How a code-checked channel rule finds its problem in the label text.
export type RuleMatch = {
  // "present": flag when a word appears; "absent": flag when a required pattern is missing.
  when: "present" | "absent";
  words?: string[];
  regex?: string;
};

// How "Fix all" handles a flag from a code-checked channel rule.
export type RuleFix =
  | { type: "remove_sentence" }
  | { type: "append_line"; line: string }
  | { type: "manual" };

export type Rule = {
  id: string;
  name: string;
  severity: Severity;
  checkedBy: "ai" | "code";
  citation: string;
  aiGuidance?: string;
  // Channel rules checked by plain code:
  match?: RuleMatch;
  explanation?: string;
  advice?: string;
  fix?: RuleFix;
};

export type Allergen = {
  name: string;
  keywords: string[];
  exclude?: string[];
  declaredBy: string[];
  // Tree nuts, fish etc. must name the specific nut or fish when declared.
  nameSpecific?: boolean;
};

export type RulePack = {
  id: string;
  label: string;
  version: string;
  // A channel pack (Amazon, Blinkit) adds its own rules on top of a country pack.
  extends?: string;
  basedOn?: string;
  allergenRuleId: string;
  // Optional low-severity rule for allergens already named by the ingredient itself.
  allergenAdviceRuleId?: string;
  rules: Rule[];
  allergens: Allergen[];
};

// What the AI sends back for each flag. Every field is untrusted until validateFlags checks it.
export type AiFlag = {
  rule_id?: string;
  quoted_text?: string;
  explanation?: string;
  suggested_rewrite?: string;
};

export type Flag = {
  ruleId: string;
  ruleName: string;
  citation: string;
  severity: Severity;
  // Empty for "missing" problems (e.g. no FSSAI licence number), which have nothing to highlight.
  quotedText: string;
  explanation: string;
  suggestedRewrite: string;
  // Shown instead of a copyable rewrite when the fix is an action, not replacement text.
  advice?: string;
  fix?: RuleFix | { type: "rewrite" } | { type: "allergen_statement" };
  foundBy: "ai" | "code";
};

export type RuleStatus = {
  ruleId: string;
  ruleName: string;
  status: "no_issues" | "not_checked";
  note?: string;
};

export type Report = {
  packId: string;
  packLabel: string;
  packVersion: string;
  basedOn?: string;
  labelText: string;
  flags: Flag[];
  ruleStatuses: RuleStatus[];
  // The correct allergen line for this label, or null when there is no ingredient list.
  allergenStatement: string | null;
  droppedAiFlags: number;
};

export type CheckResponse =
  | { status: "ok"; report: Report }
  | { status: "needs_text" | "error"; message: string };

export type ReadImageResponse =
  | { status: "ok"; text: string }
  | { status: "needs_text" | "error"; message: string };

export type Explanation = {
  likelyCause: string;
  ruleId: string | null;
  ruleName: string | null;
  citation: string | null;
  evidenceQuote: string | null;
  fixSteps: string[];
  appealNote: string;
};

export type ExplainResponse =
  | { status: "ok"; explanation: Explanation; packLabel: string }
  | { status: "needs_text" | "error"; message: string };
