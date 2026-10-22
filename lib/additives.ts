import { ingredientsRange } from "./allergens";

// Common food additives and how FSSAI wants them declared: functional class, then name or INS number,
// e.g. "Emulsifier (INS 322(i))". INS numbers follow the Codex International Numbering System.
type Additive = { names: string[]; functionalClass: string; ins: string };

const ADDITIVES: Additive[] = [
  { names: ["soy lecithin", "soya lecithin", "sunflower lecithin", "lecithin"], functionalClass: "Emulsifier", ins: "322(i)" },
  { names: ["mono- and diglycerides of fatty acids", "mono and diglycerides", "mono- and diglycerides"], functionalClass: "Emulsifier", ins: "471" },
  { names: ["polysorbate 80"], functionalClass: "Emulsifier", ins: "433" },
  { names: ["citric acid"], functionalClass: "Acidity regulator", ins: "330" },
  { names: ["sodium citrate", "trisodium citrate"], functionalClass: "Acidity regulator", ins: "331(iii)" },
  { names: ["lactic acid"], functionalClass: "Acidity regulator", ins: "270" },
  { names: ["malic acid"], functionalClass: "Acidity regulator", ins: "296" },
  { names: ["tartaric acid"], functionalClass: "Acidity regulator", ins: "334" },
  { names: ["acetic acid"], functionalClass: "Acidity regulator", ins: "260" },
  { names: ["sodium bicarbonate", "baking soda", "sodium hydrogen carbonate"], functionalClass: "Raising agent", ins: "500(ii)" },
  { names: ["ammonium bicarbonate", "ammonium hydrogen carbonate"], functionalClass: "Raising agent", ins: "503(ii)" },
  { names: ["xanthan gum"], functionalClass: "Thickener", ins: "415" },
  { names: ["guar gum"], functionalClass: "Thickener", ins: "412" },
  { names: ["carrageenan"], functionalClass: "Thickener", ins: "407" },
  { names: ["gum arabic", "acacia gum"], functionalClass: "Thickener", ins: "414" },
  { names: ["carboxymethyl cellulose", "sodium carboxymethyl cellulose"], functionalClass: "Thickener", ins: "466" },
  { names: ["pectin"], functionalClass: "Gelling agent", ins: "440" },
  { names: ["agar", "agar-agar"], functionalClass: "Gelling agent", ins: "406" },
  { names: ["sodium benzoate"], functionalClass: "Preservative", ins: "211" },
  { names: ["potassium sorbate"], functionalClass: "Preservative", ins: "202" },
  { names: ["sorbic acid"], functionalClass: "Preservative", ins: "200" },
  { names: ["benzoic acid"], functionalClass: "Preservative", ins: "210" },
  { names: ["sodium metabisulphite", "sodium metabisulfite"], functionalClass: "Preservative", ins: "223" },
  { names: ["potassium metabisulphite", "potassium metabisulfite"], functionalClass: "Preservative", ins: "224" },
  { names: ["ascorbic acid"], functionalClass: "Antioxidant", ins: "300" },
  { names: ["mixed tocopherols", "tocopherols", "tocopherol"], functionalClass: "Antioxidant", ins: "307b" },
  { names: ["tbhq", "tertiary butylhydroquinone"], functionalClass: "Antioxidant", ins: "319" },
  { names: ["monosodium glutamate", "msg"], functionalClass: "Flavour enhancer", ins: "621" },
  { names: ["disodium inosinate"], functionalClass: "Flavour enhancer", ins: "631" },
  { names: ["disodium guanylate"], functionalClass: "Flavour enhancer", ins: "627" },
  { names: ["sucralose"], functionalClass: "Sweetener", ins: "955" },
  { names: ["aspartame"], functionalClass: "Sweetener", ins: "951" },
  { names: ["acesulfame potassium", "acesulfame k"], functionalClass: "Sweetener", ins: "950" },
  { names: ["steviol glycosides"], functionalClass: "Sweetener", ins: "960" },
  { names: ["silicon dioxide"], functionalClass: "Anticaking agent", ins: "551" },
  { names: ["tricalcium phosphate"], functionalClass: "Anticaking agent", ins: "341(iii)" },
  { names: ["tartrazine"], functionalClass: "Colour", ins: "102" },
  { names: ["sunset yellow", "sunset yellow fcf"], functionalClass: "Colour", ins: "110" },
];

const CLASS_WORDS =
  /\b(?:emulsifiers?|acidity regulators?|acidulants?|raising agents?|leavening agents?|thickeners?|stabili[sz]ers?|gelling agents?|preservatives?|antioxidants?|flavou?r enhancers?|sweeteners?|anti-?caking agents?|colou?rs?)\b/i;
// Allergen sources kept in the rewrite, so the allergen check still sees them.
const ALLERGEN_SOURCE = /\b(?:soy|soya|milk|egg|wheat|peanut)\b/i;

export type BareAdditive = { start: number; end: number; quote: string; rewrite: string; functionalClass: string; ins: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Additives in the ingredient list named without their functional class or INS number.
export function findBareAdditives(text: string): BareAdditive[] {
  const range = ingredientsRange(text);
  if (!range) return [];
  const [from, to] = range;
  const list = text.slice(from, to);
  const taken: [number, number][] = [];
  const found: BareAdditive[] = [];

  // Longest names first, so "soy lecithin" wins over "lecithin".
  const entries = ADDITIVES.flatMap((a) => a.names.map((name) => ({ name, a }))).sort((x, y) => y.name.length - x.name.length);
  for (const { name, a } of entries) {
    for (const m of list.matchAll(new RegExp(`\\b${escape(name)}\\b`, "gi"))) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      // Already declared: a class name just before it ("Emulsifier (soy lecithin"), or an INS / E number just after.
      const before = list.slice(Math.max(0, start - 30), start);
      const after = list.slice(end, end + 14);
      if (CLASS_WORDS.test(before) || /^\s*[(,]?\s*(?:INS|E)\s?-?\d/i.test(after)) continue;
      const quote = m[0];
      const rewrite = ALLERGEN_SOURCE.test(quote)
        ? `${a.functionalClass} (${quote}, INS ${a.ins})`
        : `${a.functionalClass} (INS ${a.ins})`;
      found.push({ start: from + start, end: from + end, quote, rewrite, functionalClass: a.functionalClass, ins: a.ins });
    }
  }
  return found.sort((x, y) => x.start - y.start);
}
