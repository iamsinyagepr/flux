// Synced from Upskale Studio (upskaleapp/src/lib/studio/editorLanguage.ts). Edit it there, then npm run sync.
import { sourceFoldRanges, type FoldRange } from "./folding";
import type { Text } from "@codemirror/state";
import { bindingCompletions } from "./dataBindings";
import { referenceHover } from "./editorHover";
import { Facet, EditorState } from "@codemirror/state";
import type { ReferenceEntry } from "./registry";
import { completionCall } from "./completionContext";
import {
  StreamLanguage,
  foldService,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightCode, tags } from "@lezer/highlight";
import { linter } from "@codemirror/lint";
import {
  autocompletion,
  setSelectedCompletion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import {
  constructors,
  constructorRegistry,
  functions,
  tokenFamilies,
} from "./registry";
import { analyzeSource } from "./languageService";
import { activeCustomTokens, tokenGroups } from "./projectConfig";
const language = StreamLanguage.define<{
  blockComment: boolean;
  string: boolean;
}>({
  name: "cdsl",
  startState: () => ({ blockComment: false, string: false }),
  token(stream, state) {
    if (state.blockComment) {
      while (!stream.eol()) {
        if (stream.match("*/")) {
          state.blockComment = false;
          break;
        }
        stream.next();
      }
      return "comment";
    }
    if (state.string) {
      let escaped = false;
      while (!stream.eol()) {
        const c = stream.next();
        if (c === '"' && !escaped) {
          state.string = false;
          break;
        }
        escaped = !escaped && c === "\\";
      }
      return "string";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.blockComment = true;
      return "comment";
    }
    if (stream.match('"')) {
      state.string = true;
      return "string";
    }
    if (stream.match(/\d+(?:\.\d+)?/)) return "number";
    if (stream.match(/\b(?:true|false|null)\b/)) return "atom";
    if (stream.match(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/)) {
      const name = stream.current();
      if (/^[A-Z]/.test(name)) return name.includes(".") ? "atom" : "typeName";
      if (/^\s*:/.test(stream.string.slice(stream.pos))) return "propertyName";
      return "variableName";
    }
    if (stream.match(/\?\?|&&|\|\||==|!=|<=|>=|[+*/%!?<>-]/)) return "operator";
    stream.next();
    return "punctuation";
  },
  languageData: {
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    closeBrackets: { brackets: ["(", "[", '"'] },
  },
});
/** Studio's code colours, for the Flux editor and the Dart view's. */
export const highlighting = HighlightStyle.define([
  { tag: tags.typeName, class: "cdsl-constructor" },
  { tag: tags.propertyName, class: "cdsl-property" },
  { tag: tags.string, class: "cdsl-string" },
  { tag: tags.number, class: "cdsl-number" },
  { tag: tags.atom, class: "cdsl-token" },
  { tag: tags.comment, class: "cdsl-comment" },
  { tag: tags.variableName, class: "cdsl-binding" },
  { tag: tags.operator, class: "cdsl-operator" },
]);
export const projectComponentRegistry = Facet.define<
  ReadonlyMap<string, ReferenceEntry>,
  ReadonlyMap<string, ReferenceEntry>
>({ combine: (values) => values[0] ?? new Map() });
/** The page being edited's imports, as names its Flux may read (pageData's importScope). */
export const pageDataScope = Facet.define<Record<string, string>, Record<string, string>>({
  combine: (values) => values[0] ?? {},
});
export const editingComponentName = Facet.define<
  string | undefined,
  string | undefined
>({ combine: (values) => values[0] });
export function complete(context: CompletionContext) {
  const custom =
    context.state.facet(projectComponentRegistry) ??
    new Map<string, ReferenceEntry>();
  const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_.]*/);
  const call = completionCall(
    context.state.sliceDoc(0, word?.from ?? context.pos),
  );
  if (call.inText || (!word && !context.explicit && !call.parameter))
    return null;
  const parameters = call.parameter
    ? (custom.get(call.name ?? "") ?? constructorRegistry.get(call.name ?? ""))
        ?.parameters
    : undefined;
  return {
    from: word?.from ?? context.pos,
    options: parameters
      ? Object.entries(parameters)
          .filter(([name]) => !call.keys.includes(name))
          .map(([name, type]) => ({
            label: name,
            type: "property",
            detail: type,
            apply: name + ": ",
            boost: 10,
          }))
      : [
          ...[
            ...constructors.filter((item) => !custom.has(item.name)),
            ...custom.values(),
          ].map((item) => ({
            label: item.name,
            type: "class",
            detail: item.group,
            info: item.description,
            apply: item.name + "(",
          })),
          ...functions.map((item) => ({
            label: item.name,
            type: "function",
            info: item.description,
            apply: item.name + "(",
          })),
          ...Object.entries(tokenFamilies).flatMap(([family, values]) =>
            values.map((value) => ({
              label: family + "." + value,
              type: "constant",
              detail: "Theme token",
            })),
          ),
          // The project's own tokens from Config, beside the built-ins.
          ...Object.keys(tokenGroups).flatMap((family) =>
            activeCustomTokens(family).map((value) => ({
              label: family + "." + value,
              type: "constant",
              detail: "Project token",
            })),
          ),
          ...bindingCompletions(
            context.state.doc.toString(),
            context.pos,
            word?.text,
          ),
          ...["options", "state"].map((label) => ({ label, type: "variable" })),
        ],
  };
}
const foldCache = new WeakMap<Text, Map<number, FoldRange>>();
export const cdslExtensions = [
  foldService.of((state, from) => {
    let ranges = foldCache.get(state.doc);
    if (!ranges) {
      ranges = sourceFoldRanges(state.doc.toString());
      foldCache.set(state.doc, ranges);
    }
    return ranges.get(from) ?? null;
  }),
  language,
  syntaxHighlighting(highlighting),
  referenceHover(
    (view) => view.state.facet(projectComponentRegistry),
    (view) => view.state.facet(editingComponentName),
  ),
  autocompletion({ override: [complete], selectOnOpen: false }),
  // Clear a browsed suggestion in the same transaction as the edit. Async
  // completion results then retain the unselected (-1) state as they arrive.
  EditorState.transactionExtender.of((transaction) =>
    transaction.docChanged && !transaction.isUserEvent("input.complete")
      ? { effects: setSelectedCompletion(-1) }
      : null,
  ),
  linter(
    (view) =>
      analyzeSource(
        view.state.doc.toString(),
        view.state.facet(projectComponentRegistry),
        view.state.facet(editingComponentName),
        view.state.facet(pageDataScope),
      ).diagnostics.map((issue) => ({
        ...issue,
        from: Math.min(issue.from, view.state.doc.length),
        to: Math.min(Math.max(issue.from, issue.to), view.state.doc.length),
      })),
    { delay: 350 },
  ),
];

