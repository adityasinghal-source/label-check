import { MissingKeyError, readLabelImage, type ImageType } from "@/lib/ai";
import { MESSAGES } from "@/lib/messages";
import type { ReadImageResponse } from "@/lib/types";

export const maxDuration = 60;

const ALLOWED_TYPES: ImageType[] = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function reply(body: ReadImageResponse) {
  return Response.json(body);
}

export async function POST(request: Request) {
  const unreadable = reply({ status: "needs_text", message: MESSAGES.imageUnreadable });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return unreadable;
  if (!ALLOWED_TYPES.includes(file.type as ImageType)) return unreadable;

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await readLabelImage(base64, file.type as ImageType);
    if (!result.readable || result.text.trim().length < 10) return unreadable;
    return reply({ status: "ok", text: result.text.trim() });
  } catch (error) {
    if (error instanceof MissingKeyError) return reply({ status: "error", message: MESSAGES.missingKey });
    console.error("Image read failed:", error);
    return reply({ status: "error", message: MESSAGES.checkerFailed });
  }
}
