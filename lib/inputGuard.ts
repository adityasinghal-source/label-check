import { MESSAGES } from "./messages";

const MIN_LENGTH = 10;
const MAX_LENGTH = 5000;

// Cheap checks that run before any AI call, so bad input never costs money.
export function checkInput(text: unknown): { ok: true; text: string } | { ok: false; message: string } {
  if (typeof text !== "string") return { ok: false, message: MESSAGES.pasteLabel };
  const trimmed = text.trim();
  if (trimmed.length < MIN_LENGTH || !/\p{L}/u.test(trimmed)) {
    return { ok: false, message: MESSAGES.pasteLabel };
  }
  if (trimmed.length > MAX_LENGTH) return { ok: false, message: MESSAGES.tooLong };
  return { ok: true, text: trimmed };
}
