// Synced from Upskale Studio (upskaleapp/src/lib/studio/editorReference.ts). Edit it there, then npm run sync.
import { lex } from "./parser";
import { completionCall } from "./completionContext";
import {
  constructorRegistry,
  functionRegistry,
  type ReferenceEntry,
} from "./registry";
export function referenceAt(
  source: string,
  position: number,
  side: -1 | 1,
  custom: ReadonlyMap<string, ReferenceEntry> = new Map(),
  currentComponent?: string,
): { from: number; to: number; entry: ReferenceEntry } | null {
  const lineFrom = source.lastIndexOf("\n", position - 1) + 1;
  const lineEnd = source.indexOf("\n", position);
  const line = source.slice(lineFrom, lineEnd < 0 ? source.length : lineEnd);
  for (const match of line.matchAll(/[A-Za-z_][A-Za-z0-9_.]*/g)) {
    const from = lineFrom + match.index!,
      to = from + match[0].length;
    if (
      position < from ||
      position > to ||
      (position === from && side < 0) ||
      (position === to && side > 0)
    )
      continue;
    try {
      if (
        !lex(source).some(
          (token) => token.kind === "name" && token.from === from,
        )
      )
        return null;
    } catch {
      if (completionCall(source.slice(0, from)).inText) return null;
    }
    if (
      !/^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*\(/.test(source.slice(to))
    )
      return null;
    const name = match[0];
    const entry =
      (name === currentComponent && constructorRegistry.has(name)
        ? constructorRegistry.get(name)
        : custom.get(name)) ??
      constructorRegistry.get(name) ??
      functionRegistry.get(name);
    return entry ? { from, to, entry } : null;
  }
  return null;
}