/**
 * Highlighting only, for a small Flux snippet (an expression on a property
 * card): no linter or folding, which expect a whole component.
 */
export const cdslSnippetExtensions = [language, syntaxHighlighting(highlighting)];

/**
 * A Flux snippet as highlighted runs of text, the classes the editor gives
 * them (cdsl-string, cdsl-binding…): drawn as plain spans, so a field can
 * show its code coloured without an editor (CodeField, until it's focused).
 */
export function highlightedRuns(code: string): { text: string; className: string }[] {
  const runs: { text: string; className: string }[] = [];
  highlightCode(
    code,
    language.parser.parse(code),
    highlighting,
    (text, className) => runs.push({ text, className }),
    () => runs.push({ text: "\n", className: "" }),
  );
  return runs;
}

/**
 * Completion for one expression (a property's value): the names it can read
 * there (bindings: state.count, product.name…), then Flux's functions and
 * the theme's tokens, the project's own included. No widgets: an expression
 * is a value. Cheap: a prefix filter over lists made once per field.
 */
export function expressionCompletion(
  bindings: () => readonly string[],
  complete?: () => ((prefix: string) => { label: string; detail?: string }[]) | undefined,
) {
  return (context: CompletionContext) => {
    const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_.]*/);
    if (!word && !context.explicit) return null;
    // Not inside a string's text, unless in its ${…}.
    const before = context.state.sliceDoc(0, word?.from ?? context.pos);
    if (completionCall(before).inText) return null;
    const typed = word?.text ?? "";
    // After a dot: the fields of what's before it (state.count, product.name).
    const fields = typed.includes(".") ? complete?.()?.(typed) : undefined;
    if (fields)
      return {
        from: word?.from ?? context.pos,
        validFor: /^[A-Za-z0-9_]*$/,
        options: fields.map((item) => ({ label: item.label, type: "variable", detail: item.detail, boost: 20 })),
      };
    return {
      from: word?.from ?? context.pos,
      validFor: /^[A-Za-z0-9_]*$/,
      options: [
        ...bindings().map((label) => ({ label, type: "variable", boost: 20 })),
        // The component's own: their fields complete after the dot.
        ...["state", "options"].filter((name) => !bindings().includes(name)).map((label) => ({ label, type: "variable", boost: 10 })),
        ...functions.map((item) => ({ label: item.name, type: "function", info: item.description, apply: item.name + "(" })),
        ...Object.entries(tokenFamilies).flatMap(([family, values]) =>
          values.map((value) => ({ label: family + "." + value, type: "constant", detail: "Theme token" })),
        ),
        ...Object.keys(tokenGroups).flatMap((family) =>
          activeCustomTokens(family).map((value) => ({ label: family + "." + value, type: "constant", detail: "Project token" })),
        ),
      ],
    };
  };
}
