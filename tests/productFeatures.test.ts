import { describe, expect, it } from "vitest";
import { checkAllergens } from "../lib/allergens";
import { buildReport } from "../lib/buildReport";
import { checkCodeRules } from "../lib/codeRules";
import { fixAll } from "../lib/fixAll";
import { highlightSegments } from "../lib/highlight";
import { CHANNELS, getMarket } from "../lib/rulepacks";
import { readiness } from "../lib/summary";
import type { Flag } from "../lib/types";

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

function reportFor(text: string, marketId: string, channelIds: string[] = [], aiFlags: Flag[] = []) {
  const market = getMarket(marketId)!;
  const channels = CHANNELS.filter((c) => channelIds.includes(c.id));
  return buildReport({
    market,
    channels,
    labelText: text,
    aiFlags,
    allergens: checkAllergens(text, market.pack),
    codeFlags: [
      ...checkCodeRules(text, market.pack.rules),
      ...channels.flatMap((c) => checkCodeRules(text, c.rules, [c.id])),
    ],
    droppedAiFlags: 0,
  });
}

describe("readiness summary", () => {
  it("says not ready to print when anything is high-risk", () => {
    const r = reportFor(INPUT_A, "us", [], [diseaseFlag]);
    expect(readiness(r.flags, r.packVersion)).toEqual({ tone: "red", verdict: "Not ready to print", counts: "2 high-risk, 1 low" });
  });

  it("doesn't count things to confirm with a channel", () => {
    const r = reportFor("Granola. Ingredients: oats", "india", ["zepto"]);
    expect(r.flags.some((f) => f.confirmOnly)).toBe(true);
    expect(readiness(r.flags, r.packVersion).counts).not.toMatch(/low/);
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
    const r = reportFor(INPUT_B, "us", ["amazon-us"]);
    expect(highlightSegments(INPUT_B, r.flags).map((s) => s.text).join("")).toBe(INPUT_B);
  });
});

describe("fixAll", () => {
  it("applies the rewrite and adds the allergen line (Input A, US)", () => {
    const r = reportFor(INPUT_A, "us", [], [diseaseFlag]);
    const result = fixAll(r.labelText, r.flags, r.allergenStatement);
    expect(result.fixedText).toBe(
      "High protein bar for an active lifestyle. Ingredients: oats, whey protein concentrate, dates, almonds\nContains: Milk, Tree Nuts (Almonds).",
    );
    expect(result.needsYou).toEqual([]);
  });

  it("removes the blood sugar sentence for Amazon US (Input B)", () => {
    const r = reportFor(INPUT_B, "us", ["amazon-us"]);
    expect(fixAll(r.labelText, r.flags, r.allergenStatement).fixedText).toBe(
      "Gluten-free granola bites. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt\nContains: Milk, Peanuts.",
    );
  });

  it("replaces an existing Contains line instead of adding a second one", () => {
    const text = "Bar. Ingredients: whey, almonds\nContains: Almonds.";
    const r = reportFor(text, "us");
    expect(fixAll(text, r.flags, r.allergenStatement).fixedText).toBe("Bar. Ingredients: whey, almonds\nContains: Milk, Tree Nuts (Almonds).");
  });

  it("adds placeholders for missing Indian declarations and leaves the veg mark to the user", () => {
    const r = reportFor(INPUT_B, "india", ["blinkit"]);
    const result = fixAll(r.labelText, r.flags, r.allergenStatement);
    for (const line of ["FSSAI Lic. No.:", "Net quantity:", "MRP ₹", "Best before:", "Manufactured by:"]) {
      expect(result.fixedText).toContain(line);
    }
    expect(result.needsYou.map((f) => f.ruleId)).toEqual(["IN-FSSAI-VEG"]);
  });
});
