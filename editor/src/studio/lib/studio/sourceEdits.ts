// Synced from Upskale Studio (upskaleapp/src/lib/studio/sourceEdits.ts). Edit it there, then npm run sync.
/**
 * Structural edits for the Visual editor: set or remove a property, insert,
 * delete, duplicate or wrap a widget, add a declaration.
 *
 * Like explorer moves (sourceMoves.ts), every edit rewrites only the source
 * ranges it touches — comments and hand-written expressions elsewhere stay
 * exactly as authored — then formats the result and reports where the edited
 * node landed, so the Code editor can apply it as one undoable change.
 * An edit that would leave the source unparseable is refused.
 */
import { blockEntry, LIST_BLOCKS, newBlockEdit } from "./blockSource";
import { formatSource, formatAround } from "./formatter";
import {
  childrenOf,
  lex,
  literalValue,
  parseSource,
  type CallExpr,
  type Expr,
  type Token,
} from "./parser";
import { constructorRegistry, type ReferenceEntry } from "./registry";

export interface SourceRangeRef {
  from: number;
  to: number;
}
export interface SourceEdit {
  source: string;
  selection: SourceRangeRef;
}
export interface EditContext {
  /** The project's own components, as the language service describes them. */
  components?: ReadonlyMap<string, ReferenceEntry>;
  /** The component being edited, which may shadow a built-in of its name. */
  currentComponent?: string;
}
type ListExpr = Extract<Expr, { type: "list" }>;
export interface CallLocation {
  node: CallExpr;
  parent?: CallExpr;
  /** The parent's parameter this call sits in. */
  param?: string;
  /** The list it is an item of, when it is one. */
  list?: ListExpr;
}
export type InsertPlacement = "inside" | "before" | "after";

const WIDGET_GROUPS = [
  "Layout",
  "Content",
  "Behavior",
  "Composition",
  "Storefront",
  "Storefront controls",
  "Forms",
  "Components",
  "Library",
];

/** The registry entry describing a call: a project component, or a built-in. */
export function definitionOf(
  node: CallExpr,
  context: EditContext = {},
): ReferenceEntry | undefined {
  if (node.name === context.currentComponent && constructorRegistry.has(node.name))
    return constructorRegistry.get(node.name);
  return context.components?.get(node.name) ?? constructorRegistry.get(node.name);
}

/** Whether a call builds a widget (rather than an action, value or declaration). */
export function isWidget(node: CallExpr, context: EditContext = {}): boolean {
  return WIDGET_GROUPS.includes(definitionOf(node, context)?.group ?? "");
}

/** A widget slot a call offers: a single child, or a list of children. */
export interface WidgetSlot {
  name: string;
  list: boolean;
  required: boolean;
  /** Already holds something (an expression list counts as filled). */
  filled: boolean;
}

/** The widget slots of a call, in registry order. */
export function widgetSlots(node: CallExpr, context: EditContext = {}): WidgetSlot[] {
  const entry = definitionOf(node, context);
  if (!entry) return [];
  return Object.entries(entry.parameters)
    .filter(([, type]) => type === "Widget" || type === "List<Widget>")
    .map(([name, type]) => {
      const value = node.args[name];
      return {
        name,
        list: type === "List<Widget>",
        required: entry.required.includes(name),
        filled: !!value && !(isPlaceholder(value) && type === "Widget"),
      };
    });
}

/** `SizedBox()` with no arguments marks an emptied required widget slot. */
function isPlaceholder(expr: Expr): boolean {
  return expr.type === "call" && expr.name === "SizedBox" && !Object.keys(expr.args).length;
}

function parseOrThrow(source: string) {
  const parsed = parseSource(source);
  if (!parsed.root)
    throw new Error(
      "Fix the source syntax in Code view before editing visually: " +
        (parsed.diagnostics[0]?.message ?? "the source cannot be read."),
    );
  return parsed.root;
}

/** Every call in a source with where it sits, in source order. */
export function callLocations(root: CallExpr): CallLocation[] {
  const locations: CallLocation[] = [];
  function walk(node: Expr, parent?: CallExpr, param?: string, list?: ListExpr) {
    if (node.type === "call") {
      locations.push({ node, parent, param, list });
      for (const [key, child] of Object.entries(node.args)) walk(child, node, key);
      node.positional.forEach((child) => walk(child, node));
    } else if (node.type === "list") {
      node.items.forEach((child) => walk(child, parent, param, node));
    } else childrenOf(node).forEach((child) => walk(child, parent, param));
  }
  walk(root);
  return locations;
}

/** The call at exactly this range. */
export function locateCall(source: string, range: SourceRangeRef): CallLocation | undefined {
  const root = parseSource(source).root;
  if (!root) return undefined;
  return callLocations(root).find(({ node }) => node.from === range.from && node.to === range.to);
}

