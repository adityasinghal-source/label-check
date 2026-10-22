import { describe, expect, it } from "vitest";
import { checkAllergens } from "../lib/allergens";
import { buildReport } from "../lib/buildReport";
import { checkCodeRules, findPlaceholders } from "../lib/codeRules";
import { factFields, factProblem, fillFacts } from "../lib/fillIn";
import { fixAll } from "../lib/fixAll";
import { highlightSegments } from "../lib/highlight";
import { checkNutrientClaims } from "../lib/nutrition";
import { reportSummary } from "../lib/reportSummary";
import { CHANNELS, getCategory, getMarket, layersFor } from "../lib/rulepacks";
import { readiness } from "../lib/summary";
import type { Flag, VisualFindings } from "../lib/types";

const INPUT_A =
  "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds";
const INPUT_B =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";

const diseaseFlag: Flag = {
  ruleId: "US-FDA-DC-001",
  ruleName: "Disease claim",
  citation: "x",
  source: { label: "x", url: "https://example.com" },
  verified: true,
  severity: "high",
  quotedText: "helps manage diabetes",
  explanation: "",
  suggestedRewrite: "High protein bar for an active lifestyle",
  fix: { type: "rewrite" },
  foundBy: "ai",
  channels: [],
};

// The same layers and context the check route uses, without the AI.
function reportFor(text: string, marketId: string, channelIds: string[] = [], aiFlags: Flag[] = [], categoryId = "general", visual: VisualFindings | null = null) {
  const market = getMarket(marketId)!;
  const channels = CHANNELS.filter((c) => channelIds.includes(c.id));
  const category = getCategory(categoryId);
  const context = { nutrientClaims: market.pack.nutrientClaims, nutrientBasis: market.pack.nutrientBasis, visual };
  return buildReport({
    market,
    channels,
    category,
    visual,
    labelText: text,
    aiFlags,
    allergens: checkAllergens(text, market.pack),
    codeFlags: layersFor(market, channels, category).flatMap((l) => checkCodeRules(text, l.rules, l.channels, context)),
    droppedAiFlags: 0,
  });
}
const ids = (flags: Flag[]) => flags.map((f) => f.ruleId);

describe("readiness summary", () => {
  it("says not ready to print when anything is high-risk", () => {
    const r = reportFor(INPUT_A, "us", [], [diseaseFlag]);
    const summary = readiness(r.flags, r.packVersion);
    expect(summary.tone).toBe("red");
    expect(summary.verdict).toBe("Not ready to print");
    expect(summary.counts).toMatch(/^\d+ high-risk/);
  });

  it("doesn't count things to confirm with a channel", () => {
    const r = reportFor("Granola. Ingredients: oats", "india", ["zepto"]);
    const confirms = r.flags.filter((f) => f.confirmOnly).length;
    expect(confirms).toBeGreaterThan(0);
    const counted = r.flags.length - confirms;
    const total = readiness(r.flags, r.packVersion).counts.match(/\d+/g)!.map(Number).reduce((a, b) => a + b, 0);
    expect(total).toBe(counted);
  });

  it("never says compliant, even with nothing flagged", () => {
    const r = readiness([], "0.1");
    expect(r.verdict).toBe("No issues found against rule pack v0.1");
    expect(JSON.stringify(r).toLowerCase()).not.toContain("compliant");
  });
});

describe("minimum completeness", () => {
  it("flags every missing US element on a one-line label", () => {
    const flags = reportFor("Granola bar", "us").flags;
    expect(ids(flags)).toEqual(expect.arrayContaining(["US-FDA-NET-001", "US-FDA-ING-001", "US-FDA-NUT-001", "US-FDA-MFR-001"]));
  });

  it("flags every missing India element on a one-line label", () => {
    const flags = reportFor("Masala makhana", "india").flags;
    expect(ids(flags)).toEqual(
      expect.arrayContaining(["IN-FSSAI-ING", "IN-FSSAI-NUT", "IN-FSSAI-VEG", "IN-FSSAI-LIC", "IN-LM-NET", "IN-LM-MRP", "IN-LM-CARE", "IN-LM-ORIGIN", "IN-LM-DATE", "IN-LM-MFD"]),
    );
  });

  it("needs net quantity in both US and metric units", () => {
    const ok = (t: string) => !ids(checkCodeRules(t, getMarket("us")!.pack.rules)).includes("US-FDA-NET-001");
    expect(ok("Net wt. 1.4 oz (40 g)")).toBe(true);
    expect(ok("Net wt. 40 g")).toBe(false);
  });

  it("wants 'inclusive of all taxes' only when an MRP is printed", () => {
    const rules = getMarket("india")!.pack.rules;
    expect(ids(checkCodeRules("Snack. MRP ₹99", rules))).toContain("IN-LM-MRP-TAX");
    expect(ids(checkCodeRules("Snack. MRP ₹99 (incl. of all taxes)", rules))).not.toContain("IN-LM-MRP-TAX");
    expect(ids(checkCodeRules("Snack", rules))).not.toContain("IN-LM-MRP-TAX");
  });

  it("lets a photo of the veg mark satisfy the veg rule", () => {
    expect(ids(reportFor("Masala makhana", "india", [], [], "general", { vegMark: true }).flags)).not.toContain("IN-FSSAI-VEG");
  });
});

