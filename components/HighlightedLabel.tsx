"use client";

import { SEVERITY_MARK } from "@/components/styles";
import { highlightSegments } from "@/lib/highlight";
import type { Flag } from "@/lib/types";

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
    <p className="whitespace-pre-wrap break-words rounded-xl border border-line bg-surface p-4 leading-8">
      {highlightSegments(text, flags).map((segment, i) => {
        if (segment.flagIndexes.length === 0) return <span key={i}>{segment.text}</span>;
        // Flags are sorted high to low, so the first covering flag is the most severe.
        const index = segment.flagIndexes[0];
        const flag = flags[index];
        const isSelected = segment.flagIndexes.includes(selected ?? -1);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect?.(index)}
            title={`${flag.ruleId}: ${flag.ruleName}`}
            aria-label={`${flag.severity} risk: ${segment.text}. ${flag.ruleId}: ${flag.ruleName}`}
            className={`inline rounded px-0.5 text-ink underline decoration-2 underline-offset-4 ${SEVERITY_MARK[flag.severity]} ${
              isSelected ? "outline-2 outline-ink" : ""
            } ${onSelect ? "cursor-pointer" : "cursor-default"}`}
          >
            {segment.text}
          </button>
        );
      })}
    </p>
  );
}
