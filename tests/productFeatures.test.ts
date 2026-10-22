import { describe, expect, it } from "vitest";
import { checkAllergens } from "../lib/allergens";
import { buildReport } from "../lib/buildReport";
import { checkCodeRules } from "../lib/codeRules";
import { onlyIn } from "../lib/compare";
import { fixAll } from "../lib/fixAll";
import { highlightSegments } from "../lib/highlight";
import { getRulePack } from "../lib/rulepacks";
import { readiness } from "../lib/summary";
import type { Flag, RulePack } from "../lib/types";

const INPUT_A =
  "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds";
const INPUT_B =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";

const diseaseFlag: Flag = {
  ruleId: "US-FDA-DC-001",
  ruleName: "Disease claim",
  citation: "x",
  severity: "high",
  quotedText: "helps manage diabetes",
  explanation: "",
  suggestedRewrite: "High protein bar for an active lifestyle",
  fix: { type: "rewrite" },
  foundBy: "ai",
};

function reportFor(text: string, pack: RulePack, aiFlags: Flag[] = []) {
  return buildReport({
    pack,
    labelText: text,
    aiFlags,
    allergens: checkAllergens(text, pack),
    codeFlags: checkCodeRules(text, pack),
    droppedAiFlags: 0,
  });
}

describe("readiness summary", () => {
  it("says not ready to print when anything is high-risk", () => {
    const r = reportFor(INPUT_A, getRulePack("us-fda")!, [diseaseFlag]);
    expect(readiness(r.flags, r.packVersion)).toEqual({ tone: "red", verdict: "Not ready to print", counts: "2 high-risk, 1 low" });
  });

  it("never says compliant, even with nothing flagged", () => {
    const r = readiness([], "0.1");
    expect(r.verdict).toBe("No issues found against rule pack v0.1");
    expect(JSON.stringify(r).toLowerCase()).not.toContain("compliant");
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
    const r = reportFor(INPUT_B, getRulePack("amazon-us")!);
    expect(highlightSegments(INPUT_B, r.flags).map((s) => s.text).join("")).toBe(INPUT_B);
  });
});

describe("fixAll", () => {
  it("applies the rewrite and adds the allergen line (Input A, FDA)", () => {
    const r = reportFor(INPUT_A, getRulePack("us-fda")!, [diseaseFlag]);
    const result = fixAll(r.labelText, r.flags, r.allergenStatement);
    expect(result.fixedText).toBe(
      "High protein bar for an active lifestyle. Ingredients: oats, whey protein concentrate, dates, almonds\nContains: Milk, Tree Nuts (Almonds).",
    );
    expect(result.needsYou).toEqual([]);
  });

  it("removes the blood sugar sentence for Amazon (Input B)", () => {
    const r = reportFor(INPUT_B, getRulePack("amazon-us")!);
    expect(fixAll(r.labelText, r.flags, r.allergenStatement).fixedText).toBe(
      "Gluten-free granola bites. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt\nContains: Milk, Peanuts.",
    );
  });

  it("replaces an existing Contains line instead of adding a second one", () => {
    const text = "Bar. Ingredients: whey, almonds\nContains: Almonds.";
    const r = reportFor(text, getRulePack("us-fda")!);
    expect(fixAll(text, r.flags, r.allergenStatement).fixedText).toBe("Bar. Ingredients: whey, almonds\nContains: Milk, Tree Nuts (Almonds).");
  });

  it("adds a licence placeholder for Blinkit and leaves 'natural' for the user", () => {
    const text = "All natural granola. Ingredients: oats";
    const r = reportFor(text, getRulePack("blinkit-in")!);
    const result = fixAll(text, r.flags, r.allergenStatement);
    expect(result.fixedText).toContain("FSSAI Lic. No.: [your 14-digit licence number]");
    expect(result.needsYou.map((f) => f.ruleId)).toEqual(["BLK-IN-002"]);
  });
});

describe("compare markets", () => {
  it("shows what only one market flags", () => {
    const us = reportFor(INPUT_B, getRulePack("amazon-us")!);
    const india = reportFor(INPUT_B, getRulePack("fssai")!);
    expect(onlyIn(us, india).map((f) => f.ruleId)).toEqual(["AMZ-US-001"]);
    // Peanut butter is flagged in both markets, so only the oats (gluten, under FSSAI) are India-only.
    expect(onlyIn(india, us).map((f) => [f.ruleId, f.quotedText])).toEqual([["FSSAI-ALG-001", "rolled oats"]]);
  });
});