describe("placeholders", () => {
  it("finds bracketed, X-ed out and dummy values", () => {
    expect(findPlaceholders("FSSAI Lic. No.: [14-digit licence number]. MRP XXXX. Lic 12345678901234. Care: TBD")).toEqual([
      "[14-digit licence number]",
      "XXXX",
      "12345678901234",
      "TBD",
    ]);
  });

  it("never lets a Fix all placeholder pass the next check", () => {
    const r = reportFor("Masala makhana. Ingredients: fox nuts, salt", "india");
    const fixed = fixAll(r.labelText, r.flags, r.allergenStatement).fixedText;
    const again = reportFor(fixed, "india");
    expect(ids(again.flags)).toContain("IN-FSSAI-PH");
    expect(readiness(again.flags, again.packVersion).verdict).toBe("Not ready to print");
  });

  it("fills real values in and checks them", () => {
    const fields = factFields("FSSAI Lic. No.: [14-digit licence number]\nCustomer care: [customer care phone] | [customer care email]");
    expect(fields.map((f) => f.kind)).toEqual(["fssai", "phone", "email"]);
    expect(factProblem(fields[0], "123")).toMatch(/14 digits/);
    expect(factProblem(fields[0], "12345678901234")).toMatch(/dummy/);
    expect(factProblem(fields[0], "10012345678901")).toBeNull();
    const filled = fillFacts("FSSAI Lic. No.: [14-digit licence number]", fields, { "[14-digit licence number]": "10012345678901" });
    expect(filled).toBe("FSSAI Lic. No.: 10012345678901");
  });
});

describe("nutrient claims", () => {
  const us = getMarket("us")!.pack;
  it("flags a claim with no nutrition line (HIGH)", () => {
    const flags = reportFor(INPUT_A, "us").flags.filter((f) => f.ruleId === "US-FDA-NC-001");
    expect(flags.map((f) => [f.quotedText, f.severity])).toEqual([["High protein", "high"]]);
  });

  it("checks the value against the FDA threshold per serving", () => {
    const low = "Protein bar. High protein! Ingredients: oats.\nNutrition Facts: Protein 6 g";
    expect(checkNutrientClaims(low, us.nutrientClaims).map((c) => c.meets)).toEqual([false]);
    expect(ids(reportFor(low, "us").flags)).toContain("US-FDA-NC-002");
    const ok = low.replace("6 g", "12 g");
    expect(ids(reportFor(ok, "us").flags)).not.toContain("US-FDA-NC-002");
  });

  it("reads mg and g and doesn't mistake trans fat for total fat", () => {
    const text = "Chips. Low sodium, low fat.\nNutrition Facts: Total Fat 2 g, Trans Fat 0 g, Sodium 0.1 g";
    expect(checkNutrientClaims(text, us.nutrientClaims).map((c) => [c.claim.claim, c.meets])).toEqual([
      ["Low fat", true],
      ["Low sodium", true],
    ]);
  });

  it("marks the India thresholds as unverified", () => {
    expect(getMarket("india")!.pack.rules.find((r) => r.id === "IN-FSSAI-NC-002")!.verified).toBe(false);
  });
});

