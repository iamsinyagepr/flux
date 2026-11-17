// Synced from Upskale Studio (upskaleapp/src/lib/studio/folding.ts). Edit it there, then npm run sync.
export interface FoldRange {
  from: number;
  to: number;
}
/** Match multiline Flux calls, lists and comments, including in incomplete files. */
export function sourceFoldRanges(source: string): Map<number, FoldRange> {
  const ranges = new Map<number, FoldRange>();
  const brackets: { char: string; position: number }[] = [];
  const strings: { type: "string" | "interpolation"; depth: number }[] = [];
  function add(open: number, from: number, to: number) {
    const newline = source.indexOf("\n", from);
    if (newline < 0 || newline >= to) return;
    const line = source.lastIndexOf("\n", open) + 1;
    if (!ranges.has(line) || ranges.get(line)!.from > from)
      ranges.set(line, { from, to });
  }
  for (let i = 0; i < source.length; i++) {
    const char = source[i],
      mode = strings.at(-1);
    if (mode?.type === "string") {
      if (char === "\\") i++;
      else if (char === '"') strings.pop();
      else if (char === "$" && source[i + 1] === "{") {
        strings.push({ type: "interpolation", depth: 1 });
        i++;
      }
      continue;
    }
    if (source.startsWith("//", i)) {
      const end = source.indexOf("\n", i + 2);
      i = end < 0 ? source.length : end - 1;
      continue;
    }
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) break;
      if (!strings.length) add(i, i + 2, end);
      i = end + 1;
      continue;
    }
    if (char === '"') {
      strings.push({ type: "string", depth: 0 });
      continue;
    }
    if (mode?.type === "interpolation") {
      if (char === "{") mode.depth++;
      else if (char === "}" && --mode.depth === 0) strings.pop();
      continue;
    }
    if (char === "(" || char === "[") brackets.push({ char, position: i });
    else if (char === ")" || char === "]") {
      const open = brackets.pop();
      if (open && (char === ")" ? open.char === "(" : open.char === "["))
        add(open.position, open.position + 1, i);
      else brackets.length = 0;
    }
  }
  return ranges;
}
