import { describe, expect, it } from "vitest";
import { getMarket } from "../lib/rulepacks";
import { validateFlags } from "../lib/validateFlags";

const us = getMarket("us")!.pack;
const LABEL = "High protein bar that helps manage diabetes. Ingredients: oats, whey protein concentrate";
const good = {
  rule_id: "US-FDA-DC-001",
  quoted_text: "helps manage diabetes",
  explanation: "Disease claim.",
  suggested_rewrite: "A satisfying high protein bar",
};

describe("validateFlags", () => {
  it("keeps a valid flag and takes severity and citation from the pack", () => {
    const { flags, dropped } = validateFlags([good], LABEL, us);
    expect(dropped).toBe(0);
    expect(flags[0]).toMatchObject({ ruleId: "US-FDA-DC-001", severity: "high", foundBy: "ai" });
    expect(flags[0].citation).toContain("101.93");
  });

  it("drops a flag with no rule ID", () => {
    const { flags, dropped } = validateFlags([{ ...good, rule_id: undefined }], LABEL, us);
    expect(flags).toEqual([]);
    expect(dropped).toBe(1);
  });

  it("drops a flag with an empty, unknown, other-pack or code-only rule ID", () => {
    const bad = ["", "US-FDA-XX-999", "FSSAI-DC-001", "US-FDA-ALG-001"].map((id) => ({ ...good, rule_id: id }));
    expect(validateFlags(bad, LABEL, us)).toEqual({ flags: [], dropped: 4 });
  });

  it("drops a flag whose quote is not in the label", () => {
    const invented = { ...good, quoted_text: "cures cancer" };
    expect(validateFlags([invented], LABEL, us).flags).toEqual([]);
  });

  it("ignores case and spacing differences in the quote", () => {
    const loose = { ...good, quoted_text: "Helps   manage Diabetes" };
    expect(validateFlags([loose], LABEL, us).flags).toHaveLength(1);
  });
});
