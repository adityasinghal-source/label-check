import { findPlaceholders } from "./codeRules";

export type FactField = { token: string; label: string; kind: "fssai" | "email" | "phone" | "text" };

// One input per placeholder left in the fixed draft, e.g. "[14-digit licence number]" → "14-digit licence number".
export function factFields(text: string): FactField[] {
  return findPlaceholders(text).map((token) => {
    const label = token.replace(/^[[<]|[\]>]$/g, "").trim() || token;
    const kind = /fssai|licen[cs]e/i.test(label) ? "fssai" : /email/i.test(label) ? "email" : /phone/i.test(label) ? "phone" : "text";
    return { token, label, kind };
  });
}

// Why a value can't be used yet, or null if it's fine. Empty = not filled in (still a placeholder).
export function factProblem(field: FactField, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (field.kind === "fssai") {
    if (!/^\d{14}$/.test(v)) return "An FSSAI licence number is exactly 14 digits.";
    if (findPlaceholders(v).length) return "That looks like a dummy number. Use your real licence number.";
  }
  if (field.kind === "email" && !/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(v)) return "Enter an email address, e.g. care@brand.in.";
  if (field.kind === "phone" && !/^\+?[\d\s()-]{8,}$/.test(v)) return "Enter a phone number, e.g. 1800 123 4567.";
  return null;
}

// The draft with every valid value put in place of its placeholder. Unfilled or invalid ones stay,
// so the next check still flags them.
export function fillFacts(text: string, fields: FactField[], values: Record<string, string>): string {
  return fields.reduce((t, field) => {
    const value = (values[field.token] ?? "").trim();
    return value && !factProblem(field, value) ? t.split(field.token).join(value) : t;
  }, text);
}
