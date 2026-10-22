// EAN-13 / UPC-A barcode numbers: the Modulo-10 check digit and the GS1 prefix (which GS1 office issued it).

export type BarcodeCheck = { code: string; format: "EAN-13" | "UPC-A"; valid: boolean; expected: number; prefix: string };

export function checkDigit(body: string): number {
  // Weights 3 and 1 alternate from the rightmost digit of the body.
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

// A short list of common GS1 prefixes; anything else is shown as its number.
function prefixName(ean13: string): string {
  const p = Number(ean13.slice(0, 3));
  if (p <= 19) return "GS1 US";
  if (p <= 29) return "restricted / in-store number";
  if (p <= 139) return "GS1 US";
  if (p >= 300 && p <= 379) return "GS1 France";
  if (p >= 400 && p <= 440) return "GS1 Germany";
  if (p >= 450 && p <= 459) return "GS1 Japan";
  if (p >= 490 && p <= 499) return "GS1 Japan";
  if (p >= 500 && p <= 509) return "GS1 UK";
  if (p >= 690 && p <= 699) return "GS1 China";
  if (p >= 754 && p <= 755) return "GS1 Canada";
  if (p === 890) return "GS1 India";
  if (p >= 930 && p <= 939) return "GS1 Australia";
  return `GS1 prefix ${ean13.slice(0, 3)}`;
}

export function checkBarcode(raw: string): BarcodeCheck | null {
  const code = raw.replace(/[\s-]/g, "");
  if (!/^\d{12,13}$/.test(code)) return null;
  const format = code.length === 13 ? "EAN-13" : "UPC-A";
  const expected = checkDigit(code.slice(0, -1));
  // A UPC-A is an EAN-13 with a leading 0, so it shares the prefix table.
  const ean13 = code.padStart(13, "0");
  return { code, format, valid: Number(code.at(-1)) === expected, expected, prefix: prefixName(ean13) };
}

// Barcode numbers on the label: 12–13 digits after EAN / UPC / GTIN / barcode, or a 13-digit number starting 890.
export function findBarcodes(text: string): { raw: string; check: BarcodeCheck }[] {
  const found = new Map<string, { raw: string; check: BarcodeCheck }>();
  const patterns = [/\b(?:EAN(?:-?13)?|UPC(?:-?A)?|GTIN(?:-?1[23])?|bar\s?code)\b[^\d\n]{0,12}(\d[\d -]{10,16}\d)/gi, /\b(890\d{10})\b/g];
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const check = checkBarcode(m[1]);
      if (check && !found.has(check.code)) found.set(check.code, { raw: m[1], check });
    }
  }
  return [...found.values()];
}
