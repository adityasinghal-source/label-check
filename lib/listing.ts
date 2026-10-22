import { findPlaceholders } from "./codeRules";
import { findFssaiNumbers } from "./fssaiNumber";
import { declaredShelfLife } from "./shelfLife";
import type { Report } from "./types";

// The catalogue attributes quick-commerce and marketplace onboarding forms ask for, read from the label by code.
export type ListingAttribute = { key: string; label: string; value: string | null };

const clean = (s: string | undefined) => {
  const v = s?.replace(/\s+/g, " ").replace(/[.,;|·\s]+$/, "").trim();
  return v && !findPlaceholders(v).length ? v : null;
};
// A value runs to the end of its sentence (a full stop before a capital letter), line, or a "|" / "·"
// separator, so "1.4 oz" and "(incl. of all taxes)" stay whole.
// The label is matched ignoring case; the value's end is not, so the capital-letter test works.
const VALUE = /^([^\n;|·]+?)(?=\.\s+[A-Z]|\.?$|;|\||·)/m;
function read(text: string, label: string) {
  const found = new RegExp(label, "i").exec(text);
  return found ? clean(VALUE.exec(text.slice(found.index + found[0].length))?.[1]) : null;
}

export function listingAttributes(report: Report): ListingAttribute[] {
  const text = report.labelText;
  const shelf = declaredShelfLife(text);
  const veg = /\bnon[- ]?veg(?:etarian)?\b/i.test(text)
    ? "Non-vegetarian"
    : /\bveg(?:etarian)?\b/i.test(text)
      ? "Vegetarian"
      : report.visual?.vegMark
        ? "Veg / non-veg mark seen on artwork: confirm which"
        : null;
  const storage = /\b(store\s+(?:in|at|below|under|away)[^\n.]*)/i.exec(text)?.[1];
  const attributes: ListingAttribute[] = [
    { key: "net_quantity", label: "Net quantity", value: read(text, "\\bnet\\s*(?:qty\\.?|quantity|wt\\.?|weight|contents?)\\s*[:\\-]?\\s*") },
    { key: "shelf_life", label: "Shelf life", value: shelf ? `${shelf.phrase.replace(/^.*?(\d)/, "$1")} (about ${shelf.days} days)` : null },
    { key: "veg_type", label: "Veg / non-veg", value: report.market === "india" ? veg : veg ?? "Not applicable (US)" },
    { key: "fssai_licence", label: "FSSAI licence no.", value: findFssaiNumbers(text)[0]?.number ?? (report.market === "india" ? null : "Not applicable (US)") },
    {
      key: "manufacturer",
      label: "Manufacturer / packer",
      value: read(text, "\\b(?:manufactured|mfd\\.?|packed|marketed|distributed)\\s+(?:and\\s+\\w+\\s+)?by\\s*[:\\-]?\\s*"),
    },
    { key: "country_of_origin", label: "Country of origin", value: read(text, "\\b(?:country\\s+of\\s+origin\\s*[:\\-]?|product\\s+of|made\\s+in)\\s*") },
    {
      key: "allergen_info",
      label: "Allergen info",
      value: report.allergenStatement ?? (/\bingredients?\s*:/i.test(text) ? "No major allergens found in the ingredient list" : null),
    },
    { key: "storage", label: "Storage instructions", value: clean(storage) },
  ];
  if (report.market === "india") attributes.push({ key: "mrp", label: "MRP", value: read(text, "\\bMRP\\s*[:\\-]?\\s*") });
  const barcode = report.barcodes[0];
  if (barcode) {
    const value = barcode.valid ? barcode.code : `${barcode.code} (check digit wrong: fix before listing)`;
    attributes.push({ key: "gtin", label: "Barcode (GTIN)", value });
  }
  return attributes;
}

// Phrases a listing must never repeat: claims the report flagged, plus disease words as a safety net.
const DISEASE = /\b(?:cures?|treats?|prevents?|heals?|diabet\w*|cancer|disease\w*|blood sugar|cholesterol|immunity booster|medicin\w*)\b/i;

export function listingCopyProblems(line: string, flaggedQuotes: string[], avoidWords: string[]): boolean {
  const l = line.toLowerCase();
  return (
    DISEASE.test(line) ||
    /\bcompliant\b/i.test(line) ||
    flaggedQuotes.some((q) => q && l.includes(q.toLowerCase())) ||
    avoidWords.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(line))
  );
}

// The claims a listing must leave out: anything flagged for rewrite or removal.
export function flaggedClaims(report: Report): string[] {
  return report.flags.filter((f) => f.quotedText && (f.fix?.type === "rewrite" || f.fix?.type === "remove_sentence")).map((f) => f.quotedText);
}

export function listingJson(title: string, highlights: string[], attributes: ListingAttribute[]): string {
  const values = Object.fromEntries(attributes.map((a) => [a.key, a.value ?? ""]));
  return JSON.stringify({ title, highlights, ...values }, null, 2);
}

export function listingCsv(title: string, highlights: string[], attributes: ListingAttribute[]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["title", ...highlights.map((_, i) => `highlight_${i + 1}`), ...attributes.map((a) => a.key)];
  const row = [title, ...highlights, ...attributes.map((a) => a.value ?? "")];
  return `${header.map(cell).join(",")}\n${row.map(cell).join(",")}`;
}

export function listingText(title: string, highlights: string[], attributes: ListingAttribute[]): string {
  return [
    title,
    "",
    ...highlights.map((h) => `• ${h}`),
    "",
    ...attributes.map((a) => `${a.label}: ${a.value ?? "Not on the label yet"}`),
  ].join("\n");
}
