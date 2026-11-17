// Synced from Upskale Studio (upskaleapp/src/lib/studio/formatter.ts). Edit it there, then npm run sync.
import { childrenOf, lex, parseSource, type CallExpr, type Expr, type Token } from "./parser";
import { MAX_SOURCE_BYTES, sourceBytes } from "./types";

type FormatToken = Token & { comment?: "line" | "block" };

/** Blocks of declarations (FLUX.md), their entries each on one line when they fit. */
const LIST_BLOCKS = new Set(["usingServer", "usingClient", "State", "Options", "Variants"]);

/** Format whitespace only, keeping string/interpolation and comment text intact. */
export function formatSource(source: string): string {
  const parsed = parseSource(source);
  if (!parsed.root) {
    throw new Error(
      `Cannot format source: ${parsed.diagnostics[0]?.message ?? "fix syntax errors first."}`,
    );
  }
  const tokens: FormatToken[] = [];
  let offset = 0;
  for (const token of lex(source)) {
    const gap = source.slice(offset, token.from);
    for (const match of gap.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)) {
      const from = offset + match.index!;
      tokens.push({
        kind: "symbol",
        text: match[0].replace(/\r$/, ""),
        from,
        to: from + match[0].length,
        comment: match[0].startsWith("//") ? "line" : "block",
      });
    }
    if (token.kind !== "end") tokens.push(token);
    offset = token.to;
  }
  const root = parsed.root;
  let formatted: string;
  if (!root.blocks?.length) formatted = formatTokens(tokens, true);
  else {
    // The block form (FLUX.md): its header, then each block, each on its own
    // with a blank line between; a comment goes with what follows it. The
    // header stays on one line unless it's long; a block is one entry a line.
    const headerEnd = tokens.filter((token) => !token.comment && token.to <= root.blocks![0].from).at(-1)!.to;
    const ends = [headerEnd, ...root.blocks.map((block) => block.to)];
    const pieces: string[] = [];
    let start = 0;
    ends.forEach((end, index) => {
      let stop = tokens.findIndex((token, at) => at >= start && !token.comment && token.to === end) + 1;
      // A comment after the last block stays with it.
      if (index === ends.length - 1) stop = tokens.length;
      // The header, and a declaration block's entries, read as a list: on one
      // line unless long. Widgets (Build, Parts, Variants) as anywhere else.
      const name = index === 0 ? "" : root.blocks![index - 1].name;
      const compact = index === 0 ? 1 : LIST_BLOCKS.has(name) ? 2 : 0;
      pieces.push(formatTokens(tokens.slice(start, stop), index > 0, compact).trimEnd());
      start = stop;
    });
    formatted = pieces.join("\n\n") + "\n";
  }
  if (sourceBytes(formatted) > MAX_SOURCE_BYTES)
    throw new Error("Formatted source would exceed the 64 KB limit.");
  return formatted;
}

/**
 * Tokens (with their comments) as formatted text. `expandTop`: the outermost
 * call is one argument a line whenever it has any (a file's single call, a
 * block); otherwise only when it's long, as any call inside.
 */