function locate(source: string, range: SourceRangeRef): CallLocation {
  const root = parseOrThrow(source);
  const found = callLocations(root).find(
    ({ node }) => node.from === range.from && node.to === range.to,
  );
  if (!found) throw new Error("The source changed. Select the block again.");
  return found;
}

/** A Flux string literal for a value: quotes, backslashes, `$` and line breaks escaped. */
export function cdslString(value: string): string {
  return (
    '"' +
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\$/g, "\\$")
      .replace(/\r?\n/g, "\\n")
      .replace(/\t/g, "\\t")
      // Other control characters have no Flux escape.
      .replace(/[\u0000-\u001f]/g, "") +
    '"'
  );
}

/** Why `text` is not a single Flux expression, or undefined when it is. */
export function expressionError(text: string): string | undefined {
  if (!text.trim()) return "Enter a value.";
  const prefix = "Component(value: ";
  const parsed = parseSource(prefix + text + ")");
  if (!parsed.root) {
    const issue = parsed.diagnostics[0];
    return issue ? issue.message : "This is not a valid value.";
  }
  const value = parsed.root.args.value;
  // The expression must be all of the text: `a,` parses (a trailing comma)
  // but would break the call it is written into.
  if (
    Object.keys(parsed.root.args).length !== 1 ||
    !value ||
    value.to !== prefix.length + text.trimEnd().length
  )
    return "Enter a single value.";
  return undefined;
}

interface Edit {
  from: number;
  to: number;
  text: string;
}

/**
 * Apply simultaneous edits (original coordinates), format, and find where
 * `anchor` (an original position just before the node of interest, or a
 * position inside inserted text) ended up.
 */
function finish(
  source: string,
  edits: Edit[],
  anchor: { at: number; inserted?: Edit; length: number },
): SourceEdit {
  const ordered = [...edits].sort((a, b) => a.from - b.from || a.to - b.to);
  let updated = source;
  let offset = 0;
  // An inserted node is found inside its edit; any other node only moves by
  // the edits that end before it.
  let anchorAt = anchor.at;
  // Where the edits landed, to format just that (formatAround).
  let spanFrom = Infinity,
    spanTo = -Infinity;
  for (const edit of ordered) {
    const from = edit.from + offset,
      to = edit.to + offset,
      delta = edit.text.length - (edit.to - edit.from);
    updated = updated.slice(0, from) + edit.text + updated.slice(to);
    spanFrom = Math.min(spanFrom, from);
    // Ascending and not overlapping: later edits never move an earlier one.
    spanTo = Math.max(spanTo, from + edit.text.length);
    if (edit === anchor.inserted) anchorAt = from + (anchor.at - edit.from);
    else if (!anchor.inserted && edit.to <= anchor.at) anchorAt += delta;
    offset += delta;
  }
  if (!parseSource(updated).root)
    throw new Error("That change would break the source, so it was not made.");
  const formatted = Number.isFinite(spanFrom) ? formatAround(updated, spanFrom, spanTo) : formatSource(updated);
  const index = lex(updated).findIndex((token) => token.from >= anchorAt);
  const token = index >= 0 ? lex(formatted)[index] : undefined;
  const from = token?.from ?? 0;
  return { source: formatted, selection: { from, to: from + anchor.length } };
}

/** The tokens strictly inside a call's parentheses. */
function innerTokens(tokens: Token[], node: CallExpr): Token[] {
  return tokens.filter((token) => token.from > node.from && token.to < node.to);
}

/** The `key` token of a named argument (the name before its colon). */
function argumentKeyToken(tokens: Token[], node: CallExpr, key: string): Token | undefined {
  const value = node.args[key];
  if (!value) return undefined;
  const before = tokens.filter((token) => token.to <= value.from && token.from > node.from);
  const colon = before.at(-1);
  const name = before.at(-2);
  return colon?.text === ":" && name?.text === key ? name : undefined;
}

function commaBetween(tokens: Token[], from: number, to: number): Token | undefined {
  return tokens.find((token) => token.from >= from && token.to <= to && token.text === ",");
}

/** Where a new argument goes: before the call's content slot when it has one, else last. */
const CONTENT_ARGS = ["child", "children", "body", "build", "then", "variants"];

function insertArgumentEdit(tokens: Token[], node: CallExpr, text: string): Edit {
  if (node.blocks?.length) {
    // A file in blocks: a field of its header, inside the header's own ().
    const close = tokens.filter((token) => token.to <= node.blocks![0].from).at(-1)!;
    const before = tokens.filter((token) => token.to <= close.from).at(-1);
    const prefix = !before || before.text === "," || before.text === "(" ? "" : ", ";
    return { from: close.from, to: close.from, text: prefix + text };
  }
  const content = Object.keys(node.args).find((key) => CONTENT_ARGS.includes(key));
  if (content) {
    const key = argumentKeyToken(tokens, node, content);
    if (key) return { from: key.from, to: key.from, text: text + ",\n" };
  }
  const end = node.to - 1;
  const last = innerTokens(tokens, node).at(-1);
  const prefix = !last || last.text === "," || last.text === "(" ? "" : ", ";
  return { from: end, to: end, text: prefix + text };
}

