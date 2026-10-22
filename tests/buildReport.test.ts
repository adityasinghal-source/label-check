import { describe, expect, it } from "vitest";
import { checkAllergens } from "../lib/allergens";
import { buildReport } from "../lib/buildReport";
import { noIssuesHeading } from "../lib/messages";
import { getRulePack } from "../lib/rulepacks";
import type { Flag } from "../lib/types";

const us = getRulePack("us-fda")!;
const aiFlag: Flag = {
  ruleId: "US-FDA-DC-001",
  ruleName: "Disease claim",
  citation: "x",
  severity: "high",
  quotedText: "helps manage diabetes",
  explanation: "Remove this so the label is compliant.",
  suggestedRewrite: "A satisfying high protein bar",
  foundBy: "ai",
};

describe("buildReport", () => {
  it("shows the pack version and lists unflagged rules as no issues found", () => {
    const report = buildReport(us, [], checkAllergens("Bar. Ingredients: oats, dates", us), 0);
    expect(report.packVersion).toBe("0.1");
    expect(noIssuesHeading(report.packVersion)).toBe("No issues found against rule pack v0.1");
    expect(report.ruleStatuses.map((r) => [r.ruleId, r.status])).toEqual([
      ["US-FDA-DC-001", "no_issues"],
      ["US-FDA-ALG-001", "no_issues"],
    ]);
  });

  it("lists the allergens that came back clean even when others are flagged", () => {
    const label = "Bar. Ingredients: oats, whey protein concentrate, dates, almonds";
    const report = buildReport(us, [aiFlag], checkAllergens(label, us), 0);
    const allergenStatus = report.ruleStatuses.find((r) => r.ruleId === "US-FDA-ALG-001")!;
    expect(allergenStatus.status).toBe("no_issues");
    expect(allergenStatus.note).toContain("egg");
    expect(allergenStatus.note).not.toContain("milk");
    expect(allergenStatus.note).not.toContain("tree nuts");
  });

  it("marks the allergen rule as not checked when there is no ingredient list", () => {
    const report = buildReport(us, [aiFlag], checkAllergens("Bar that helps manage diabetes", us), 0);
    expect(report.ruleStatuses).toEqual([
      { ruleId: "US-FDA-ALG-001", ruleName: us.rules[1].name, status: "not_checked", note: "No ingredient list found" },
    ]);
  });

  it("never contains the word compliant", () => {
    const report = buildReport(us, [aiFlag], checkAllergens("Ingredients: whey", us), 2);
    expect(JSON.stringify(report).toLowerCase()).not.toContain("compliant");
    expect(report.droppedAiFlags).toBe(2);
  });
});
