import type { Category, Channel, PackType, Rule, RulePack } from "../types";
import categoryFile from "./categories-v0.3.json";
import channelFile from "./channels-v0.3.json";
import fssai from "./fssai-v0.3.json";
import usFda from "./us-fda-v0.3.json";

export type Market = { id: string; label: string; pack: RulePack };

// A market's own rules (claims, allergens, label declarations) apply to every channel in it.
export const MARKETS: Market[] = [
  { id: "us", label: "United States", pack: usFda as RulePack },
  { id: "india", label: "India", pack: fssai as RulePack },
];

// Each channel is a layer of extra rules on top of its market's pack. Add a channel in channels-v0.3.json.
export const CHANNELS: Channel[] = (channelFile.channels as Omit<Channel, "version">[]).map((c) => ({
  ...c,
  version: channelFile.version,
}));

// A product category adds rules per market. "general" adds none.
export const CATEGORIES = categoryFile.categories as Category[];

// A multi-pack / combo pack adds its own declarations; a single unit pack adds none.
export const PACK_TYPES = categoryFile.packTypes as { id: PackType; label: string; rules: Record<string, Rule[]> }[];

export function getPackType(id: unknown): PackType {
  return PACK_TYPES.some((p) => p.id === id) ? (id as PackType) : "single";
}

// Rules that apply whenever a product is sold online in a market, whichever channel.
const ONLINE_RULES = channelFile.online as Record<string, Rule[]>;

// Onboarding rules shared by the Indian quick-commerce channels.
export const QUICK_COMMERCE = channelFile.quickCommerce as { channels: string[]; rules: Rule[] };

export function getMarket(id: unknown): Market | undefined {
  return MARKETS.find((m) => m.id === id);
}

export function getCategory(id: unknown): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

// The selected channels that exist and belong to this market, in display order.
export function getChannels(marketId: string, ids: unknown): Channel[] {
  const wanted = Array.isArray(ids) ? ids : [];
  return CHANNELS.filter((c) => c.market === marketId && wanted.includes(c.id));
}

export function onlineRules(marketId: string): Rule[] {
  return ONLINE_RULES[marketId] ?? [];
}

// A set of rules and the channel columns its flags apply to ([] = every channel: the market's own rules).
export type Layer = { rules: Rule[]; channels: string[] };

// Every layer in play for a check, in display order: market, category, pack type, online selling, quick commerce, each channel.
export function layersFor(market: Market, channels: Channel[], category: Category, packType: PackType = "single"): Layer[] {
  const ids = channels.map((c) => c.id);
  const quick = ids.filter((id) => QUICK_COMMERCE.channels.includes(id));
  return [
    { rules: market.pack.rules, channels: [] },
    { rules: category.rules[market.id] ?? [], channels: [] },
    { rules: PACK_TYPES.find((p) => p.id === packType)?.rules[market.id] ?? [], channels: [] },
    { rules: ids.length ? onlineRules(market.id) : [], channels: ids },
    { rules: quick.length ? QUICK_COMMERCE.rules : [], channels: quick },
    ...channels.map((c) => ({ rules: c.rules, channels: [c.id] })),
  ].filter((layer) => layer.rules.length > 0);
}

// Every rule in play for a check (e.g. for the rejection explainer to choose from).
export function allRules(market: Market, channels: Channel[], category: Category = CATEGORIES[0], packType: PackType = "single"): Rule[] {
  return layersFor(market, channels, category, packType).flatMap((layer) => layer.rules);
}

// Look up any rule by ID, e.g. to name the rules a rejection points to when there is no label.
export function findRule(id: string): Rule | undefined {
  return [
    ...MARKETS.flatMap((m) => m.pack.rules),
    ...CATEGORIES.flatMap((c) => Object.values(c.rules).flat()),
    ...PACK_TYPES.flatMap((p) => Object.values(p.rules).flat()),
    ...Object.values(ONLINE_RULES).flat(),
    ...QUICK_COMMERCE.rules,
    ...CHANNELS.flatMap((c) => c.rules),
  ].find((r) => r.id === id);
}