/** Set (add or replace) a named argument of the call at `range`. */
export function setArgument(
  source: string,
  range: SourceRangeRef,
  key: string,
  valueText: string,
): SourceEdit {
  const problem = expressionError(valueText);
  if (problem) throw new Error(problem);
  const { node } = locate(source, range);
  const tokens = lex(source);
  const existing = node.args[key];
  const edit: Edit = existing
    ? { from: existing.from, to: existing.to, text: valueText }
    : insertArgumentEdit(tokens, node, key + ": " + valueText);
  return finish(source, [edit], { at: node.from, length: node.name.length });
}

/** Remove a named argument of the call at `range` (with its comma). */
export function removeArgument(source: string, range: SourceRangeRef, key: string): SourceEdit {
  const { node } = locate(source, range);
  const tokens = lex(source);
  const keyToken = argumentKeyToken(tokens, node, key);
  const value = node.args[key];
  if (!keyToken || !value) return { source, selection: { from: node.from, to: node.from + node.name.length } };
  const edits: Edit[] = [{ from: keyToken.from, to: value.to, text: "" }];
  const keys = Object.keys(node.args);
  const index = keys.indexOf(key);
  const next = keys[index + 1] ? argumentKeyToken(tokens, node, keys[index + 1]) : undefined;
  const trailing = commaBetween(tokens, value.to, next?.from ?? node.to - 1);
  if (trailing) edits.push({ from: trailing.from, to: trailing.to, text: "" });
  else if (index > 0) {
    const previous = node.args[keys[index - 1]];
    const preceding = previous && commaBetween(tokens, previous.to, keyToken.from);
    if (preceding) edits.push({ from: preceding.from, to: preceding.to, text: "" });
  }
  return finish(source, edits, { at: node.from, length: node.name.length });
}

/** Replace the call at `range` with new text (a rebuilt declaration, an edited widget). */
export function replaceNode(source: string, range: SourceRangeRef, text: string): SourceEdit {
  const problem = expressionError(text);
  if (problem) throw new Error(problem);
  const { node } = locate(source, range);
  const edit: Edit = { from: node.from, to: node.to, text };
  return finish(source, [edit], { at: node.from, inserted: edit, length: text.match(/^[A-Za-z_][\w.]*/)?.[0].length ?? 1 });
}

/** Text inserted into a list, keeping one item per line. */
function listInsertEdit(tokens: Token[], list: ListExpr, index: number, text: string): Edit {
  const next = list.items[index];
  if (next) return { from: next.from, to: next.from, text: text + ",\n" };
  const last = list.items.at(-1);
  const trailing = last && commaBetween(tokens, last.to, list.to - 1);
  return { from: list.to - 1, to: list.to - 1, text: (last && !trailing ? "," : "") + "\n" + text + ",\n" };
}

/**
 * Insert a widget (`snippet`, a Flux call) inside the call at `range` — into
 * `slot`, or its first free widget slot — or before/after it in its list.
 */
export function insertWidget(
  source: string,
  range: SourceRangeRef,
  placement: InsertPlacement,
  snippet: string,
  context: EditContext = {},
  slot?: string,
): SourceEdit {
  const problem = expressionError(snippet);
  if (problem) throw new Error(problem);
  const target = locate(source, range);
  const tokens = lex(source);
  const name = snippet.trim().match(/^[A-Za-z_][\w.]*/)?.[0] ?? "";
  let edit: Edit;
  if (placement !== "inside") {
    const parentType =
      target.parent && definitionOf(target.parent, context)?.parameters[target.param ?? ""];
    if (!target.list || parentType !== "List<Widget>")
      throw new Error("Add before or after a block that is in a children list, or add inside a layout.");
    const index = target.list.items.indexOf(target.node) + (placement === "after" ? 1 : 0);
    edit = listInsertEdit(tokens, target.list, index, snippet);
  } else {
    const slots = widgetSlots(target.node, context);
    const chosen = slot
      ? slots.find((item) => item.name === slot)
      : (slots.find((item) => item.list) ?? slots.find((item) => !item.filled) ?? slots[0]);
    if (!chosen) throw new Error(`${target.node.name} has no slot for a widget. Add it to a layout instead.`);
    const contents = target.node.args[chosen.name];
    if (chosen.list) {
      if (contents && contents.type !== "list")
        throw new Error("These children come from an expression. Edit it in Code view.");
      edit = contents
        ? listInsertEdit(tokens, contents as ListExpr, (contents as ListExpr).items.length, snippet)
        : insertArgumentEdit(tokens, target.node, chosen.name + ": [\n" + snippet + ",\n]");
    } else if (contents && !isPlaceholder(contents)) {
      throw new Error(`${target.node.name} already has a ${chosen.name}. Add inside it, or wrap it in a layout first.`);
    } else if (contents) {
      edit = { from: contents.from, to: contents.to, text: snippet };
    } else {
      edit = insertArgumentEdit(tokens, target.node, chosen.name + ": " + snippet);
    }
  }
  const at = edit.from + edit.text.indexOf(snippet.trim());
  return finish(source, [edit], { at, inserted: edit, length: name.length });
}

