import { describe, expect, it } from "vitest";
import { findBareAdditives } from "../lib/additives";
import { checkCodeRules } from "../lib/codeRules";
import { factFields, factProblem } from "../lib/fillIn";
import { fixAll } from "../lib/fixAll";
import { checkFssaiNumber } from "../lib/fssaiNumber";
import { checkBarcode, findBarcodes } from "../lib/gs1";
import { listingAttributes, listingCopyProblems, listingCsv } from "../lib/listing";
import { printSizes } from "../lib/pdp";
import { CATEGORIES, getMarket, layersFor } from "../lib/rulepacks";
import { wordDiff } from "../lib/wordDiff";
import type { Report } from "../lib/types";

const now = new Date("2026-10-23");
const india = getMarket("india")!;
const us = getMarket("us")!;
const general = CATEGORIES[0];
const imported = CATEGORIES.find((c) => c.id === "imported")!;

function codeFlags(text: string, market = india, packType: "single" | "multi" = "single", category = general) {
  const context = { nutrientClaims: market.pack.nutrientClaims, nutrientBasis: market.pack.nutrientBasis, categoryId: category.id };
  return layersFor(market, [], category, packType).flatMap((l) => checkCodeRules(text, l.rules, l.channels, context));
}

describe("PDP area and minimum print sizes", () => {
  it("India: a 12 × 18 cm pouch is 216 cm², so numerals are 2 mm (4 mm blown)", () => {
    const s = printSizes("india", { shape: "rect", unit: "cm", width: 12, height: 18 });
    expect(s.area).toBe(216);
    expect(s.areaUnit).toBe("cm²");
    expect(s.specs[0].minimum).toContain("2 mm high (4 mm if blown");
    expect(s.specs[1].minimum).toContain("4 mm per side");
  });

  it("India bands: ≤100 → 1 mm, >2500 → 6 mm", () => {
    expect(printSizes("india", { shape: "custom", unit: "cm", width: 80, height: 0 }).specs[0].minimum).toMatch(/^1 mm/);
    expect(printSizes("india", { shape: "custom", unit: "cm", width: 3000, height: 0 }).specs[0].minimum).toMatch(/^6 mm/);
  });

  it("US: a 4 × 6 in box is 24 in², so type is 1/8 in (3.2 mm)", () => {
    const s = printSizes("us", { shape: "rect", unit: "in", width: 4, height: 6 });
    expect(s.area).toBe(24);
    expect(s.specs[0].minimum).toBe("1/8 in (3.2 mm) high");
    expect(s.specs[0].citation).toBe("21 CFR 101.105(i)");
  });

  it("US bands and unit conversion: a cylinder uses 40% of height × circumference", () => {
    // 3 in diameter × 5 in high: 0.4 × 5 × π × 3 ≈ 18.8 in² → 1/8 in.
    const s = printSizes("us", { shape: "cylinder", unit: "in", width: 3, height: 5 });
    expect(s.area).toBeCloseTo(18.8, 1);
    expect(s.specs[0].minimum).toContain("1/8 in");
    // 30 × 40 cm ≈ 186 in² → 1/4 in; > 400 in² → 1/2 in.
    expect(printSizes("us", { shape: "rect", unit: "cm", width: 30, height: 40 }).specs[0].minimum).toContain("1/4 in");
    expect(printSizes("us", { shape: "custom", unit: "in", width: 500, height: 0 }).specs[0].minimum).toContain("1/2 in");
    expect(printSizes("us", { shape: "custom", unit: "in", width: 4, height: 0 }).specs[0].minimum).toContain("1/16 in");
  });
});

