import { describe, expect, it } from "vitest";
import { checkCodeRules } from "../lib/codeRules";
import { cellFor, channelVerdict } from "../lib/matrix";
import { CHANNELS, getChannels, getMarket, onlineRules } from "../lib/rulepacks";
import { declaredShelfLife } from "../lib/shelfLife";

const INPUT_B =
  "Gluten-free granola bites. Supports healthy blood sugar. Ingredients: rolled oats, peanut butter, honey, natural flavor (contains milk), sea salt";
const india = getMarket("india")!;
const channel = (id: string) => CHANNELS.find((c) => c.id === id)!;

describe("markets and channels", () => {
  it("offers the US with Amazon, and India with seven channels", () => {
    expect(CHANNELS.filter((c) => c.market === "us").map((c) => c.label)).toEqual(["Amazon (US)"]);
    expect(CHANNELS.filter((c) => c.market === "india").map((c) => c.label)).toEqual([
      "Amazon India",
      "Blinkit",
      "Zepto",
      "Swiggy Instamart",
      "Flipkart Minutes",
      "Amazon Now",
      "BigBasket BB Now",
    ]);
  });

  it("only accepts channels from the chosen market", () => {
    expect(getChannels("india", ["blinkit", "amazon-us", "made-up"]).map((c) => c.id)).toEqual(["blinkit"]);
  });

  it("gives every rule an ID, a plain name and a source link", () => {
    const rules = [...getMarket("us")!.pack.rules, ...india.pack.rules, ...onlineRules("india"), ...CHANNELS.flatMap((c) => c.rules)];
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.source.url).toMatch(/^https:\/\//);
      expect(typeof rule.verified).toBe("boolean");
    }
  });

  it("says when a channel has no public rules of its own", () => {
    expect(channel("flipkart-minutes").rules).toEqual([]);
    expect(channel("flipkart-minutes").note).toContain("No public channel-specific rules");
  });
});

describe("India label declarations (FSSAI + Legal Metrology)", () => {
  it("flags every missing declaration on the granola label", () => {
    const ids = checkCodeRules(INPUT_B, india.pack.rules).map((f) => f.ruleId);
    expect(ids).toEqual([
      "IN-FSSAI-LIC",
      "IN-FSSAI-VEG",
      "IN-LM-NET",
      "IN-LM-MRP",
      "IN-LM-DATE",
      "IN-LM-MFR",
      "IN-FSSAI-NUT",
      "IN-LM-CARE",
      "IN-LM-ORIGIN",
      "IN-LM-BATCH",
      "IN-LM-MFD",
    ]);
  });

  it("passes a label that has them all", () => {
    const full = `${INPUT_B}\nVeg. Net quantity: 200 g. MRP ₹149 (incl. of all taxes). Best before 6 months from manufacture. Mfd. on: 10/2026. Batch No.: B2610.\nManufactured by: Good Foods Pvt Ltd, Pune. Country of origin: India. Customer care: 1800 123 4567 | care@goodfoods.in\nFSSAI Lic. No. 10012345678901\nNutritional information per 100 g / per serve: Energy 450 kcal`;
    expect(checkCodeRules(full, india.pack.rules)).toEqual([]);
  });

  it("flags 'all natural' but not 'natural flavor' in the ingredients", () => {
    const text = "All natural granola. Ingredients: oats, natural flavor";
    const natural = checkCodeRules(text, india.pack.rules).filter((f) => f.ruleId === "IN-FSSAI-NAT");
    expect(natural.map((f) => f.quotedText)).toEqual(["All natural granola"]);
  });
});

describe("channel layers", () => {
  it("flags 'supports healthy blood sugar' on Amazon US, as unverified", () => {
    const flags = checkCodeRules(INPUT_B, channel("amazon-us").rules, ["amazon-us"]);
    expect(flags.map((f) => [f.ruleId, f.quotedText, f.verified])).toEqual([["AMZ-US-001", "Supports healthy blood sugar", false]]);
  });

  it("reads a declared shelf life in days", () => {
    expect(declaredShelfLife("Best before 2 months from manufacture")?.days).toBe(60);
    expect(declaredShelfLife("Shelf life: 120 days")?.days).toBe(120);
    expect(declaredShelfLife("No dates here")).toBeNull();
  });

  it("fails a 2-month shelf life on Amazon India but not on Flipkart Minutes", () => {
    const label = "Granola. Best before 2 months from manufacture. Ingredients: oats";
    const amazon = checkCodeRules(label, channel("amazon-in").rules, ["amazon-in"]);
    const shelf = amazon.find((f) => f.ruleId === "AMZ-IN-001")!;
    expect(shelf.quotedText).toBe("Best before 2 months");
    expect(cellFor(shelf, "amazon-in")).toBe("fail");
    expect(cellFor(shelf, "flipkart-minutes")).toBe("pass");
  });

  it("asks to confirm shelf life when the label doesn't state one", () => {
    const [flag] = checkCodeRules(INPUT_B, channel("blinkit").rules, ["blinkit"]);
    expect(flag.ruleId).toBe("BLK-001");
    expect(flag.confirmOnly).toBe(true);
  });
});

describe("channel matrix", () => {
  it("never shows an unverified rule as a hard fail", () => {
    const label = "Granola. Best before 2 months. Ingredients: oats";
    const blinkit = checkCodeRules(label, channel("blinkit").rules, ["blinkit"]).find((f) => f.ruleId === "BLK-001")!;
    expect(blinkit.verified).toBe(false);
    expect(cellFor(blinkit, "blinkit")).toBe("warn");
  });

  it("applies market rules to every channel column", () => {
    const [missingMrp] = checkCodeRules("Granola. Ingredients: oats", india.pack.rules).filter((f) => f.ruleId === "IN-LM-MRP");
    expect(cellFor(missingMrp, "blinkit")).toBe("fail");
    expect(cellFor(missingMrp, "zepto")).toBe("fail");
    expect(channelVerdict([missingMrp], "zepto")).toEqual({ tone: "fail", label: "Fails" });
  });
});