/** Delete the widget at `range`: from its list, or out of its slot. */
export function deleteNode(source: string, range: SourceRangeRef, context: EditContext = {}): SourceEdit {
  const target = locate(source, range);
  const tokens = lex(source);
  if (!target.parent) throw new Error("The component itself cannot be deleted here.");
  const parentEntry = definitionOf(target.parent, context);
  if (target.list) {
    const list = target.list;
    const i = list.items.indexOf(target.node);
    const next = list.items[i + 1],
      previous = list.items[i - 1];
    const edits: Edit[] = [{ from: target.node.from, to: target.node.to, text: "" }];
    const trailing = commaBetween(tokens, target.node.to, next?.from ?? list.to - 1);
    const preceding = previous && commaBetween(tokens, previous.to, target.node.from);
    if (trailing) edits.push({ from: trailing.from, to: trailing.to, text: "" });
    else if (preceding) edits.push({ from: preceding.from, to: preceding.to, text: "" });
    // Select what takes its place: the next item, else the previous, else the parent.
    const anchorNode = next ?? previous ?? target.parent;
    const result = finish(source, edits, {
      at: next ? next.from : (anchorNode.from),
      length: anchorNode.type === "call" ? anchorNode.name.length : 1,
    });
    return result;
  }
  const param = target.param ?? "";
  if (parentEntry?.required.includes(param)) {
    // A required slot keeps a placeholder, as moves do, so the source stays valid.
    const edit: Edit = { from: target.node.from, to: target.node.to, text: "SizedBox()" };
    return finish(source, [edit], { at: target.node.from, inserted: edit, length: "SizedBox".length });
  }
  return removeArgument(
    source,
    { from: target.parent.from, to: target.parent.to },
    param,
  );
}

/** Duplicate the widget at `range` right after itself in its list. */
export function duplicateNode(source: string, range: SourceRangeRef): SourceEdit {
  const target = locate(source, range);
  if (!target.list) throw new Error("Only blocks in a children list can be duplicated.");
  const tokens = lex(source);
  const block = source.slice(target.node.from, target.node.to);
  const index = target.list.items.indexOf(target.node) + 1;
  const edit = listInsertEdit(tokens, target.list, index, block);
  const at = edit.from + edit.text.indexOf(block);
  return finish(source, [edit], { at, inserted: edit, length: target.node.name.length });
}

/** Layouts a block can be wrapped in, and how. */
export const WRAPPERS = {
  Box: (block: string) => `Box(child: ${block})`,
  Column: (block: string) => `Column(children: [${block}])`,
  Row: (block: string) => `Row(children: [${block}])`,
  Stack: (block: string) => `Stack(children: [${block}])`,
  ScrollView: (block: string) => `ScrollView(child: ${block})`,
  Scaffold: (block: string) => `Scaffold(body: ${block})`,
  // Shown until its condition is changed from true; else is optional.
  If: (block: string) => `If(condition: true, then: ${block})`,
  Wrap: (block: string) => `Wrap(children: [${block}])`,
  Grid: (block: string) => `Grid(cols: 2, children: [${block}])`,
  SizedBox: (block: string) => `SizedBox(child: ${block})`,
  Animate: (block: string) => `Animate(effect: Effect.fade, child: ${block})`,
  Expanded: (block: string) => `Expanded(child: ${block})`,
  Flexible: (block: string) => `Flexible(child: ${block})`,
  Positioned: (block: string) => `Positioned(top: 0, left: 0, child: ${block})`,
  // An empty list to start: the person gives it what the page imports.
  ForEach: (block: string) => `ForEach(items: [], as: "item", child: ${block})`,
  "Tap area": (block: string) => `Box(onTap: ShowMessage(message: "Tapped"), ariaLabel: "Tap", child: ${block})`,
  Form: (block: string) => `Form(id: "form", onSubmit: ShowMessage(message: "Sent"), child: ${block})`,
} as const;
export type Wrapper = keyof typeof WRAPPERS;