describe("FSSAI 14-digit structure", () => {
  it("accepts real-looking FoSCoS numbers", () => {
    expect(checkFssaiNumber("10021022000145", { now })).toMatchObject({ ok: true, central: true, year: 21 });
    expect(checkFssaiNumber("11223334000567", { now })).toMatchObject({ ok: true, central: false, stateCode: "12", year: 23 });
    expect(checkFssaiNumber("11523999000123", { now }).ok).toBe(true);
  });

  it("rejects dummy numbers, bad type digits, state codes and future years", () => {
    expect(checkFssaiNumber("12345678901234", { now })).toMatchObject({ ok: false, problem: expect.stringMatching(/dummy/) });
    expect(checkFssaiNumber("10000000000000", { now })).toMatchObject({ ok: false, problem: expect.stringMatching(/dummy/) });
    expect(checkFssaiNumber("31523999000123", { now })).toMatchObject({ ok: false, problem: expect.stringMatching(/first digit/) });
    expect(checkFssaiNumber("15523999000123", { now })).toMatchObject({ ok: false, problem: expect.stringMatching(/state/) });
    expect(checkFssaiNumber("11529999000123", { now })).toMatchObject({ ok: false, problem: expect.stringMatching(/year/) });
    expect(checkFssaiNumber("1152399900012", { now })).toMatchObject({ ok: false, problem: expect.stringMatching(/14 digits/) });
  });

  it("imported food needs a Central Licence (starts with 100)", () => {
    expect(checkFssaiNumber("11523999000123", { now, needsCentral: true }).ok).toBe(false);
    expect(checkFssaiNumber("10021022000145", { now, needsCentral: true }).ok).toBe(true);
  });

  it("is flagged on the label, and dummy numbers are left to the placeholder rule", () => {
    const flags = codeFlags("Masala makhana. FSSAI Lic. No. 15523999000123");
    expect(flags.find((f) => f.ruleId === "IN-FSSAI-LIC-FMT")?.quotedText).toBe("15523999000123");
    const dummy = codeFlags("Masala makhana. FSSAI Lic. No. 12345678901234");
    expect(dummy.some((f) => f.ruleId === "IN-FSSAI-LIC-FMT")).toBe(false);
    expect(dummy.some((f) => f.ruleId === "IN-FSSAI-PH")).toBe(true);
    const importedFlags = codeFlags("Olive oil. FSSAI Lic. No. 11523999000123", india, "single", imported);
    expect(importedFlags.some((f) => f.ruleId === "IN-FSSAI-LIC-FMT")).toBe(true);
  });

  it("validates the number typed into the fill-in form", () => {
    const [field] = factFields("FSSAI Lic. No.: [14-digit licence number]");
    expect(factProblem(field, "12345")).toMatch(/14 digits/);
    expect(factProblem(field, "12345678901234")).toMatch(/dummy/);
    expect(factProblem(field, "15523999000123")).toMatch(/state/);
    expect(factProblem(field, "10021022000145")).toBeNull();
  });
});

describe("GS1 barcode check digit", () => {
  it("checks EAN-13 and UPC-A, and names the GS1 prefix", () => {
    expect(checkBarcode("8901234567890")).toMatchObject({ format: "EAN-13", valid: true, prefix: "GS1 India" });
    expect(checkBarcode("8901234567891")).toMatchObject({ valid: false, expected: 0 });
    expect(checkBarcode("036000291452")).toMatchObject({ format: "UPC-A", valid: true, prefix: "GS1 US" });
    expect(checkBarcode("12345")).toBeNull();
  });

  it("finds barcodes on the label and flags a wrong check digit", () => {
    expect(findBarcodes("EAN 8901234567890").map((b) => b.check.code)).toEqual(["8901234567890"]);
    expect(findBarcodes("UPC: 0360 0029 1452").map((b) => b.check.valid)).toEqual([true]);
    const flag = codeFlags("Masala makhana. EAN 8901234567891").find((f) => f.ruleId === "GS1-CHK-001");
    expect(flag?.explanation).toContain("should be 0");
    expect(codeFlags("Granola. UPC 036000291452", us).some((f) => f.ruleId === "GS1-CHK-001")).toBe(false);
  });

  it("validates a barcode typed into the fill-in form", () => {
    const field = { token: "[barcode number]", label: "barcode number", kind: "barcode" as const };
    expect(factProblem(field, "8901234567891")).toMatch(/should be 0/);
    expect(factProblem(field, "8901234567890")).toBeNull();
  });
});

