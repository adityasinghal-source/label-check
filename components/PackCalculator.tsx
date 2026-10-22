"use client";

import { useState } from "react";
import { printSizes, SHAPES, validDimensions, type PackDimensions } from "@/lib/pdp";

export type DimensionsDraft = { shape: PackDimensions["shape"]; unit: PackDimensions["unit"]; width: string; height: string };
export const EMPTY_DIMENSIONS: DimensionsDraft = { shape: "rect", unit: "cm", width: "", height: "" };

export function toDimensions(d: DimensionsDraft): PackDimensions | null {
  const dims = { shape: d.shape, unit: d.unit, width: Number(d.width), height: d.shape === "custom" ? 0 : Number(d.height) };
  return d.width.trim() && validDimensions(dims) ? dims : null;
}

const field = "mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

// Optional: pack size → principal display panel area → minimum print sizes (shown live, and in the report).
export default function PackCalculator({
  market,
  value,
  onChange,
}: {
  market: string;
  value: DimensionsDraft;
  onChange: (d: DimensionsDraft) => void;
}) {
  const [open, setOpen] = useState(!!value.width);
  const dims = toDimensions(value);
  const sizes = dims ? printSizes(market, dims) : null;
  const set = (patch: Partial<DimensionsDraft>) => onChange({ ...value, ...patch });
  const sq = `${value.unit}²`;

  return (
    <div className="rounded-lg border border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="pack-calculator"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold"
      >
        <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}>
          <path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        Pack dimensions &amp; font calculator <span className="font-normal text-muted">(optional)</span>
      </button>
      <div id="pack-calculator" hidden={!open} className="space-y-3 px-3 pb-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="text-xs font-semibold">
            Shape
            <select value={value.shape} onChange={(e) => set({ shape: e.target.value as DimensionsDraft["shape"] })} className={field}>
              {SHAPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Unit
            <select value={value.unit} onChange={(e) => set({ unit: e.target.value as DimensionsDraft["unit"] })} className={field}>
              <option value="cm">cm</option>
              <option value="in">in</option>
            </select>
          </label>
        </div>
        {value.shape === "custom" ? (
          <label className="block text-xs font-semibold">
            Front panel area ({sq})
            <input inputMode="decimal" value={value.width} onChange={(e) => set({ width: e.target.value })} className={field} />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold">
              {value.shape === "cylinder" ? "Diameter" : "Width"} ({value.unit})
              <input inputMode="decimal" value={value.width} onChange={(e) => set({ width: e.target.value })} className={field} />
            </label>
            <label className="text-xs font-semibold">
              Height ({value.unit})
              <input inputMode="decimal" value={value.height} onChange={(e) => set({ height: e.target.value })} className={field} />
            </label>
          </div>
        )}
        <p className="text-xs" aria-live="polite">
          {sizes ? (
            <>
              <span className="font-semibold">
                PDP area {sizes.area.toLocaleString()} {sizes.areaUnit}
              </span>{" "}
              → {sizes.specs[0].item}: at least {sizes.specs[0].minimum}. Full sizes appear in the report&apos;s print-readiness checklist.
            </>
          ) : (
            <span className="text-muted">Enter the front panel size to get the minimum print sizes for {market === "india" ? "India" : "the US"}.</span>
          )}
        </p>
      </div>
    </div>
  );
}