/** The "Wrap with" submenus: what each wrapper is for. */
export const WRAPPER_GROUPS: { label: string; wrappers: Wrapper[] }[] = [
  { label: "Layout", wrappers: ["Box", "Column", "Row", "Stack", "Wrap", "Grid", "SizedBox"] },
  { label: "Space in a row or column", wrappers: ["Expanded", "Flexible"] },
  { label: "Place in a stack", wrappers: ["Positioned"] },
  { label: "Scroll and screen", wrappers: ["ScrollView", "Scaffold"] },
  { label: "Logic", wrappers: ["If", "ForEach"] },
  { label: "Motion", wrappers: ["Animate"] },
  { label: "Interaction", wrappers: ["Tap area", "Form"] },
];

/** Why [wrapper] can't wrap a widget whose parent is [parent], or undefined. */
export function wrapperProblem(wrapper: Wrapper, parent: string | undefined): string | undefined {
  if ((wrapper === "Expanded" || wrapper === "Flexible") && !["Row", "Column", "Flex"].includes(parent ?? ""))
    return "Only inside a Row, Column or Flex";
  if (wrapper === "Positioned" && parent !== "Stack") return "Only inside a Stack";
  return undefined;
}

/** Widgets that can stand in for each other ("Replace with"). */
export const REPLACEMENT_GROUPS: string[][] = [
  ["Column", "Row", "Wrap", "Stack", "Grid"],
  ["Box", "SizedBox", "ScrollView"],
  ["Expanded", "Flexible"],
  ["Text", "Badge", "Button"],
  ["TextField", "SearchField"],
];
/** A property that is named differently on the replacement: Text's child is Button's label. */
const RENAMED: Record<string, string> = { "Text.child>Badge": "label", "Text.child>Button": "label", "Badge.label>Text": "child", "Button.label>Text": "child" };
/** Values for what the replacement requires and the original didn't have. */
const REQUIRED: Record<string, string> = {
  "Button.onTap": 'ShowMessage(message: "Tapped")',
  "Button.label": '"Button"',
  "Badge.label": '"Badge"',
  "Text.child": '"Text"',
};

export function replacementsFor(name: string): string[] {
  return (REPLACEMENT_GROUPS.find((group) => group.includes(name)) ?? []).filter((item) => item !== name);
}

/**
 * Replace the widget at `range` with another of its kind, keeping each
 * property the new one has (children, gap, padding…) and filling in what it
 * requires.
 */
export function replaceWidget(source: string, range: SourceRangeRef, name: string): SourceEdit {
  const target = locate(source, range);
  const node = target.node;
  const entry = constructorRegistry.get(name);
  if (!entry) throw new Error(name + " isn't a known widget.");
  const from = constructorRegistry.get(node.name);
  const args: [string, string][] = [];
  for (const [key, value] of Object.entries(node.args)) {
    const mapped = RENAMED[`${node.name}.${key}>${name}`];
    const renamed = mapped ?? key;
    // Same name isn't enough: Text's size is a FontSize, Button's a Size.
    const sameType = mapped !== undefined || from?.parameters[key] === entry.parameters[renamed];
    if (renamed in entry.parameters && sameType && !args.some(([existing]) => existing === renamed))
      args.push([renamed, source.slice(value.from, value.to)]);
  }
  for (const key of entry.required)
    if (!args.some(([existing]) => existing === key)) {
      const value = REQUIRED[`${name}.${key}`];
      if (!value) throw new Error(`${name} needs ${key}; replace it in Code view.`);
      args.push([key, value]);
    }
  const text = `${name}(${args.map(([key, value]) => key + ": " + value).join(", ")})`;
  const edit: Edit = { from: node.from, to: node.to, text };
  return finish(source, [edit], { at: node.from, inserted: edit, length: name.length });
}

/** Whether a document already lays out a Scaffold (a page has at most one). */
export function hasScaffold(source: string): boolean {
  const root = parseSource(source).root;
  return !!root && callLocations(root).some(({ node }) => node.name === "Scaffold");
}

/**
 * Set several arguments of the call at `range` as one edit (one undo step),
 * e.g. every style a condition card drives when its condition changes.
 */
export function setArguments(source: string, range: SourceRangeRef, entries: [string, string][]): SourceEdit {
  // Each edit reformats the document, so the widget is found again by its
  // place among the calls: nothing before it changes, only what is inside.
  const calls = (text: string) => {
    const root = parseSource(text).root;
    return root ? callLocations(root).map(({ node }) => node) : [];
  };
  const ordinal = calls(source).findIndex((node) => node.from === range.from && node.to === range.to);
  if (ordinal < 0) throw new Error("Select the widget again and retry.");
  let current = source;
  for (const [key, text] of entries) {
    const node = calls(current)[ordinal];
    if (!node) throw new Error("Select the widget again and retry.");
    current = setArgument(current, { from: node.from, to: node.to }, key, text).source;
  }
  const node = calls(current)[ordinal];
  return { source: current, selection: { from: node.from, to: node.from + node.name.length } };
}

