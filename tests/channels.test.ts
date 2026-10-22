import { describe, expect, it } from "vitest";
import { checkCodeRules } from "../lib/codeRules";
import { getRulePack, RULE_PACKS } from "../lib/rulepacks";

const INPUT_B =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";

describe("channel rule packs", () => {
  it("offers US (FDA), US · Amazon, India (FSSAI) and India · Blinkit", () => {
    expect(RULE_PACKS.map((p) => p.label)).toEqual(["US (FDA)", "US · Amazon", "India (FSSAI)", "India · Blinkit"]);
  });

  it("builds Amazon on top of the FDA pack", () => {
    const amazon = getRulePack("amazon-us")!;
    expect(amazon.basedOn).toBe("US (FDA) v0.1");
    expect(amazon.rules.map((r) => r.id)).toEqual(["US-FDA-DC-001", "US-FDA-ALG-001", "US-FDA-ALG-002", "AMZ-US-001"]);
    expect(amazon.allergens).toEqual(getRulePack("us-fda")!.allergens);
  });

  it("flags 'supports healthy blood sugar' on Amazon but not under plain FDA", () => {
    const amazonFlags = checkCodeRules(INPUT_B, getRulePack("amazon-us")!);
    expect(amazonFlags.map((f) => [f.ruleId, f.quotedText])).toEqual([["AMZ-US-001", "Supports healthy blood sugar"]]);
    expect(checkCodeRules(INPUT_B, getRulePack("us-fda")!)).toEqual([]);
  });

  it("ignores Amazon words inside the ingredient list", () => {
    expect(checkCodeRules("Energy bar. Ingredients: oats, glucose syrup", getRulePack("amazon-us")!)).toEqual([]);
  });

  it("flags a missing FSSAI licence number on Blinkit, and not when it's there", () => {
    const blinkit = getRulePack("blinkit-in")!;
    expect(checkCodeRules(INPUT_B, blinkit).map((f) => f.ruleId)).toEqual(["BLK-IN-001"]);
    expect(checkCodeRules(`${INPUT_B}\nFSSAI Lic. No. 10012345678901`, blinkit)).toEqual([]);
  });

  it("flags 'all natural' on Blinkit but not 'natural flavor' in the ingredients", () => {
    const flags = checkCodeRules("All natural granola. Ingredients: oats, natural flavor\nFSSAI 10012345678901", getRulePack("blinkit-in")!);
    expect(flags.map((f) => [f.ruleId, f.quotedText])).toEqual([["BLK-IN-002", "All natural granola"]]);
  });
});
