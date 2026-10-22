"use client";

import { card, chip } from "@/components/styles";
import type { ArtworkItem, ArtworkRegion, Report } from "@/lib/types";

export type Artwork = { files: { url: string | null; name: string }[]; regions: ArtworkRegion[] };

const ITEMS: Record<ArtworkItem, { label: string; rules: RegExp }> = {
  product_name: { label: "Product name", rules: /SOI|NAME/ },
  veg_mark: { label: "Veg / non-veg mark", rules: /VEG/ },
  fssai_logo: { label: "FSSAI logo and licence no.", rules: /LIC/ },
  net_quantity: { label: "Net quantity", rules: /NET|MULTI-001/ },
  mrp: { label: "MRP", rules: /MRP/ },
  barcode: { label: "Barcode", rules: /QC-001|GS1/ },
  nutrition_table: { label: "Nutrition table", rules: /NUT-001$|IN-FSSAI-NUT(?:100)?$/ },
  ingredients: { label: "Ingredients", rules: /ING|ALG|ADD/ },
};

const EXPECTED: Record<string, ArtworkItem[]> = {
  india: ["product_name", "veg_mark", "fssai_logo", "net_quantity", "mrp", "barcode", "nutrition_table", "ingredients"],
  us: ["product_name", "net_quantity", "nutrition_table", "ingredients", "barcode"],
};

const TONE = {
  ok: { pin: "bg-pass text-page", box: "border-pass", chip: "border border-pass bg-pass-soft text-pass" },
  flagged: { pin: "bg-medium text-page", box: "border-medium", chip: "border border-medium bg-medium-soft text-medium" },
};

// The uploaded artwork with a numbered pin on each item vision found. A pin is amber when a rule about
// that item was still flagged (e.g. the net quantity is there but lacks metric units); click it to see the flag.
export default function ArtworkPreview({ artwork, report, onSelect }: { artwork: Artwork; report: Report; onSelect: (i: number) => void }) {
  const flagFor = (item: ArtworkItem) => report.flags.findIndex((f) => !f.confirmOnly && ITEMS[item].rules.test(f.ruleId));
  const pins = artwork.regions
    .filter((r) => artwork.files[r.file]?.url)
    .map((r, i) => {
      const flagIndex = flagFor(r.item);
      return { ...r, number: i + 1, flagIndex, tone: flagIndex >= 0 ? TONE.flagged : TONE.ok };
    });
  const seen = new Set(artwork.regions.map((r) => r.item));
  const notFound = (EXPECTED[report.market] ?? []).filter((item) => !seen.has(item));
  const images = artwork.files.map((f, i) => ({ ...f, index: i })).filter((f) => f.url);
  if (images.length === 0) return null;

  return (
    <section className={`${card} p-4`} aria-labelledby="artwork-heading">
      <h3 id="artwork-heading" className="font-semibold">
        Annotated artwork preview
      </h3>
      <p className="mt-0.5 text-sm text-muted">
        Pins show where the AI found each item. Green: found, no open flag. Amber: found, but a rule about it is still flagged.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {images.map((file) => (
          <figure key={file.index} className="min-w-0">
            <div className="relative overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={file.url!} alt={`Uploaded artwork: ${file.name}`} className="block w-full" />
              {pins
                .filter((p) => p.file === file.index)
                .map((p) => (
                  <button
                    key={p.number}
                    type="button"
                    onClick={() => p.flagIndex >= 0 && onSelect(p.flagIndex)}
                    aria-label={`${p.number}: ${ITEMS[p.item].label}${p.flagIndex >= 0 ? `, flagged by ${report.flags[p.flagIndex].ruleId}` : ", found"}`}
                    className={`absolute border-2 ${p.tone.box} ${p.flagIndex >= 0 ? "cursor-pointer" : "cursor-default"}`}
                    style={{
                      top: `${p.box[0] / 10}%`,
                      left: `${p.box[1] / 10}%`,
                      height: `${(p.box[2] - p.box[0]) / 10}%`,
                      width: `${(p.box[3] - p.box[1]) / 10}%`,
                    }}
                  >
                    <span
                      className={`absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold shadow ${p.tone.pin}`}
                    >
                      {p.number}
                    </span>
                  </button>
                ))}
            </div>
            <figcaption className="mt-1 truncate text-xs text-muted">{file.name}</figcaption>
          </figure>
        ))}
      </div>

      {pins.length > 0 && (
        <ol className="mt-3 space-y-1 text-sm">
          {pins.map((p) => (
            <li key={p.number} className="flex flex-wrap items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${p.tone.pin}`} aria-hidden>
                {p.number}
              </span>
              {ITEMS[p.item].label}
              {p.flagIndex >= 0 ? (
                <button type="button" onClick={() => onSelect(p.flagIndex)} className={`${chip} ${p.tone.chip} underline`}>
                  See {report.flags[p.flagIndex].ruleId}
                </button>
              ) : (
                <span className={`${chip} ${p.tone.chip}`}>Found</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {notFound.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-semibold text-high">Not found on the artwork:</span> {notFound.map((i) => ITEMS[i].label).join(", ")}
        </p>
      )}
    </section>
  );
}
