// The structure of a 14-digit FSSAI (FoSCoS) number:
//   digit 1      1 = licence, 2 = registration
//   digits 2–3   state / UT code (01–38), or 00 for a Central Licence
//   digits 4–5   year it was granted (last two digits)
//   digits 6–8   enrolling office
//   digits 9–14  the business's own number
// There is no check digit, so a number that passes can still be fake: only FoSCoS can confirm it.

export type FssaiNumberCheck =
  | { ok: true; kind: "licence" | "registration"; central: boolean; stateCode: string; year: number }
  | { ok: false; problem: string };

function synthetic(n: string): boolean {
  if (/^(\d)\1+$/.test(n)) return true;
  if (/^1234567890/.test(n) || /^9876543210/.test(n)) return true;
  // Mostly zeros (e.g. 10000000000000) or a business number of all zeros.
  if ((n.match(/0/g) ?? []).length >= 11 || n.slice(8) === "000000") return true;
  return false;
}

export function checkFssaiNumber(raw: string, options: { needsCentral?: boolean; now?: Date } = {}): FssaiNumberCheck {
  const n = raw.replace(/[\s-]/g, "");
  if (!/^\d{14}$/.test(n)) return { ok: false, problem: "An FSSAI number is exactly 14 digits." };
  if (synthetic(n)) return { ok: false, problem: "That looks like a dummy number. Use your real FSSAI number." };

  const first = n[0];
  if (first !== "1" && first !== "2") {
    return { ok: false, problem: "The first digit must be 1 (licence) or 2 (registration)." };
  }
  const stateCode = n.slice(1, 3);
  const state = Number(stateCode);
  const central = stateCode === "00";
  if (!central && (state < 1 || state > 38)) {
    return { ok: false, problem: `Digits 2–3 (${stateCode}) aren't a state / UT code (01–38) or 00 for a Central Licence.` };
  }
  if (central && first === "2") {
    return { ok: false, problem: "A registration (starting with 2) can't carry the Central Licence code 00." };
  }
  const year = Number(n.slice(3, 5));
  const thisYear = (options.now ?? new Date()).getFullYear() % 100;
  if (year > thisYear) {
    return { ok: false, problem: `Digits 4–5 (${n.slice(3, 5)}) should be the year it was granted, which can't be after ${String(thisYear).padStart(2, "0")}.` };
  }
  if (options.needsCentral && !central) {
    return {
      ok: false,
      problem: "Imported food needs the importer's Central Licence, which starts with 100. This is a state number.",
    };
  }
  return { ok: true, kind: first === "1" ? "licence" : "registration", central, stateCode, year };
}

// Every 14-digit number printed after the word FSSAI or "Lic. No.", as written and with spaces removed.
export function findFssaiNumbers(text: string): { number: string; raw: string }[] {
  const found = [...text.matchAll(/(?:fssai|\blic(?:en[cs]e)?\.?\s*no)[^\n\d]{0,40}?(\d(?:[\s-]?\d){13})(?!\d)/gi)];
  const unique = new Map(found.map((m) => [m[1].replace(/[\s-]/g, ""), m[1]]));
  return [...unique].map(([number, raw]) => ({ number, raw }));
}
