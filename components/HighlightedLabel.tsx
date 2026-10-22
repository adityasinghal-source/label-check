"use client";

import { SEVERITY_MARK } from "@/components/styles";
import { highlightSegments } from "@/lib/highlight";
import type { Flag } from "@/lib/types";

// The label text with every flagged phrase marked by severity. Hovering shows the rule and risk;
// clicking selects the flag. Each mark carries data-flags so a card can "Locate in label".
export default function HighlightedLabel({
  text,
  flags,
  selected,
  onSelect,
  id,
}: {
  text: string;
  flags: Flag[];
  selected?: number | null;
  onSelect?: (index: number) => void;
  id?: string;
}) {
  return (
    <p id={id} className="whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-4 leading-8">
      {highlightSegments(text, flags).map((segment, i) => {
        if (segment.flagIndexes.length === 0) return <span key={i}>{segment.text}</span>;
        // Flags are sorted high to low, so the first covering flag is the most severe.
        const index = segment.flagIndexes[0];
        const flag = flags[index];
        const isSelected = segment.flagIndexes.includes(selected ?? -1);
        const tip = segment.flagIndexes.map((f) => `${flags[f].severity.toUpperCase()} · ${flags[f].ruleId}`).join("  |  ");
        const tipId = id ? `${id}-tip-${i}` : undefined;
        return (
          <span key={i} className="group relative inline">
            <button
              type="button"
              data-flags={segment.flagIndexes.join(" ")}
              onClick={() => onSelect?.(index)}
              aria-describedby={tipId}
              aria-label={`${flag.severity} risk: ${segment.text}. ${flag.ruleId}: ${flag.ruleName}`}
              className={`inline rounded px-0.5 text-ink underline decoration-2 underline-offset-4 ${SEVERITY_MARK[flag.severity]} ${
                isSelected ? "outline-2 outline-ink" : ""
              } ${onSelect ? "cursor-pointer" : "cursor-default"}`}
            >
              {segment.text}
            </button>
            {onSelect && (
              <span
                id={tipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-semibold text-page shadow group-hover:block group-focus-within:block print:hidden"
              >
                {tip}
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
}
