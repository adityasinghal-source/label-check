import type { Channel, Rule, RulePack } from "../types";
import channelFile from "./channels-v0.1.json";
import fssai from "./fssai-v0.1.json";
import usFda from "./us-fda-v0.1.json";

export type Market = { id: string; label: string; pack: RulePack };

// A market's own rules (claims, allergens, label declarations) apply to every channel in it.
export const MARKETS: Market[] = [
  { id: "us", label: "United States", pack: usFda as RulePack },
  { id: "india", label: "India", pack: fssai as RulePack },
];

// Each channel is a layer of extra rules on top of its market's pack. Add a channel in channels-v0.1.json.
export const CHANNELS: Channel[] = (channelFile.channels as Omit<Channel, "version">[]).map((c) => ({
  ...c,
  version: channelFile.version,
}));

// Rules that apply whenever a product is sold online in a market, whichever channel.
const ONLINE_RULES = channelFile.online as Record<string, Rule[]>;

export function getMarket(id: unknown): Market | undefined {
  return MARKETS.find((m) => m.id === id);
}

// The selected channels that exist and belong to this market, in display order.
export function getChannels(marketId: string, ids: unknown): Channel[] {
  const wanted = Array.isArray(ids) ? ids : [];
  return CHANNELS.filter((c) => c.market === marketId && wanted.includes(c.id));
}

export function onlineRules(marketId: string): Rule[] {
  return ONLINE_RULES[marketId] ?? [];
}

// Look up any rule by ID, e.g. to name the rules a rejection points to when there is no label.
export function findRule(id: string): Rule | undefined {
  return [...MARKETS.flatMap((m) => m.pack.rules), ...Object.values(ONLINE_RULES).flat(), ...CHANNELS.flatMap((c) => c.rules)].find(
    (r) => r.id === id,
  );
}

// Every rule in play for a check: the market, online selling (if any channel), and each channel.
export function allRules(market: Market, channels: Channel[]): Rule[] {
  return [
    ...market.pack.rules,
    ...(channels.length ? onlineRules(market.id) : []),
    ...channels.flatMap((c) => c.rules),
  ];
}
