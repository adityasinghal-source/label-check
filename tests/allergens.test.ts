import { describe, expect, it } from "vitest";
import { checkAllergens } from "../lib/allergens";
import { getRulePack } from "../lib/rulepacks";

const us = getRulePack("us-fda")!;
const fssai = getRulePack("fssai")!;
const BAR =
  "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate, dates, almonds";

describe("checkAllergens", () => {
  it("flags whey as milk and almonds as tree nuts on the test label (US)", () => {
    const result = checkAllergens(BAR, us);
    expect(result.checked).toBe(true);
    expect(result.flags.map((f) => [f.ruleId, f.quotedText])).toEqual([
      ["US-FDA-ALG-001", "whey protein concentrate"],
      ["US-FDA-ALG-001", "almonds"],
    ]);
    expect(result.flags[0].explanation).toContain("milk");
    expect(result.flags[1].explanation).toContain("tree nuts");
    expect(result.flags[0].suggestedRewrite).toBe("Contains: Milk, Tree nuts (almonds).");
  });

  it("also flags oats as gluten under FSSAI, but not under US", () => {
    const quotes = checkAllergens(BAR, fssai).flags.map((f) => f.quotedText);
    expect(quotes).toContain("oats");
    expect(checkAllergens(BAR, us).flags.map((f) => f.quotedText)).not.toContain("oats");
  });

  it("does not read peanut butter or almond milk as milk", () => {
    const flags = checkAllergens("Spread. Ingredients: peanut butter, almond milk, salt", us).flags;
    expect(flags.some((f) => f.explanation.includes("source of milk"))).toBe(false);
  });

  it("accepts allergens declared in brackets or a Contains line", () => {
    expect(checkAllergens("Bar. Ingredients: whey protein (milk), oats", us).flags).toEqual([]);
    expect(
      checkAllergens("Bar. Ingredients: whey protein, almonds.\nContains: Milk, Almonds.", us).flags,
    ).toEqual([]);
  });

  it("says not checked when there is no ingredient list", () => {
    expect(checkAllergens("Crunchy high protein bar", us)).toEqual({ checked: false, flags: [], clear: [] });
  });
});