/**
 * Why a Scaffold can't be added to this document, or null when it can. A
 * Scaffold is the screen itself, so one may never end up inside another:
 * not in the same document, not in a component this document uses (at any
 * depth), and, for a component, not in any page or component that uses it.
 * [documents] are every page and component source by name; [current] is
 * this document's name in it (a component's name, or a page id).
 */
export function scaffoldBlocker(
  source: string,
  current: string,
  documents: Record<string, string>,
  componentNames: Iterable<string>,
): string | null {
  if (hasScaffold(source)) return "This already has a Scaffold";
  const components = new Set(componentNames);
  const calls = (text: string) => {
    const root = parseSource(text).root;
    return root ? new Set(callLocations(root).map(({ node }) => node.name)) : new Set<string>();
  };
  const sources = { ...documents, [current]: source };
  const uses = new Map(Object.entries(sources).map(([name, text]) => [name, calls(text)]));
  // Down: components this document uses.
  const seen = new Set<string>([current]);
  const down = [...(uses.get(current) ?? [])].filter((name) => components.has(name));
  while (down.length) {
    const name = down.pop()!;
    if (seen.has(name) || sources[name] === undefined) continue;
    seen.add(name);
    if (hasScaffold(sources[name])) return `It uses ${name}, which has a Scaffold`;
    down.push(...[...(uses.get(name) ?? [])].filter((child) => components.has(child)));
  }
  // Up: documents that use this component.
  if (!components.has(current)) return null;
  const visited = new Set<string>([current]);
  const up = [current];
  while (up.length) {
    const name = up.pop()!;
    for (const [user, called] of uses) {
      if (visited.has(user) || !called.has(name)) continue;
      visited.add(user);
      if (hasScaffold(sources[user])) return `It is used inside ${user}, which has a Scaffold`;
      if (components.has(user)) up.push(user);
    }
  }
  return null;
}

/** Wrap the widget at `range` in a layout. */
export function wrapNode(source: string, range: SourceRangeRef, wrapper: Wrapper): SourceEdit {
  if (wrapper === "Scaffold" && hasScaffold(source))
    throw new Error("This page already has a Scaffold. A page can have only one.");
  const target = locate(source, range);
  if (!target.parent) throw new Error("The component itself cannot be wrapped.");
  const block = source.slice(target.node.from, target.node.to);
  const edit: Edit = { from: target.node.from, to: target.node.to, text: WRAPPERS[wrapper](block) };
  return finish(source, [edit], { at: target.node.from, inserted: edit, length: wrapper.length });
}

export type DeclarationList = "options" | "states" | "parts";

/** Add a declaration (an option, state or part call) to the component. */
export function addDeclaration(source: string, list: DeclarationList, snippet: string): SourceEdit {
  const problem = expressionError(snippet);
  if (problem) throw new Error(problem);
  const root = parseOrThrow(source);
  if (root.blocks) return addBlockDeclaration(source, root, list, blockEntry(list, snippet));
  const tokens = lex(source);
  const existing = root.args[list];
  let edit: Edit;
  if (existing?.type === "list") edit = listInsertEdit(tokens, existing, existing.items.length, snippet);
  else if (existing) throw new Error(`This component's ${list} come from an expression. Edit them in Code view.`);
  else {
    // Declarations read best before the variants that use them.
    const variants = argumentKeyToken(tokens, root, "variants");
    const text = list + ": [\n" + snippet + ",\n]";
    edit = variants
      ? { from: variants.from, to: variants.from, text: text + ",\n" }
      : insertArgumentEdit(tokens, root, text);
  }
  const at = edit.from + edit.text.indexOf(snippet.trim());
  const name = snippet.trim().match(/^[A-Za-z_]\w*/)?.[0] ?? "";
  return finish(source, [edit], { at, inserted: edit, length: name.length });
}

/** A declaration's entry added to its block in a block-form file, the block made if it has none. */
function addBlockDeclaration(source: string, root: CallExpr, list: DeclarationList, entry: string): SourceEdit {
  const name = LIST_BLOCKS[list];
  const block = root.blocks!.find((item) => item.name === name);
  const existing = root.args[list];
  let edits: Edit[];
  let inserted: Edit;
  if (!block) {
    inserted = newBlockEdit(source, root, name, "  " + entry + ",\n");
    edits = [inserted];
  } else {
    const items = existing?.type === "list" ? existing.items : [];
    const last = items.at(-1);
    const tokens = lex(source);
    const lineStart = source.lastIndexOf("\n", block.close - 1) + 1;
    const onItsOwnLine = !source.slice(lineStart, block.close).trim() && source.slice(block.open, block.close).includes("\n");
    edits = [];
    if (last && !commaBetween(tokens, last.to, block.close)) edits.push({ from: last.to, to: last.to, text: "," });
    inserted = onItsOwnLine
      ? { from: lineStart, to: lineStart, text: "  " + entry + ",\n" }
      : { from: block.close, to: block.close, text: (last ? " " : "") + entry };
    edits.push(inserted);
  }
  const at = inserted.from + inserted.text.indexOf(entry);
  return finish(source, edits, { at, inserted, length: entry.match(/^[A-Za-z_]\w*/)?.[0].length ?? 0 });
}

