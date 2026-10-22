import type { RulePack } from "../types";
import usFda from "./us-fda-v0.1.json";
import fssai from "./fssai-v0.1.json";

// To add a market, add its JSON file here.
export const RULE_PACKS = [usFda, fssai] as RulePack[];

export function getRulePack(id: unknown): RulePack | undefined {
  return RULE_PACKS.find((pack) => pack.id === id);
}
