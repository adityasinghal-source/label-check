import { describe, expect, it } from "vitest";
import { checkAllergens } from "../lib/allergens";
import { buildReport } from "../lib/buildReport";
import { noIssuesHeading } from "../lib/messages";
import { getMarket } from "../lib/rulepacks";
import type { Flag } from "../lib/types";

const usMarket = getMarket("us")!;
const us = usMarket.pack;
const aiFlag: Flag = {
  ruleId: "US-FDA-DC-001",
  ruleName: "Disease claim",
  citation: "x",
  source: { label: "x", url: "https://example.com" },
  verified: true,
  severity: "high",
  quotedText: "helps manage diabetes",
  explanation: "Remove this so the label is compliant.",
  suggestedRewrite: "A satisfying high protein bar",
  fix: { type: "rewrite" },
  foundBy: "ai",
  channels: [],
};

const report = (labelText: string, aiFlags: Flag[] = [], droppedAiFlags = 0) =>
  buildReport({ market: usMarket, labelText, aiFlags, allergens: checkAllergens(labelText, us), droppedAiFlags });

describe("buildReport", () => {
  it("shows the pack version and lists unflagged rules as no issues found", () => {
    const r = report("Bar. Ingredients: oats, dates");
    expect(r.packVersion).toBe("0.1");
    expect(noIssuesHeading(r.packVersion)).toBe("No issues found against rule pack v0.1");
    const status = (id: string) => r.ruleStatuses.find((s) => s.ruleId === id)?.status;
    expect(["US-FDA-DC-001", "US-FDA-ALG-001", "US-FDA-ALG-002"].map(status)).toEqual(["no_issues", "no_issues", "no_issues"]);
  });

  it("lists the allergens that came back clean even when others are flagged", () => {
    const r = report("Bar. Ingredients: oats, whey protein concentrate, dates, almonds", [aiFlag]);
    const allergenStatus = r.ruleStatuses.find((s) => s.ruleId === "US-FDA-ALG-001")!;
    expect(allergenStatus.status).toBe("no_issues");
    expect(allergenStatus.note).toContain("egg");
    expect(allergenStatus.note).not.toContain("milk");
    // "almonds" names the tree nut, so it is legally declared and only gets the low-severity advice flag.
    expect(allergenStatus.note).toContain("tree nuts");
    expect(r.flags.find((f) => f.quotedText === "almonds")?.ruleId).toBe("US-FDA-ALG-002");
  });

  it("sorts flags high to low, with source links, and carries the label and allergen line", () => {
    const label = "Bar that helps manage diabetes. Ingredients: almonds, whey";
    const r = report(label, [aiFlag]);
    expect(r.flags.map((f) => f.severity)).toEqual(["high", "high", "low"]);
    expect(r.flags.every((f) => f.source.url.startsWith("https://"))).toBe(true);
    expect(r.labelText).toBe(label);
    expect(r.allergenStatement).toBe("Contains: Milk, Tree Nuts (Almonds).");
  });

  it("marks the allergen rules as not checked when there is no ingredient list", () => {
    const r = report("Bar that helps manage diabetes", [aiFlag]);
    expect(r.ruleStatuses.filter((s) => s.status === "not_checked").map((s) => [s.ruleId, s.status, s.note])).toEqual([
      ["US-FDA-ALG-001", "not_checked", "No ingredient list found"],
      ["US-FDA-ALG-002", "not_checked", "No ingredient list found"],
    ]);
    expect(r.allergenStatement).toBeNull();
  });

  it("never contains the word compliant", () => {
    const r = report("Ingredients: whey", [aiFlag], 2);
    expect(JSON.stringify(r).toLowerCase()).not.toContain("compliant");
    expect(r.droppedAiFlags).toBe(2);
  });
});