describe("categories", () => {
  it("needs NOT FOR MEDICINAL USE on Indian supplements", () => {
    expect(ids(reportFor("Ashwagandha tablets", "india", [], [], "supplements").flags)).toContain("IN-FSSAI-HS-001");
    expect(ids(reportFor("Ashwagandha tablets", "india").flags)).not.toContain("IN-FSSAI-HS-001");
  });

  it("needs the DSHEA disclaimer on US supplements with a structure/function claim", () => {
    const text = "Magnesium capsules. Supports restful sleep.";
    expect(ids(reportFor(text, "us", [], [], "supplements").flags)).toContain("US-FDA-DS-001");
    const ok = `${text} *These statements have not been evaluated by the Food and Drug Administration.`;
    expect(ids(reportFor(ok, "us", [], [], "supplements").flags)).not.toContain("US-FDA-DS-001");
  });

  it("needs importer details on imported food in India", () => {
    expect(ids(reportFor("Italian pasta", "india", [], [], "imported").flags)).toContain("IN-LM-IMP-001");
  });
});

describe("quick-commerce onboarding", () => {
  it("checks barcode, clear shelf life and full customer care on quick-commerce channels only", () => {
    const flags = reportFor("Masala makhana. Customer care: 1800 123 4567", "india", ["blinkit", "amazon-in"]).flags;
    const qc = flags.filter((f) => f.ruleId.startsWith("QC-"));
    expect(ids(qc)).toEqual(["QC-002", "QC-001", "QC-003"].sort((a, b) => ids(qc).indexOf(a) - ids(qc).indexOf(b)));
    expect(qc.every((f) => f.channels.join() === "blinkit" && !f.verified)).toBe(true);
  });

  it("doesn't mistake an FSSAI number for a phone number", () => {
    const text = "Snack. FSSAI Lic. No. 10012345678901. care@brand.in";
    expect(ids(reportFor(text, "india", ["zepto"]).flags)).toContain("QC-003");
  });
});

describe("highlightSegments", () => {
  it("splits the label into plain text and flagged phrases", () => {
    const segments = highlightSegments(INPUT_A, [diseaseFlag]);
    expect(segments.map((s) => [s.text, s.flagIndexes])).toEqual([
      ["High protein bar that ", []],
      ["helps manage diabetes", [0]],
      [". Ingredients: oats, whey protein concentrate, dates, almonds", []],
    ]);
  });

  it("puts every character back together in order", () => {
    const r = reportFor(INPUT_B, "us", ["amazon-us"]);
    expect(highlightSegments(INPUT_B, r.flags).map((s) => s.text).join("")).toBe(INPUT_B);
  });
});

describe("fixAll", () => {
  it("applies the rewrite, adds the allergen line and fill-in lines (Input A, US)", () => {
    const r = reportFor(INPUT_A, "us", [], [diseaseFlag]);
    const result = fixAll(r.labelText, r.flags, r.allergenStatement);
    expect(result.fixedText.startsWith(
      "High protein bar for an active lifestyle. Ingredients: oats, whey protein concentrate, dates, almonds\nContains: Milk, Tree Nuts (Almonds).",
    )).toBe(true);
    expect(result.fixedText).toContain("Net wt. [ounces] oz ([grams] g)");
    expect(ids(result.needsYou)).toEqual(expect.arrayContaining(["US-FDA-NUT-001", "US-FDA-NC-001"]));
  });

  it("removes the blood sugar sentence for Amazon US (Input B)", () => {
    const r = reportFor(INPUT_B, "us", ["amazon-us"]);
    const fixed = fixAll(r.labelText, r.flags, r.allergenStatement).fixedText;
    expect(fixed).not.toContain("blood sugar");
    expect(fixed).toContain("Contains: Milk, Peanuts.");
  });

  it("replaces an existing Contains line instead of adding a second one", () => {
    const text = "Bar. Ingredients: whey, almonds\nContains: Almonds.";
    const r = reportFor(text, "us");
    const fixed = fixAll(text, r.flags, r.allergenStatement).fixedText;
    expect(fixed.match(/Contains:/g)).toHaveLength(1);
    expect(fixed).toContain("Contains: Milk, Tree Nuts (Almonds).");
  });
});

describe("report summary", () => {
  it("lists the verdict, channels and fixes in plain text, never 'compliant'", () => {
    const r = reportFor(INPUT_B, "india", ["blinkit", "flipkart-minutes"]);
    const text = reportSummary(r);
    expect(text).toMatch(/^ShelfReady audit: Not ready to print/);
    expect(text).toContain("- Blinkit:");
    expect(text).toContain("IN-LM-MRP");
    expect(text.toLowerCase()).not.toMatch(/\bcompliant\b/);
  });
});