describe("Additive normalizer", () => {
  const text = "Biscuits. Ingredients: wheat flour, sugar, soy lecithin, citric acid, Emulsifier (INS 471), sodium bicarbonate (INS 500(ii)), salt";

  it("finds bare additives only", () => {
    const found = findBareAdditives(text);
    expect(found.map((a) => a.quote)).toEqual(["soy lecithin", "citric acid"]);
    expect(found[0].rewrite).toBe("Emulsifier (soy lecithin, INS 322(i))");
    expect(found[1].rewrite).toBe("Acidity regulator (INS 330)");
  });

  it("is flagged in India only, and Fix all rewrites it in place", () => {
    const flags = codeFlags(text).filter((f) => f.ruleId === "IN-FSSAI-ADD-001");
    expect(flags).toHaveLength(2);
    expect(codeFlags(text, us).some((f) => f.ruleId === "IN-FSSAI-ADD-001")).toBe(false);
    const fixed = fixAll(text, flags, null).fixedText;
    expect(fixed).toContain("sugar, Emulsifier (soy lecithin, INS 322(i)), Acidity regulator (INS 330), Emulsifier (INS 471)");
    expect(findBareAdditives(fixed)).toHaveLength(0);
  });
});

describe("Multi-pack / combo pack", () => {
  it("needs the N × quantity declaration only in multi-pack mode", () => {
    const label = "Masala makhana. Net quantity: 100 g";
    expect(codeFlags(label).some((f) => f.ruleId.startsWith("IN-LM-MULTI"))).toBe(false);
    const multi = codeFlags(label, india, "multi");
    expect(multi.map((f) => f.ruleId)).toEqual(expect.arrayContaining(["IN-LM-MULTI-001", "IN-LM-MULTI-002", "IN-LM-MULTI-003"]));
    expect(multi.find((f) => f.ruleId === "IN-LM-MULTI-002")?.confirmOnly).toBe(true);
    const declared = codeFlags("Masala makhana. Contents: 4 x 25 g = 100 g. Not for retail sale separately.", india, "multi");
    expect(declared.some((f) => f.ruleId === "IN-LM-MULTI-001" || f.ruleId === "IN-LM-MULTI-003")).toBe(false);
    expect(codeFlags("Protein bars. 6 bars, 1.4 oz (40 g) each", us, "multi").some((f) => f.ruleId === "US-FDA-MULTI-001")).toBe(false);
    expect(codeFlags("Protein bars. Net wt. 8.4 oz (240 g)", us, "multi").some((f) => f.ruleId === "US-FDA-MULTI-001")).toBe(true);
  });
});

describe("Listing pack", () => {
  const report = {
    market: "india",
    labelText:
      "Masala makhana. Veg. Net quantity: 80 g. MRP ₹99 (incl. of all taxes). Best before 4 months from manufacture.\nManufactured by: Good Snacks Pvt Ltd, Pune. Country of origin: India. Store in a cool, dry place.\nFSSAI Lic. No. 11523999000123 · EAN 8901234567890",
    allergenStatement: null,
    visual: null,
    barcodes: [checkBarcode("8901234567890")!],
    flags: [],
  } as unknown as Report;

  it("reads the onboarding attributes from the label", () => {
    const values = Object.fromEntries(listingAttributes(report).map((a) => [a.key, a.value]));
    expect(values).toMatchObject({
      net_quantity: "80 g",
      shelf_life: "4 months (about 120 days)",
      veg_type: "Vegetarian",
      fssai_licence: "11523999000123",
      manufacturer: "Good Snacks Pvt Ltd, Pune",
      country_of_origin: "India",
      storage: "Store in a cool, dry place",
      mrp: "₹99 (incl. of all taxes)",
      gtin: "8901234567890",
    });
    expect(listingCsv("T", ["a"], listingAttributes(report)).split("\n")[0]).toContain('"net_quantity"');
  });

  it("drops listing lines that repeat a flagged claim or a disease word", () => {
    expect(listingCopyProblems("Helps manage diabetes", [], [])).toBe(true);
    expect(listingCopyProblems("Supports healthy blood sugar", ["Supports healthy blood sugar"], [])).toBe(true);
    expect(listingCopyProblems("100% natural crunch", [], ["natural"])).toBe(true);
    expect(listingCopyProblems("Roasted fox nuts with Indian spices", [], ["natural"])).toBe(false);
  });
});

describe("Word diff", () => {
  it("marks removed and added words", () => {
    const d = wordDiff("High protein bar that helps manage diabetes.", "High protein bar for an active day.");
    expect(d.before.filter((p) => p.change === "removed").map((p) => p.text.trim())).toEqual(["that helps manage diabetes."]);
    expect(d.after.filter((p) => p.change === "added").map((p) => p.text.trim())).toEqual(["for an active day."]);
    expect(d.before.map((p) => p.text).join("")).toBe("High protein bar that helps manage diabetes.");
  });
});
