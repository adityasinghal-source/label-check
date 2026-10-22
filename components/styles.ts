// Shared class names, built on the colour tokens in app/globals.css (which handle dark mode).
// Every chip pairs a soft background with a strong text colour or the ink colour: at least 4.5:1 contrast.
export const SEVERITY_CHIP = {
  high: "border border-high bg-high-soft text-high",
  medium: "border border-medium bg-medium-soft text-medium",
  low: "border border-low bg-low-soft text-low",
};

export const SEVERITY_MARK = {
  high: "bg-high-soft decoration-high",
  medium: "bg-medium-soft decoration-medium",
  low: "bg-low-soft decoration-low",
};

export const card = "rounded-xl border border-line bg-surface";
export const chip = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold";
export const chipNeutral = "border border-ink/30 bg-raised text-ink";
export const chipUnverified = "border border-medium bg-medium-soft text-medium";
export const sectionLabel = "text-xs font-semibold uppercase tracking-wide text-muted";
export const secondaryButton =
  "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-raised disabled:opacity-50";