/** Names used by a component's options or states (to warn before deleting one). */
export function references(source: string, scope: "options" | "state", name: string): number {
  const root = parseSource(source).root;
  if (!root) return 0;
  let count = 0;
  const target = scope + "." + name;
  function walk(expr: Expr) {
    if (expr.type === "ref" && (expr.name === target || expr.name.startsWith(target + "."))) count++;
    if (scope === "state" && expr.type === "call" && ["SetState", "Toggle"].includes(expr.name)) {
      const state = expr.args.state;
      if (state?.type === "literal" && state.value === name) count++;
    }
    if (
      scope === "state" &&
      expr.type === "call" &&
      ["TextField", "SearchField", "Checkbox", "SelectField"].includes(expr.name)
    ) {
      const state = expr.args.state;
      if (state?.type === "literal" && state.value === name) count++;
    }
    childrenOf(expr).forEach(walk);
  }
  walk(root);
  return count;
}

/**
 * A copy of the variant at `range`, right after it: same layout and rule,
 * with a new label and an id made from it (not used by another variant).
 */
export function duplicateVariant(source: string, range: SourceRangeRef, label: string): SourceEdit {
  const { node, list } = locate(source, range);
  if (node.name !== "Variant" || !list) throw new Error("Select a variant to copy.");
  const used = list.items.flatMap((item) => (item.type === "call" ? [String(literalValue(item.args.id) ?? "")] : []));
  const root = parseOrThrow(source);
  // In blocks, an id is written bare: a name, not "two words".
  const base = root.blocks
    ? label.replace(/[^A-Za-z0-9]+(.)?/g, (_, next: string | undefined) => (next ? next.toUpperCase() : "")).replace(/^[^A-Za-z_]+/, "").replace(/^./, (c) => c.toLowerCase()) || "variant"
    : label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "variant";
  let id = base;
  for (let n = 2; used.includes(id); n++) id = base + (root.blocks ? n : "-" + n);
  if (root.blocks) return duplicateBlockVariant(source, root, node, id, label);
  const rest = Object.entries(node.args)
    .filter(([key]) => key !== "id" && key !== "label")
    .map(([key, value]) => `${key}: ${source.slice(value.from, value.to)}`);
  const text = `Variant(${[`id: ${cdslString(id)}`, `label: ${cdslString(label)}`, ...rest].join(", ")})`;
  const inserted: Edit = { from: node.to, to: node.to, text: ", " + text };
  return finish(source, [inserted], { at: node.to + 2, inserted, length: "Variant".length });
}

/** A variant entry: id: Variant(label: …, options: Options(…), Build(…)). */
function variantEntry(source: string, node: CallExpr, id: string, label: string): string {
  const parts = [`label: ${cdslString(label)}`];
  for (const [key, value] of Object.entries(node.args))
    if (!["id", "label", "options", "build"].includes(key)) parts.push(`${key}: ${source.slice(value.from, value.to)}`);
  const options = node.args.options;
  if (options?.type === "list" && options.items.length) parts.push(`options: ${source.slice(options.from, options.to)}`);
  const build = node.args.build;
  parts.push(`Build(\n    ${build ? source.slice(build.from, build.to).replace(/\n/g, "\n  ") : "Empty()"}\n  )`);
  return `${id}: Variant(${parts.join(", ")})`;
}

/**
 * A copy of a variant in a block-form file: after it in Variants(...); a
 * component drawn by one Build(...) gets Variants(...) of it and its copy.
 */
function duplicateBlockVariant(source: string, root: CallExpr, node: CallExpr, id: string, label: string): SourceEdit {
  const build = root.blocks!.find((block) => block.name === "Build");
  const copy = variantEntry(source, node, id, label);
  if (build) {
    const text = `Variants(\n  ${variantEntry(source, node, "default", "Default")},\n  ${copy},\n)`;
    const inserted: Edit = { from: build.from, to: build.to, text };
    return finish(source, [inserted], { at: build.from + text.indexOf(copy), inserted, length: id.length });
  }
  const tokens = lex(source);
  const comma = commaBetween(tokens, node.to, root.blocks!.find((block) => block.name === "Variants")!.close);
  const after = comma ? comma.to : node.to;
  const inserted: Edit = { from: after, to: after, text: (comma ? "" : ",") + "\n  " + copy + (comma ? "," : "") };
  return finish(source, [inserted], { at: after + inserted.text.indexOf(copy), inserted, length: id.length });
}

