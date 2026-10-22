export type Severity = "high" | "medium" | "low";

export type Rule = {
  id: string;
  name: string;
  severity: Severity;
  checkedBy: "ai" | "code";
  citation: string;
  aiGuidance?: string;
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
  quotedText: string;
  explanation: string;
  suggestedRewrite: string;
  foundBy: "ai" | "code";
};

export type RuleStatus = {
  ruleId: string;
  ruleName: string;
  status: "no_issues" | "not_checked";
  note?: string;
};

export type Report = {
  packLabel: string;
  packVersion: string;
  flags: Flag[];
  ruleStatuses: RuleStatus[];
  droppedAiFlags: number;
};

export type CheckResponse =
  | { status: "ok"; report: Report }
  | { status: "needs_text" | "error"; message: string };

export type ReadImageResponse =
  | { status: "ok"; text: string }
  | { status: "needs_text" | "error"; message: string };
