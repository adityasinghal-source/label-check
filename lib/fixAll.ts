import { ingredientsRange } from "./allergens";
import { findQuote, sentenceRange } from "./sentences";
import type { Flag } from "./types";

export type FixResult = {
  fixedText: string;
  // Plain-English list of what was changed.
  applied: string[];
  // Flags the user still has to handle by hand.
  needsYou: Flag[];
};

const withPeriod = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

// Applies every fix that can be applied automatically, in this order:
// 1. sentence rewrites (AI) and sentence removals (channel rules); a rewrite beats a removal; then in-place word swaps
// 2. the allergen "Contains:" line, replacing any existing one
// 3. lines a channel needs added, such as the FSSAI licence number
export function fixAll(text: string, allFlags: Flag[], allergenStatement: string | null): FixResult {
  // Things to confirm with a channel can't be fixed on the label.
  const flags = allFlags.filter((f) => !f.confirmOnly);
  const applied: string[] = [];
  const needsYou: Flag[] = [];

  // 1. Sentence edits, keyed by where the sentence starts so each sentence is edited once.
  type Edit = { start: number; end: number; replacement: string | null; flag: Flag };
  const edits = new Map<number, Edit>();
  for (const flag of flags) {
    const type = flag.fix?.type;
    if (type !== "rewrite" && type !== "remove_sentence") continue;
    const found = findQuote(text, flag.quotedText);
    const rewrite = type === "rewrite" ? flag.suggestedRewrite.trim() : "";
    if (!found || (type === "rewrite" && !rewrite)) {
      needsYou.push(flag);
      continue;
    }
    const [start, end] = sentenceRange(text, found[0], found[1]);
    const existing = edits.get(start);
    if (existing && existing.replacement !== null) continue;
    edits.set(start, { start, end, replacement: type === "rewrite" ? withPeriod(rewrite) : null, flag });
  }

  let fixed = text;
  for (const edit of [...edits.values()].sort((a, b) => b.start - a.start)) {
    const original = fixed.slice(edit.start, edit.end);
    if (edit.replacement === null) {
      fixed = (fixed.slice(0, edit.start) + fixed.slice(edit.end).replace(/^[ \t]+/, "")).replace(/^\s+/, "");
      applied.push(`Removed “${original.trim()}” (${edit.flag.ruleId})`);
    } else {
      fixed = fixed.slice(0, edit.start) + edit.replacement + fixed.slice(edit.end);
      applied.push(`Rewrote “${original.trim()}” → “${edit.replacement}” (${edit.flag.ruleId})`);
    }
  }

  // In-place word swaps (additives → "Functional class (INS …)"), looked up in the ingredient list first.
  for (const flag of flags) {
    if (flag.fix?.type !== "replace_text" || !flag.suggestedRewrite) continue;
    const range = ingredientsRange(fixed);
    const inList = range ? findQuote(fixed.slice(...range), flag.quotedText) : null;
    const found = inList && range ? ([range[0] + inList[0], range[0] + inList[1]] as const) : findQuote(fixed, flag.quotedText);
    if (!found) {
      needsYou.push(flag);
      continue;
    }
    fixed = fixed.slice(0, found[0]) + flag.suggestedRewrite + fixed.slice(found[1]);
    applied.push(`Declared “${flag.quotedText}” as “${flag.suggestedRewrite}” (${flag.ruleId})`);
  }

  // 2. Allergen statement.
  if (allergenStatement && flags.some((f) => f.fix?.type === "allergen_statement")) {
    const existing = /^.*\bcontains\s*:[^\n]*/im.exec(fixed);
    if (existing) {
      fixed = fixed.slice(0, existing.index) + allergenStatement + fixed.slice(existing.index + existing[0].length);
      applied.push(`Replaced the allergen line with “${allergenStatement}”`);
    } else {
      const range = ingredientsRange(fixed);
      const at = range ? range[1] : fixed.length;
      const before = fixed.slice(0, at).trimEnd();
      const after = fixed.slice(at).trimStart();
      fixed = `${before}\n${allergenStatement}${after ? `\n${after}` : ""}`;
      applied.push(`Added the allergen line “${allergenStatement}”`);
    }
  }

  // 3. Lines a channel needs added, and anything that needs a human.
  for (const flag of flags) {
    const fix = flag.fix;
    if (fix?.type === "append_line") {
      if (!fixed.includes(fix.line)) fixed = `${fixed.trimEnd()}\n${fix.line}`;
      applied.push(`Added “${fix.line}” (${flag.ruleId}): fill in the brackets`);
    } else if (fix?.type === "manual") {
      needsYou.push(flag);
    }
  }

  return { fixedText: fixed.trim(), applied, needsYou };
}
