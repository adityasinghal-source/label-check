"use client";

import { highlightSegments } from "@/lib/highlight";
import type { Flag } from "@/lib/types";

export const MARK_STYLE = {
  high: "bg-red-100 text-red-950 decoration-red-500",
  medium: "bg-amber-100 text-amber-950 decoration-amber-500",
  low: "bg-sky-100 text-sky-950 decoration-sky-500",
};

// The label text with every flagged phrase marked by severity. Clicking a phrase selects its flag.
export default function HighlightedLabel({
  text,
  flags,
  selected,
  onSelect,
}: {
  text: string;
  flags: Flag[];
  selected?: number | null;
  onSelect?: (index: number) => void;
}) {
  return (
    <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-4 leading-8">
      {highlightSegments(text, flags).map((segment, i) => {
        if (segment.flagIndexes.length === 0) return <span key={i}>{segment.text}</span>;
        // Flags are sorted high to low, so the first covering flag is the most severe.
        const index = segment.flagIndexes[0];
        const isSelected = segment.flagIndexes.includes(selected ?? -1);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect?.(index)}
            title={`${flags[index].ruleId}: ${flags[index].ruleName}`}
            className={`inline rounded px-0.5 underline decoration-2 underline-offset-4 ${MARK_STYLE[flags[index].severity]} ${
              isSelected ? "ring-2 ring-gray-900" : ""
            } ${onSelect ? "cursor-pointer" : "cursor-default"}`}
          >
            {segment.text}
          </button>
        );
      })}
    </p>
  );
}
