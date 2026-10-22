import type { PackDimensions } from "./pdp";
import type { PackType } from "./types";

// Everything needed to re-run a check, packed into a link: ?state=<deflate-compressed JSON, base64url>.
export type SharedInputs = {
  text: string;
  market: string;
  channels: string[];
  category: string;
  rejection: string;
  packType: PackType;
  dimensions: PackDimensions | null;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function encodeState(inputs: SharedInputs): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(inputs));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

// null when the link is damaged or isn't one of ours; every field is checked, since anyone can edit a URL.
export async function decodeState(encoded: string): Promise<SharedInputs | null> {
  try {
    const json = new TextDecoder().decode(await pipe(fromBase64Url(encoded), new DecompressionStream("deflate-raw")));
    const v = JSON.parse(json);
    const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
    const d = v.dimensions;
    return {
      text: str(v.text, 6000),
      market: str(v.market, 20),
      channels: Array.isArray(v.channels) ? v.channels.filter((c: unknown) => typeof c === "string").slice(0, 20) : [],
      category: str(v.category, 40) || "general",
      rejection: str(v.rejection, 6000),
      packType: v.packType === "multi" ? "multi" : "single",
      dimensions:
        d && typeof d === "object" && typeof d.width === "number"
          ? { shape: d.shape, unit: d.unit, width: d.width, height: typeof d.height === "number" ? d.height : 0 }
          : null,
    };
  } catch {
    return null;
  }
}
