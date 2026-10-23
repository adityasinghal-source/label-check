import { describe, expect, it } from "vitest";
import { checkAllergens } from "../lib/allergens";
import { checkCodeRules, nutritionBasisOk } from "../lib/codeRules";
import { findFssaiNumbers } from "../lib/fssaiNumber";
import { CATEGORIES, getChannels, getMarket, layersFor } from "../lib/rulepacks";

// Text read from a real, printed Swiggy NOICE Malai Kulfi label (35 mm × 135 mm stick pack).
// The batch, dates and MRP are blank because they are printed at packing.
const KULFI = `Front panel (PDP):
NO!CE
MALAI
KULFI
NO ADDED FLAVOURS OR PRESERVATIVES
MADE IN SMALL BATCHES

Back panel:
Malai Kulfi
INGREDIENTS: MILK (80.32%), Sugar
Contains: Added Flavours: Natural Vanilla Flavor.
Allergen: Contains Milk. May Contain Nuts

BATCH No.:
USE BY:
MFD.:
MRP ₹:
(inclusive of all taxes)
NET QUANTITY:
63 ml/70 g

For complaints or feedback, contact the Customer Care Executive at the Marketer's Address or Call 080-45649999
from 9 AM to 6 PM (Weekdays) or drop an email to noice@scootsy.com

fssai Lic. No. 11222999000875
Manufactured by: KOCHIN COLD STORAGE PVT. LTD.
Sy No. 59/2, 4th Cross, Doddanekkundi Industrial Area, Mahadevapura,
Bengaluru, Urban, Karnataka - 560048, India.
Marketed by: Innovative Retail Concepts Private Limited
No. 580, R.M.V 2nd Stage, Doddaballapura Main Road,
Bengaluru - 560094, Karnataka, India.

Nutrition panel:
NUTRITIONAL INFORMATION
(APPROX VALUES)
NUTRIENTS PER 70 g VALUE %RDA PER SERVE VALUE**
ENERGY-151 kcal (8.15%), PROTEIN-3.23 g, CARBOHYDRATE-14.54 g, TOTAL SUGARS-13.79 g, ADDED SUGAR-7.79 g (15.62%),
TOTAL FAT-9.78 g (12.37%), SATURATED FAT-5.88 g (27.67%), CHOLESTEROL-24.71 mg, TRANS FAT-0.10 g, SODIUM-52.33 mg (2.62%)`;

const india = getMarket("india")!;
const seenOnArtwork = { vegMark: true, fssaiLogo: true, barcode: true };

function flagsFor(text: string, visual: typeof seenOnArtwork | null) {
  const context = { nutrientClaims: india.pack.nutrientClaims, nutrientBasis: india.pack.nutrientBasis, visual, categoryId: "general" };
  return layersFor(india, getChannels("india", ["instamart"]), CATEGORIES[0]).flatMap((l) =>
    checkCodeRules(text, l.rules, l.channels, context),
  );
}

describe("A real Swiggy kulfi label", () => {
  it("reads “Allergen: Contains Milk.” as declaring milk", () => {
    const result = checkAllergens(KULFI, india.pack);
    expect(result.flags).toEqual([]);
  });

  it("raises none of the false flags: per-pack nutrition, Indian address, veg mark seen in the photo", () => {
    const ids = flagsFor(KULFI, seenOnArtwork).filter((f) => !f.confirmOnly).map((f) => f.ruleId);
    expect(ids).not.toContain("IN-FSSAI-NUT100");
    expect(ids).not.toContain("IN-LM-ORIGIN");
    expect(ids).not.toContain("IN-FSSAI-VEG");
    expect(ids).not.toContain("IN-FSSAI-LIC");
  });

  it("finds the licence number after “Lic. No.” even when the logo text is misread", () => {
    expect(findFssaiNumbers(KULFI.replace("fssai Lic.", "Issat Lic.")).map((f) => f.number)).toEqual(["11222999000875"]);
  });

  it("without a photo, a missing veg mark is something to confirm, not a fault", () => {
    const veg = flagsFor(KULFI, null).find((f) => f.ruleId === "IN-FSSAI-VEG");
    expect(veg?.confirmOnly).toBe(true);
    const seenNothing = flagsFor(KULFI, { vegMark: false, fssaiLogo: false, barcode: false }).find((f) => f.ruleId === "IN-FSSAI-VEG");
    expect(seenNothing?.confirmOnly).toBeUndefined();
  });
});

describe("Nutrition basis", () => {
  it("accepts per 100 g, per pack, or per the net quantity, each with per serve", () => {
    expect(nutritionBasisOk("Nutritional information per 100 g / per serve (20 g)")).toBe(true);
    expect(nutritionBasisOk("Net quantity: 70 g. Nutritional information per 70 g, %RDA per serve")).toBe(true);
    expect(nutritionBasisOk("Nutritional information per pack, %RDA per serve")).toBe(true);
    expect(nutritionBasisOk("Net quantity: 200 g. Nutritional information per 30 g, %RDA per serve")).toBe(false);
    expect(nutritionBasisOk("Nutritional information per 100 g")).toBe(false);
  });
});

describe("Country of origin", () => {
  it("an Indian manufacturer address counts; a foreign one doesn't", () => {
    const origin = india.pack.rules.find((r) => r.id === "IN-LM-ORIGIN")!;
    const flagged = (t: string) => checkCodeRules(t, [origin]).length > 0;
    expect(flagged("Masala makhana. Manufactured by: Good Snacks Pvt Ltd, Pune 411001, India.")).toBe(false);
    expect(flagged("Olive oil. Manufactured by: Oliva SA, Seville, Spain.")).toBe(true);
  });
});