function formatTokens(tokens: FormatToken[], expandTop: boolean, compactDepth = 0): string {
  const multiline = new Set<number>(),
    stack: number[] = [];
  tokens.forEach((token, index) => {
    if (token.comment || token.kind !== "symbol") return;
    if (token.text === "(" || token.text === "[") stack.push(index);
    else if (token.text === ")" || token.text === "]") {
      const start = stack.pop()!;
      const inside = tokens.slice(start + 1, index);
      const compact = stack.length < compactDepth && !(stack.length === 0 && expandTop);
      if (
        inside.length &&
        ((stack.length === 0 && expandTop) ||
          inside.reduce((length, item) => length + item.text.length + 1, 0) >
            80 ||
          inside.some((item) => item.comment || (!compact && item.text === ",")))
      )
        multiline.add(start);
    }
  });
  let output = "",
    indent = 0;
  const frames: boolean[] = [];
  // Open `?`s per bracket depth: the `:` that closes one is a conditional's,
  // spaced on both sides, not an argument's.
  const conditionals: number[] = [0];
  const line = () => {
    output = output.replace(/[ \t]+$/, "");
    if (output && !output.endsWith("\n")) output += "\n";
  };
  const write = (text: string) => {
    if (!output || output.endsWith("\n")) output += "  ".repeat(indent);
    output += text;
  };
  const space = () => {
    if (output && !/\s$/.test(output)) output += " ";
  };
  let previous: FormatToken | undefined;
  let unary = false;
  tokens.forEach((token, index) => {
    const text = token.text;
    if (token.comment) {
      space();
      write(text);
      if (token.comment === "line" || text.includes("\n")) line();
      else space();
      return;
    }
    if (token.kind === "symbol" && (text === "(" || text === "[")) {
      const expand = multiline.has(index);
      write(text);
      frames.push(expand);
      conditionals.push(0);
      if (expand) {
        indent++;
        line();
      }
    } else if (token.kind === "symbol" && (text === ")" || text === "]")) {
      if (frames.pop()) {
        indent--;
        line();
      }
      if (conditionals.length > 1) conditionals.pop();
      write(text);
    } else if (token.kind === "symbol" && text === ",") {
      write(text);
      if (frames.at(-1)) line();
      else space();
    } else if (token.kind === "symbol" && text === ".") write(text);
    else if (token.kind === "symbol" && text === ":") {
      if (conditionals[conditionals.length - 1] > 0) {
        conditionals[conditionals.length - 1]--;
        space();
      }
      write(text);
      space();
    } else if (token.kind === "symbol") {
      if (text === "?") conditionals[conditionals.length - 1]++;
      const isUnary =
        (text === "!" || text === "-") &&
        (!previous ||
          (previous.kind === "symbol" &&
            ![".", ")", "]"].includes(previous.text)));
      if (!isUnary) space();
      write(text);
      if (!isUnary) space();
      unary = isUnary;
      previous = token;
      return;
    } else {
      if (
        previous &&
        !unary &&
        (previous.kind !== "symbol" || [")", "]"].includes(previous.text))
      )
        space();
      write(text);
    }
    unary = false;
    previous = token;
  });
  return output.trimEnd() + "\n";
}

/** The smallest call containing [from, to]: the widget an edit touched. */
function enclosingCall(root: Expr, from: number, to: number): CallExpr | undefined {
  let found: CallExpr | undefined;
  const visit = (expr: Expr) => {
    if (expr.from > from || expr.to < to) return;
    if (expr.type === "call") found = expr;
    for (const child of childrenOf(expr)) visit(child);
  };
  visit(root);
  return found;
}

/**
 * Format only the call an edit touched (the smallest one around [from, to]),
 * at the indentation it already has, and leave the rest of the file exactly
 * as it was written. Formatting the whole file after adding one widget
 * rewrites code nobody touched, and moves the view away from the change.
 * Whitespace only, like formatSource: the tokens are the same either way.
 */
export function formatAround(source: string, from: number, to: number): string {
  const formatted = formatSource(source);
  const root = parseSource(source).root;
  const node = root && enclosingCall(root, from, to);
  if (!node || node === root) return formatted;
  const mine = lex(source).filter((token) => token.kind !== "end");
  const theirs = lex(formatted).filter((token) => token.kind !== "end");
  if (mine.length !== theirs.length) return formatted;
  const first = mine.findIndex((token) => token.from >= node.from);
  let last = -1;
  for (let index = mine.length - 1; index >= 0; index--)
    if (mine[index].to <= node.to) {
      last = index;
      break;
    }
  if (first < 0 || last < first) return formatted;
  const indentAt = (text: string, at: number) => /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", at - 1) + 1, at))![0];
  const formattedIndent = indentAt(formatted, theirs[first].from);
  const ownIndent = indentAt(source, mine[first].from);
  const region = formatted
    .slice(theirs[first].from, theirs[last].to)
    .split("\n")
    .map((line, index) =>
      index > 0 && line.startsWith(formattedIndent) ? ownIndent + line.slice(formattedIndent.length) : line,
    )
    .join("\n");
  return source.slice(0, mine[first].from) + region + source.slice(mine[last].to);
}

/** Keep the caret on the same token when whitespace moves. */
export function formattedPosition(
  before: string,
  after: string,
  position: number,
): number {
  const oldTokens = lex(before),
    newTokens = lex(after);
  const index = oldTokens.findIndex((token) => token.to >= position);
  const old = oldTokens[index],
    next = newTokens[index];
  return old && next
    ? next.from +
        Math.max(0, Math.min(position - old.from, next.to - next.from))
    : after.length;
}
