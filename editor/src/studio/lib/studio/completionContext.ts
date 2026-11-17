// Synced from Upskale Studio (upskaleapp/src/lib/studio/completionContext.ts). Edit it there, then npm run sync.
// A tolerant scan keeps parameter completion available while a call is incomplete.
export function completionCall(source: string): {
  name?: string;
  keys: string[];
  parameter: boolean;
  inText: boolean;
} {
  const stack: { name?: string; keys: string[]; parameter: boolean }[] = [];
  const tokens =
    source.match(
      /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*(?:"|$)|[A-Za-z_][A-Za-z0-9_.]*|[^\s]/g,
    ) ?? [];
  let previous = "",
    inText = false;
  for (const token of tokens) {
    if (token.startsWith("//") || token.startsWith("/*")) {
      inText =
        (!token.endsWith("*/") && token.startsWith("/*")) ||
        (token.startsWith("//") &&
          token === tokens.at(-1) &&
          !source.endsWith("\n"));
      continue;
    }
    if (token.startsWith('"')) {
      inText = !token.endsWith('"') || token.length === 1;
      previous = token;
      continue;
    }
    if (token === "(" || token === "[")
      stack.push({
        name: token === "(" ? previous : undefined,
        keys: [],
        parameter: token === "(",
      });
    else if (token === ")" || token === "]") stack.pop();
    else if (token === "," && stack.length)
      stack.at(-1)!.parameter = !!stack.at(-1)!.name;
    else if (token === ":" && stack.length) {
      stack.at(-1)!.keys.push(previous);
      stack.at(-1)!.parameter = false;
    }
    previous = token;
  }
  return { ...(stack.at(-1) ?? { keys: [], parameter: false }), inText };
}