const STATE_ARGUMENT_CALLS = ["SetState", "Toggle", "TextField", "SearchField", "Checkbox", "SelectField"];

/**
 * Rename a state or option and every use of it in this document — state.x /
 * options.x references (in text templates too) and SetState/Toggle/field
 * `state:` arguments — as one edit. `keep` is where the selection stays
 * (another widget), else on the declaration.
 */
export function renameDeclaration(
  source: string,
  range: SourceRangeRef,
  scope: "options" | "state",
  newName: string,
  keep?: { from: number; length: number },
): SourceEdit {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(newName))
    throw new Error("A name uses letters, numbers and _, and can't start with a number.");
  const root = parseSource(source).root;
  if (!root) throw new Error("Fix the source syntax first.");
  const { node } = locate(source, range);
  const nameArg = node.args.name;
  if (nameArg?.type !== "literal" || typeof nameArg.value !== "string") throw new Error("This has no name to change.");
  const oldName = nameArg.value;
  if (oldName === newName) return { source, selection: { from: node.from, to: node.from + node.name.length } };
  const list = root.args[scope === "state" ? "states" : "options"];
  const taken =
    list?.type === "list" &&
    list.items.some((item) => item !== node && item.type === "call" && literalValue(item.args.name) === newName);
  if (taken) throw new Error(`There is already ${scope === "state" ? "a state" : "an option"} named ${newName}.`);
  const edits: Edit[] = [{ from: nameArg.from, to: nameArg.to, text: nameArg.bare ? newName : cdslString(newName) }];
  const target = scope + "." + oldName;
  (function walk(expr: Expr) {
    if (
      expr.type === "ref" &&
      (expr.name === target || expr.name.startsWith(target + ".")) &&
      source.slice(expr.from, expr.from + target.length) === target
    )
      edits.push({ from: expr.from, to: expr.from + target.length, text: scope + "." + newName });
    if (scope === "state" && expr.type === "call" && STATE_ARGUMENT_CALLS.includes(expr.name)) {
      const state = expr.args.state;
      if (state?.type === "literal" && state.value === oldName)
        edits.push({ from: state.from, to: state.to, text: cdslString(newName) });
    }
    childrenOf(expr).forEach(walk);
  })(root);
  return finish(source, edits, keep ? { at: keep.from, length: keep.length } : { at: node.from, length: node.name.length });
}

/**
 * Move a list item one place up (-1) or down (1) by swapping its text with
 * its neighbour's; comments between them stay where they are.
 */
export function moveSibling(source: string, range: SourceRangeRef, direction: -1 | 1): SourceEdit {
  const target = locate(source, range);
  if (!target.list) throw new Error("Only blocks in a children list can be moved up or down.");
  const index = target.list.items.indexOf(target.node);
  const neighbour = target.list.items[index + direction];
  if (!neighbour) throw new Error("This block is already " + (direction < 0 ? "first." : "last."));
  const block = source.slice(target.node.from, target.node.to);
  const other = source.slice(neighbour.from, neighbour.to);
  const moved: Edit = { from: neighbour.from, to: neighbour.to, text: block };
  const edits: Edit[] = [{ from: target.node.from, to: target.node.to, text: other }, moved];
  return finish(source, edits, { at: neighbour.from, inserted: moved, length: target.node.name.length });
}

/**
 * Move a list item to another place in the same list (dragging a child to a
 * new position): the items between shift along by one, and comments between
 * them stay where they are.
 */
export function moveListItem(source: string, range: SourceRangeRef, toIndex: number): SourceEdit {
  const target = locate(source, range);
  if (!target.list) throw new Error("Only something in a list of children can be moved.");
  const items = target.list.items;
  const from = items.indexOf(target.node);
  const to = Math.max(0, Math.min(items.length - 1, toIndex));
  if (from === to) return { source, selection: { from: target.node.from, to: target.node.from + target.node.name.length } };
  const texts = items.map((item) => source.slice(item.from, item.to));
  const [moved] = texts.splice(from, 1);
  texts.splice(to, 0, moved);
  const edits: Edit[] = [];
  let inserted: Edit | undefined;
  for (let index = Math.min(from, to); index <= Math.max(from, to); index++) {
    const edit: Edit = { from: items[index].from, to: items[index].to, text: texts[index] };
    if (index === to) inserted = edit;
    edits.push(edit);
  }
  return finish(source, edits, { at: items[to].from, inserted, length: target.node.name.length });
}
