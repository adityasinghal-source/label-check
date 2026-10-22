// Word-level diff between the draft and the fixed draft, for the "Highlight changes" view.
// Words and the whitespace between them are separate tokens, so the layout survives.

export type DiffPart = { text: string; change: "same" | "removed" | "added" };

const tokens = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];

// A space shared by both sides between two changed words would split one change into many: fold it in.
function joinRuns(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const prev = out.at(-1);
    const next = parts[i + 1];
    if (prev && next && part.change === "same" && !part.text.trim() && prev.change !== "same" && next.change === prev.change) {
      prev.text += part.text + next.text;
      i++;
    } else if (prev && prev.change === part.change) {
      prev.text += part.text;
    } else {
      out.push({ ...part });
    }
  }
  return out;
}

// Longest common subsequence over tokens. Labels are at most a few thousand words, so the table stays small.
export function wordDiff(before: string, after: string): { before: DiffPart[]; after: DiffPart[] } {
  const a = tokens(before);
  const b = tokens(after);
  const lcs: Uint16Array[] = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const left: DiffPart[] = [];
  const right: DiffPart[] = [];
  const push = (list: DiffPart[], text: string, change: DiffPart["change"]) => {
    // Whitespace between two changed words joins the change, so a replaced phrase reads as one block.
    const last = list.at(-1);
    if (last && last.change === change) last.text += text;
    else list.push({ text, change });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push(left, a[i], "same");
      push(right, b[j], "same");
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      push(right, b[j++], "added");
    } else {
      push(left, a[i++], "removed");
    }
  }
  return { before: joinRuns(left), after: joinRuns(right) };
}
