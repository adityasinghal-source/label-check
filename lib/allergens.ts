import type { Allergen, Flag, RulePack } from "./types";

// clear: allergens with nothing undeclared, shown under "No issues found".
export type AllergenResult = { checked: boolean; flags: Flag[]; clear: string[] };

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole words only, allowing simple plurals: "almond" matches "almonds" but not "almondine".
function wordPattern(words: string[]) {
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

export function checkAllergens(labelText: string, pack: RulePack): AllergenResult {
  const start = /\bingredients?\s*:/i.exec(labelText);
  if (!start) return { checked: false, flags: [], clear: [] };

  let ingredients = labelText.slice(start.index + start[0].length);
  const end = ingredients.search(/\b(?:contains|may contain|allergens?)\s*:|\n\s*\n/i);
  if (end >= 0) ingredients = ingredients.slice(0, end);

  const containsLine = /\bcontains\s*:([^\n]*)/i.exec(labelText)?.[1] ?? "";
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

  const display = (h: Hit) => (h.allergen.nameSpecific ? `${h.allergen.name} (${h.matched})` : h.allergen.name);
  const suggestedContains = `Contains: ${hits.map(display).join(", ")}.`;

  const undeclared = hits.filter((h) => !h.declared);
  const clear = pack.allergens.filter((a) => !undeclared.some((h) => h.allergen === a)).map((a) => a.name);

  const flags: Flag[] = undeclared.map((h) => ({
      ruleId: rule.id,
      ruleName: rule.name,
      citation: rule.citation,
      severity: rule.severity,
      quotedText: h.item,
      explanation: h.namedInItem
        ? `"${h.item}" is a source of ${h.allergen.name.toLowerCase()}. The ingredient name shows it, but there's no "Contains:" line declaring it.`
        : `"${h.item}" is a source of ${h.allergen.name.toLowerCase()}, but the label never says so. Declare it in brackets after the ingredient or in a "Contains:" line.`,
      suggestedRewrite: suggestedContains,
      foundBy: "code",
    }));

  return { checked: true, flags, clear };
}
