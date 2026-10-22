import { MissingKeyError, readLabelImages, type Upload, type UploadType } from "@/lib/ai";
import { MESSAGES } from "@/lib/messages";
import type { ArtworkRegion, PanelId, ReadImageResponse } from "@/lib/types";
import { connection } from "next/server";

export const maxDuration = 60;

const ALLOWED_TYPES: UploadType[] = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 3;
const PANELS: PanelId[] = ["front", "back", "nutrition"];

// Keep only boxes on a real file with sensible 0–1000 coordinates; PDFs have no image to pin them on.
function cleanRegions(regions: { file: number; item: ArtworkRegion["item"]; box: number[] }[], fileCount: number): ArtworkRegion[] {
  return regions
    .filter((r) => Number.isInteger(r.file) && r.file >= 1 && r.file <= fileCount && r.box.length === 4)
    .map((r) => ({ ...r, file: r.file - 1, box: r.box.map((n) => Math.min(1000, Math.max(0, n))) as ArtworkRegion["box"] }))
    .filter((r) => r.box[2] > r.box[0] && r.box[3] > r.box[1]);
}

function reply(body: ReadImageResponse) {
  return Response.json(body);
}

// Warm-up ping from the page on load (see app/api/check/route.ts).
export async function GET() {
  await connection();
  return Response.json({ ok: true });
}

// Up to 3 photos or PDF dielines → the text of each panel, plus the symbols vision saw.
export async function POST(request: Request) {
  const unreadable = reply({ status: "needs_text", message: MESSAGES.imageUnreadable });

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  const panels = (form?.getAll("panels") ?? []).map(String);
  if (files.length === 0 || files.length > MAX_FILES) return unreadable;
  if (files.some((f) => f.size === 0 || f.size > MAX_BYTES || !ALLOWED_TYPES.includes(f.type as UploadType))) {
    return reply({ status: "needs_text", message: MESSAGES.uploadRules });
  }

  try {
    const uploads: Upload[] = await Promise.all(
      files.map(async (f, i) => ({
        base64: Buffer.from(await f.arrayBuffer()).toString("base64"),
        type: f.type as UploadType,
        panel: PANELS.includes(panels.at(i) as PanelId) ? (panels.at(i) as string) : "",
        name: f.name || `file-${i + 1}`,
      })),
    );
    const result = await readLabelImages(uploads);
    const text = [result.front, result.back, result.nutrition].join("\n").trim();
    if (!result.readable || text.length < 10) return unreadable;
    return reply({
      status: "ok",
      text,
      panels: { front: result.front.trim(), back: result.back.trim(), nutrition: result.nutrition.trim() },
      visual: { vegMark: result.veg_mark !== "not_seen", fssaiLogo: result.fssai_logo, barcode: result.barcode },
      regions: cleanRegions(result.regions, files.length),
    });
  } catch (error) {
    if (error instanceof MissingKeyError) return reply({ status: "error", message: MESSAGES.missingKey });
    console.error("Upload read failed:", error);
    return reply({ status: "error", message: MESSAGES.checkerFailed });
  }
}
