import type { RulePack } from "../types";
import amazonUs from "./amazon-us-v0.1.json";
import blinkitIn from "./blinkit-in-v0.1.json";
import fssai from "./fssai-v0.1.json";
import usFda from "./us-fda-v0.1.json";

type ChannelPackFile = Pick<RulePack, "id" | "label" | "version" | "rules"> & { extends: string };

const COUNTRY_PACKS = [usFda, fssai] as RulePack[];

// A channel pack is its country pack plus the channel's own rules.
function withCountry(channel: ChannelPackFile): RulePack {
  const country = COUNTRY_PACKS.find((p) => p.id === channel.extends)!;
  return {
    ...country,
    id: channel.id,
    label: channel.label,
    version: channel.version,
    extends: country.id,
    basedOn: `${country.label} v${country.version}`,
    rules: [...country.rules, ...channel.rules],
  };
}

// To add a market or channel, add its JSON file here.
export const RULE_PACKS: RulePack[] = [
  COUNTRY_PACKS[0],
  withCountry(amazonUs as ChannelPackFile),
  COUNTRY_PACKS[1],
  withCountry(blinkitIn as ChannelPackFile),
];

export function getRulePack(id: unknown): RulePack | undefined {
  return RULE_PACKS.find((pack) => pack.id === id);
}
