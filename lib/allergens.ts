import type { Allergen, Flag, RulePack } from "./types";

// clear: allergens with nothing undeclared, shown under "No issues found".
// statement: the correct allergen line for this label, e.g. "Contains: Milk, Tree Nuts (Almonds)."
export type AllergenResult = { checked: boolean; flags: Flag[]; clear: string[]; statement: string | null };

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

// Whole words only, allowing simple plurals: "almond" matches "almonds" but not "almondine".
export function wordPattern(words: string[]) {
  return new RegExp(`\\b(?:${words.map(escapeRegex).join("|")})(?:s|es)?\\b`, "i");
}

// Blank out phrases like "peanut butter" so "butter" isn't read as milk.
function removeExcluded(text: string, exclude: string[] = []) {
  return exclude.reduce((t, phrase) => t.replace(new RegExp(escapeRegex(phrase), "gi"), " "), text);
}

// Split "a, b (c, d), e" into ["a", "b (c, d)", "e"].
function splitIngredients(list: string) {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      items.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  items.push(current);
  return items.map((i) => i.trim().replace(/\.$/, "").trim()).filter(Boolean);
}

function bracketText(text: string) {
  return (text.match(/[([][^)\]]*[)\]]/g) ?? []).join(" ");
}

// [start, end) of the ingredient list after "Ingredients:", or null if there isn't one.
export function ingredientsRange(labelText: string): [number, number] | null {
  const heading = /\bingredients?\s*:/i.exec(labelText);
  if (!heading) return null;
  const start = heading.index + heading[0].length;
  const end = labelText.slice(start).search(/\b(?:contains|may contain|allergens?)\s*:|\n\s*\n/i);
  return [start, end >= 0 ? start + end : labelText.length];
}

export function checkAllergens(labelText: string, pack: RulePack): AllergenResult {
  const range = ingredientsRange(labelText);
  if (!range) return { checked: false, flags: [], clear: [], statement: null };
  const ingredients = labelText.slice(...range);

  // Every allergen statement counts: "Contains: Milk", "Allergen: Contains Milk.", "Allergen information: milk".
  // "May contain" is a precaution, not a declaration, so it isn't read here.
  const containsLine = [
    ...labelText.matchAll(/\bcontains\b\s*[:\-]?([^\n]*)/gi),
    ...labelText.matchAll(/\ballergens?(?:\s+(?:information|advice|declaration))?\s*[:\-]([^\n]*)/gi),
  ]
    .map((m) => m[1].replace(/\bmay\s+contain\b[^.\n]*/gi, " "))
    .join(" ");
  const items = splitIngredients(ingredients);
  const rule = pack.rules.find((r) => r.id === pack.allergenRuleId)!;

  type Hit = { allergen: Allergen; item: string; matched: string; declared: boolean; namedInItem: boolean };
  const hits: Hit[] = [];

  for (const allergen of pack.allergens) {
    const seen = new Set<string>();
    for (const item of items) {
      const cleaned = removeExcluded(item, allergen.exclude);
      const match = wordPattern(allergen.keywords).exec(cleaned);
      if (!match) continue;
      const matched = match[0].toLowerCase();
      // Tree nuts, fish etc. are tracked per species; other allergens once each.
      const key = allergen.nameSpecific ? matched : allergen.name;
      if (seen.has(key)) continue;
      seen.add(key);

      const declaredPattern = allergen.nameSpecific
        ? wordPattern(allergen.keywords.filter((k) => wordPattern([k]).test(matched)))
        : wordPattern(allergen.declaredBy);
      const brackets = removeExcluded(bracketText(ingredients), allergen.exclude);
      const declared = declaredPattern.test(containsLine) || declaredPattern.test(brackets);
      const outsideBrackets = removeExcluded(item.replace(/[([][^)\]]*[)\]]/g, " "), allergen.exclude);
      hits.push({ allergen, item, matched, declared, namedInItem: declaredPattern.test(outsideBrackets) });
    }
  }

  // FDA style: the allergen's name, plus the specific nut, fish or cereal in brackets.
  const display = (h: Hit) =>
    titleCase(h.allergen.nameSpecific ? `${h.allergen.name} (${h.matched})` : h.allergen.name);
  const statement = hits.length > 0 ? `Contains: ${hits.map(display).join(", ")}.` : null;
  const suggestedContains = statement ?? "";

  // In packs with an advice rule (US), an ingredient name that names the allergen ("almonds") already
  // counts as the legal declaration, so it only gets a low-severity "add a Contains: line" note.
  const advice = pack.rules.find((r) => r.id === pack.allergenAdviceRuleId);
  const undeclared = hits.filter((h) => !h.declared && !(advice && h.namedInItem));
  const adviceOnly = advice ? hits.filter((h) => !h.declared && h.namedInItem) : [];
  const clear = pack.allergens.filter((a) => !undeclared.some((h) => h.allergen === a)).map((a) => a.name);
  const allergenName = (h: Hit) => h.allergen.name.toLowerCase();

  const flags: Flag[] = [
    ...undeclared.map((h) => ({
      ruleId: rule.id,
      ruleName: rule.name,
      citation: rule.citation,
      source: rule.source,
      verified: rule.verified,
      channels: [],
      severity: rule.severity,
      quotedText: h.item,
      explanation: h.namedInItem
        ? `"${h.item}" is a source of ${allergenName(h)}. The ingredient name shows it, but there's no "Contains:" line declaring it.`
        : `"${h.item}" is a source of ${allergenName(h)}, but the label never says so. Declare it in brackets after the ingredient or in a "Contains:" line.`,
      suggestedRewrite: suggestedContains,
      fix: { type: "allergen_statement" as const },
      foundBy: "code" as const,
    })),
    ...adviceOnly.map((h) => ({
      ruleId: advice!.id,
      ruleName: advice!.name,
      citation: advice!.citation,
      source: advice!.source,
      verified: advice!.verified,
      channels: [],
      severity: advice!.severity,
      quotedText: h.item,
      explanation: `"${h.item}" names ${allergenName(h)}, which counts as declaring it. A "Contains:" line is optional, but it's common practice and easier for shoppers to spot.`,
      suggestedRewrite: suggestedContains,
      fix: { type: "allergen_statement" as const },
      foundBy: "code" as const,
    })),
  ];

  return { checked: true, flags, clear, statement };
}
