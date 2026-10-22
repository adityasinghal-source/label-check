export type Severity = "high" | "medium" | "low";

// How a code-checked rule finds its problem in the label text.
export type RuleMatch =
  // "present": flag each sentence that uses a listed word (outside the ingredient list).
  | { when: "present"; words?: string[]; regex?: string }
  // "absent": flag once when a required declaration is missing from the label
  // (only when `onlyIf` matches, if given — e.g. a tax phrase only matters when an MRP is printed).
  | { when: "absent"; regex: string; onlyIf?: string }
  // "placeholder": flag every unfilled placeholder ([MRP], XXXXXXXX, 12345678901234…).
  | { when: "placeholder" }
  // Nutrient content claims ("High protein") checked against the nutrition table:
  // "nutrient_backing" = the claimed nutrient has no line in the table; "nutrient_threshold" = its value misses the threshold.
  | { when: "nutrient_backing" }
  | { when: "nutrient_threshold" }
  // "shelf_life": read the declared best-before period and flag it if it is shorter than minDays.
  | { when: "shelf_life"; minDays: number }
  // "confirm": can't be judged from label text; always listed as something to confirm.
  | { when: "confirm" };

// How "Fix all" handles a flag from a code-checked rule.
export type RuleFix =
  | { type: "remove_sentence" }
  | { type: "append_line"; line: string }
  // A placeholder the user fills in through Fix all's "Fill missing label facts" form.
  | { type: "fill_in" }
  | { type: "manual" };

export type Source = { label: string; url: string };

export type Rule = {
  id: string;
  name: string;
  severity: Severity;
  checkedBy: "ai" | "code";
  citation: string;
  source: Source;
  // false when the rule comes only from second-hand sources (guides, forums). Shown as "Unverified".
  verified: boolean;
  aiGuidance?: string;
  match?: RuleMatch;
  // A symbol a photo can show (veg mark, barcode): when vision saw it, the rule passes.
  visualKey?: keyof VisualFindings;
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

// A nutrient content claim and the threshold it must meet ("High protein" → protein ≥ 10 g).
export type NutrientClaim = {
  claim: string;
  pattern: string;
  nutrient: "protein" | "fiber" | "fat" | "sugar" | "transFat" | "sodium";
  op: "min" | "max" | "lt";
  value: number;
  unit: "g" | "mg";
};

// What vision saw on uploaded artwork. Undefined = no photo, so nothing is assumed.
export type VisualFindings = { vegMark?: boolean; fssaiLogo?: boolean; barcode?: boolean };

// A market's base rules: claims (AI), allergens and label declarations (code).
export type RulePack = {
  id: string;
  label: string;
  version: string;
  allergenRuleId: string;
  // Optional low-severity rule for allergens already named by the ingredient itself.
  allergenAdviceRuleId?: string;
  // Rule raised when the AI finds no product name (statement of identity).
  identityRuleId?: string;
  // Thresholds are per serving (US, RACC) or per 100 g / 100 ml (India).
  nutrientBasis: string;
  nutrientClaims: NutrientClaim[];
  // Things only the printed artwork can show; listed for the user to confirm.
  visualChecklist: string[];
  rules: Rule[];
  allergens: Allergen[];
};

// A product category adds rules per market (e.g. "NOT FOR MEDICINAL USE" on Indian supplements).
export type Category = { id: string; label: string; rules: Record<string, Rule[]> };

// A sales channel adds its own rules on top of its market's pack.
export type Channel = {
  id: string;
  label: string;
  market: string;
  version: string;
  // Shown when no public channel-specific rules were found.
  note?: string;
  rules: Rule[];
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
  source: Source;
  verified: boolean;
  severity: Severity;
  // Empty for "missing" problems (e.g. no MRP), which have nothing to highlight.
  quotedText: string;
  explanation: string;
  suggestedRewrite: string;
  // Shown instead of a copyable rewrite when the fix is an action, not replacement text.
  advice?: string;
  fix?: RuleFix | { type: "rewrite" } | { type: "allergen_statement" };
  foundBy: "ai" | "code";
  // Channel IDs this flag applies to. Empty = the market's own rules, so every channel.
  channels: string[];
  // Can't be judged from the label: something to confirm before listing, not a label problem.
  confirmOnly?: boolean;
};

export type RuleStatus = {
  ruleId: string;
  ruleName: string;
  status: "no_issues" | "not_checked";
  note?: string;
};

export type Report = {
  market: string;
  packLabel: string;
  packVersion: string;
  category: { id: string; label: string };
  channels: { id: string; label: string; note?: string }[];
  visualChecklist: string[];
  visual: VisualFindings | null;
  labelText: string;
  flags: Flag[];
  ruleStatuses: RuleStatus[];
  // The correct allergen line for this label, or null when there is no ingredient list.
  allergenStatement: string | null;
  droppedAiFlags: number;
};

export type Explanation = {
  likelyCause: string;
  ruleIds: string[];
  evidenceQuote: string | null;
  fixSteps: string[];
  appealNote: string;
};

export type CheckResponse =
  | {
      status: "ok";
      report: Report | null;
      explanation: Explanation | null;
      // e.g. "Paste your label text to confirm the cause" when only a rejection was given.
      notice?: string;
    }
  | { status: "needs_text" | "error"; message: string };

export type PanelId = "front" | "back" | "nutrition";

export type ReadImageResponse =
  | { status: "ok"; text: string; panels: Partial<Record<PanelId, string>>; visual: VisualFindings }
  | { status: "needs_text" | "error"; message: string };
