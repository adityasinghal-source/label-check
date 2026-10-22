import type { Source } from "./types";

// Principal display panel (PDP) area and the minimum print sizes that follow from it.

export type PackShape = "rect" | "cylinder" | "custom";
export type PackUnit = "cm" | "in";
// rect: width × height. cylinder: width = diameter, height = height. custom: width = the area itself (cm² or in²).
export type PackDimensions = { shape: PackShape; unit: PackUnit; width: number; height: number };

export type PrintSpec = { item: string; minimum: string; citation: string; source: Source; verified: boolean };
export type PrintSizes = { area: number; areaUnit: "cm²" | "in²"; areaNote: string; specs: PrintSpec[] };

const CM_PER_IN = 2.54;

export const SHAPES: { id: PackShape; label: string }[] = [
  { id: "rect", label: "Rectangular pouch / box" },
  { id: "cylinder", label: "Cylindrical jar / can / bottle" },
  { id: "custom", label: "Other / custom area" },
];

// Area in the unit the user typed (cm² or in²). For a cylinder the PDP is 40% of height × circumference,
// as in 21 CFR 101.1; the same convention is used for India.
function rawArea(d: PackDimensions): number {
  if (d.shape === "custom") return d.width;
  if (d.shape === "cylinder") return 0.4 * d.height * Math.PI * d.width;
  return d.width * d.height;
}

export function validDimensions(d: PackDimensions | null | undefined): d is PackDimensions {
  if (!d || !["rect", "cylinder", "custom"].includes(d.shape) || !["cm", "in"].includes(d.unit)) return false;
  const okNumber = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0 && n < 10_000;
  return okNumber(d.width) && (d.shape === "custom" || okNumber(d.height));
}

const round = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

const LM_SOURCE: Source = {
  label: "Legal Metrology (Packaged Commodities) Rules, 2011",
  url: "https://consumeraffairs.gov.in/public/upload/admin/cmsfiles/whatsnews/Book_on_Legal_Metrology_Packaged_Commodities_Rules,2011_with_all_amendments_whatsnews.pdf",
};
const FSSAI_SOURCE: Source = { label: "FSSAI regulations", url: "https://www.fssai.gov.in/cms/food-safety-and-standards-regulations.php" };
const CFR_SOURCE: Source = {
  label: "21 CFR 101.105 (eCFR)",
  url: "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-G/section-101.105",
};

// Legal Metrology Rule 7: minimum numeral height for the net quantity, normal / blown, moulded or embossed.
const INDIA_NUMERALS: [number, string, string][] = [
  [100, "1 mm", "2 mm"],
  [500, "2 mm", "4 mm"],
  [2500, "4 mm", "6 mm"],
  [Infinity, "6 mm", "8 mm"],
];
// FSS (Labelling and Display) Regulations, 2020: veg / non-veg symbol, square side and inner circle diameter.
const INDIA_VEG_MARK: [number, string, string][] = [
  [100, "3 mm", "1.5 mm"],
  [500, "4 mm", "2 mm"],
  [2500, "6 mm", "3 mm"],
  [Infinity, "8 mm", "4 mm"],
];
// 21 CFR 101.105(i): minimum height of the net quantity line, by PDP area in square inches.
const US_TYPE: [number, string][] = [
  [5, "1/16 in (1.6 mm)"],
  [25, "1/8 in (3.2 mm)"],
  [100, "3/16 in (4.8 mm)"],
  [400, "1/4 in (6.4 mm)"],
  [Infinity, "1/2 in (12.7 mm)"],
];

const band = <T extends [number, ...string[]]>(table: T[], area: number) => table.find((row) => area <= row[0])!;

export function printSizes(market: string, d: PackDimensions): PrintSizes {
  const typed = rawArea(d);
  const shapeNote = d.shape === "cylinder" ? "40% of height × circumference" : d.shape === "rect" ? "width × height" : "area you entered";

  if (market === "india") {
    const area = d.unit === "cm" ? typed : typed * CM_PER_IN * CM_PER_IN;
    const [, normal, blown] = band(INDIA_NUMERALS, area);
    const [, square, circle] = band(INDIA_VEG_MARK, area);
    return {
      area: round(area),
      areaUnit: "cm²",
      areaNote: shapeNote,
      specs: [
        {
          item: "Net quantity and MRP numerals",
          minimum: `${normal} high (${blown} if blown, moulded, embossed or perforated)`,
          citation: "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 7",
          source: LM_SOURCE,
          verified: false,
        },
        {
          item: "Veg / non-veg symbol",
          minimum: `square at least ${square} per side, inner circle or triangle at least ${circle} across`,
          citation: "FSS (Labelling and Display) Regulations, 2020: size of the veg / non-veg logo",
          source: FSSAI_SOURCE,
          verified: false,
        },
      ],
    };
  }

  const area = d.unit === "in" ? typed : typed / (CM_PER_IN * CM_PER_IN);
  const [, minimum] = band(US_TYPE, area);
  return {
    area: round(area),
    areaUnit: "in²",
    areaNote: shapeNote,
    specs: [
      {
        item: "Net quantity statement (letters and numbers)",
        minimum: `${minimum} high`,
        citation: "21 CFR 101.105(i)",
        source: CFR_SOURCE,
        verified: true,
      },
    ],
  };
}
