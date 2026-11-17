// Synced from Upskale Studio (upskaleapp/src/lib/studio/visualModel.ts). Edit it there, then npm run sync.
/**
 * What the Visual editor shows for a call: which form field fits each of its
 * properties, what the current value reads as in that field, the component
 * catalogue for the "Add component" picker, and starter declarations.
 *
 * Pure: everything here reads Flux; the edits themselves are sourceEdits.ts.
 */
import { literalValue, type CallExpr, type Expr } from "./parser";
import {
  constructorRegistry,
  constructors,
  tokenFamilies,
  type ReferenceEntry,
} from "./registry";
import { customTokens, tokenGroups, type StudioConfig } from "./projectConfig";
import { cdslString } from "./sourceEdits";

/** The form control a property type is edited with. */
export type FieldKind =
  | "text"
  | "number"
  | "bool"
  | "token"
  | "color"
  | "action"
  | "expression"
  /** Widget slots: edited in the structure, not the form. */
  | "slot"
  /** Declaration lists (options, states, parts, variants). */
  | "declarations";

export interface FieldSpec {
  kind: FieldKind;
  /** The token family offered by a token or colour field. */
  family?: string;
  /** Whether a literal number or text is also accepted beside the family. */
  allowsNumber?: boolean;
}

/** The field for a registry parameter type ("Color", "Space or Insets", "Action"…). */
export function fieldFor(type: string): FieldSpec {
  if (type === "Widget" || /^List<(Widget|Tab|Layer)>$/.test(type)) return { kind: "slot" };
  if (/^List<(Option|State|Part|Variant)>$/.test(type)) return { kind: "declarations" };
  if (type === "Action") return { kind: "action" };
  if (type === "Color") return { kind: "color", family: "Color" };
  const [first] = type.split(" or ");
  if (first === "Route") return { kind: "token", family: "Route" };
  if (first === "String") return { kind: "text" };
  if (first === "Number") return { kind: "number" };
  if (first === "Bool") return { kind: "bool" };
  if (Object.hasOwn(tokenFamilies, first))
    return { kind: "token", family: first, allowsNumber: /\bNumber\b/.test(type) || first === "Space" };
  return { kind: "expression" };
}

/** A property's current value as its field understands it. */
export type FieldValue =
  | { mode: "unset" }
  | { mode: "text"; value: string }
  /** Text with data in it ("Hi ${store.name}"): edited as written between the quotes. */
  | { mode: "template"; raw: string }
  | { mode: "number"; value: number }
  | { mode: "bool"; value: boolean }
  | { mode: "token"; family: string; value: string }
  | { mode: "hex"; value: string }
  /** Anything else is shown as the Flux it is, never rewritten. */
  | { mode: "expression"; text: string };

/** Read an argument for its field; values the field can't represent stay expressions. */
export function readValue(source: string, expr: Expr | undefined, spec: FieldSpec): FieldValue {
  if (!expr) return { mode: "unset" };
  const text = source.slice(expr.from, expr.to);
  const literal = literalValue(expr);
  if (spec.kind === "text" && typeof literal === "string") return { mode: "text", value: literal };
  if (spec.kind === "text" && expr.type === "literal" && expr.segments)
    return { mode: "template", raw: text.slice(1, -1) };
  if ((spec.kind === "number" || spec.allowsNumber) && typeof literal === "number")
    return { mode: "number", value: literal };
  if (spec.kind === "number" && expr.type === "unary" && expr.op === "-") {
    const inner = literalValue(expr.child);
    if (typeof inner === "number") return { mode: "number", value: -inner };
  }
  if (spec.kind === "bool" && typeof literal === "boolean") return { mode: "bool", value: literal };
  if ((spec.kind === "token" || spec.kind === "color") && expr.type === "ref") {
    const [family, key, ...rest] = expr.name.split(".");
    if (family === spec.family && key && !rest.length) return { mode: "token", family, value: key };
  }
  if (spec.kind === "color" && typeof literal === "string" && /^#[0-9a-f]{6}$/i.test(literal))
    return { mode: "hex", value: literal };
  return { mode: "expression", text };
}

/** The Flux for a field value. */
export function writeValue(value: Exclude<FieldValue, { mode: "unset" }>): string {
  switch (value.mode) {
    case "text":
    case "hex":
      return cdslString(value.value);
    case "template":
      return '"' + value.raw + '"';
    case "number":
      return Number.isFinite(value.value) ? String(value.value) : "0";
    case "bool":
      return String(value.value);
    case "token":
      return value.family + "." + value.value;
    case "expression":
      return value.text;
  }
}

/** The names a token family offers here: built-ins, then the project's own. */
/** What a property starts as when it's added: a value valid for its type. */
export function propertyDefault(name: string, type: string, config?: StudioConfig): string {
  const spec = fieldFor(type);
  if (spec.kind === "text") return '""';
  if (spec.kind === "number") return "0";
  if (spec.kind === "bool") return "false";
  if (spec.kind === "action") return 'ShowMessage(message: "Done")';
  if ((spec.kind === "token" || spec.kind === "color") && spec.family) {
    const first = tokenChoices(spec.family, config)[0];
    if (first) return spec.family + "." + first;
  }
  return name === "value" ? '""' : "null";
}

export function tokenChoices(family: string, config?: StudioConfig): string[] {
  const builtIn = tokenFamilies[family] ?? [];
  const group = tokenGroups[family];
  const own = group ? customTokens(config, group) : [];
  return [...builtIn, ...own.filter((name) => !builtIn.includes(name))];
}

/** One property row of the form. */
export interface PropertyRow {
  name: string;
  type: string;
  spec: FieldSpec;
  required: boolean;
  value: FieldValue;
}

/** The form rows for a call: set properties first (in source order), then required ones. */
export function propertyRows(source: string, node: CallExpr, entry: ReferenceEntry | undefined): {
  rows: PropertyRow[];
  /** Properties that can still be added, for "Add property". */
  available: { name: string; type: string; required: boolean }[];
  /** Set properties this component doesn't declare (shown so they can be removed). */
  unknown: string[];
} {
  const parameters = entry?.parameters ?? {};
  const required = entry?.required ?? [];
  const row = (name: string): PropertyRow => {
    const type = parameters[name] ?? "Any";
    const spec = fieldFor(type);
    return { name, type, spec, required: required.includes(name), value: readValue(source, node.args[name], spec) };
  };
  const set = Object.keys(node.args).filter((name) => Object.hasOwn(parameters, name));
  const missing = required.filter((name) => !Object.hasOwn(node.args, name));
  const rows = [...set, ...missing]
    .map(row)
    .filter((item) => item.spec.kind !== "slot" && item.spec.kind !== "declarations");
  const available = Object.entries(parameters)
    .filter(([name, type]) => !Object.hasOwn(node.args, name) && !missing.includes(name) && fieldFor(type).kind !== "slot" && fieldFor(type).kind !== "declarations")
    .map(([name, type]) => ({ name, type, required: required.includes(name) }));
  return {
    rows,
    available,
    unknown: Object.keys(node.args).filter((name) => !Object.hasOwn(parameters, name)),
  };
}

// --- actions ----------------------------------------------------------------------

/** An action value, as the action builder edits it. */
export type ActionValue =
  | { kind: "none" }
  | { kind: "navigate"; to: string }
  | { kind: "setState"; state: string; value: string }
  | { kind: "toggle"; state: string }
  | { kind: "message"; message: string }
  | { kind: "option"; name: string }
  /** Any other action (AddToCart, Actions([...])…): its Flux. */
  | { kind: "other"; text: string };

export function readAction(source: string, expr: Expr | undefined): ActionValue {
  if (!expr) return { kind: "none" };
  const text = source.slice(expr.from, expr.to);
  if (expr.type === "literal" && expr.value === null) return { kind: "none" };
  if (expr.type === "ref" && expr.name.startsWith("options.") && expr.name.split(".").length === 2)
    return { kind: "option", name: expr.name.slice(8) };
  if (expr.type !== "call") return { kind: "other", text };
  const arg = (name: string) => expr.args[name];
  const keys = Object.keys(expr.args);
  if (expr.name === "Navigate" && keys.length === 1 && arg("to")?.type === "ref") {
    const [family, key, ...rest] = (arg("to") as { name: string }).name.split(".");
    if (family === "Route" && !rest.length) return { kind: "navigate", to: key };
  }
  const state = literalValue(arg("state"));
  if (expr.name === "SetState" && typeof state === "string" && keys.length === 2 && arg("value"))
    return { kind: "setState", state, value: source.slice(arg("value")!.from, arg("value")!.to) };
  if (expr.name === "Toggle" && typeof state === "string" && keys.length === 1) return { kind: "toggle", state };
  const message = literalValue(arg("message"));
  if (expr.name === "ShowMessage" && typeof message === "string" && keys.length === 1)
    return { kind: "message", message };
  return { kind: "other", text };
}

/** The Flux for an action value (undefined for none: remove the property). */
export function writeAction(action: ActionValue): string | undefined {
  switch (action.kind) {
    case "none":
      return undefined;
    case "navigate":
      return `Navigate(to: Route.${action.to})`;
    case "setState":
      return `SetState(state: ${cdslString(action.state)}, value: ${action.value || '""'})`;
    case "toggle":
      return `Toggle(state: ${cdslString(action.state)})`;
    case "message":
      return `ShowMessage(message: ${cdslString(action.message)})`;
    case "option":
      return `options.${action.name}`;
    case "other":
      return action.text;
  }
}

// --- the component picker ------------------------------------------------------------

export interface PickerItem {
  name: string;
  group: string;
  description: string;
  /** The Flux inserted: the registry's working usage example, or a bare call. */
  snippet: string;
  /** A template that must be imported into the project first. */
  templateId?: string;
}

/** Groups offered when adding into a widget slot, in the order they're shown. */
export const WIDGET_PICKER_GROUPS = [
  "Layout",
  "Content",
  "Forms",
  "Composition",
  "Behavior",
  "Storefront",
  "Storefront controls",
  "Library",
];

/** What can be added into a widget slot: built-ins, then the project's own components. */
export function widgetCatalog(components: ReadonlyMap<string, ReferenceEntry>): PickerItem[] {
  const builtIns = constructors
    .filter((entry) => WIDGET_PICKER_GROUPS.includes(entry.group) && /^[A-Z]/.test(entry.usage.trim()))
    .sort((a, b) => WIDGET_PICKER_GROUPS.indexOf(a.group) - WIDGET_PICKER_GROUPS.indexOf(b.group))
    .map((entry) => ({ name: entry.name, group: entry.group, description: entry.description, snippet: entry.usage.trim() }));
  const own = [...components.values()].map((entry) => ({
    name: entry.name,
    group: "Your components",
    description: entry.description,
    snippet: entry.name + "()",
  }));
  return [...own, ...builtIns];
}

/** Actions offered by the action builder's "Other action" list. */
export function actionCatalog(): PickerItem[] {
  return constructors
    .filter((entry) => entry.group === "Actions" && /^[A-Z]/.test(entry.usage.trim()) && !entry.name.includes("."))
    .map((entry) => ({ name: entry.name, group: entry.group, description: entry.description, snippet: entry.usage.trim() }));
}

/** Filter a catalog by a search, matching name, group or description. */
export function searchCatalog(items: PickerItem[], query: string): PickerItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((item) => {
    const haystack = (item.name + " " + item.group + " " + item.description).toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

// --- declarations ---------------------------------------------------------------

export const OPTION_TYPES = ["StringOption", "NumberOption", "BoolOption", "ColorOption", "EnumOption", "ActionOption"] as const;
export const STATE_TYPES = ["StringState", "NumberState", "BoolState"] as const;

/** A name not used yet: `base`, then `base2`, `base3`… */
export function freeName(base: string, used: Iterable<string>): string {
  const taken = new Set(used);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(base + n)) n++;
  return base + n;
}

/** A starter declaration of a type, valid as written. */
export function declarationSnippet(type: string, name: string): string {
  const label = cdslString(name[0].toUpperCase() + name.slice(1));
  const n = cdslString(name);
  switch (type) {
    case "StringOption":
      return `StringOption(name: ${n}, label: ${label}, maxLength: 80, default: "")`;
    case "NumberOption":
      return `NumberOption(name: ${n}, label: ${label}, min: 0, max: 100, default: 0)`;
    case "BoolOption":
      return `BoolOption(name: ${n}, label: ${label}, default: false)`;
    case "ColorOption":
      return `ColorOption(name: ${n}, label: ${label}, default: Color.primary)`;
    case "EnumOption":
      return `EnumOption(name: ${n}, label: ${label}, values: [Align.start, Align.center, Align.end], default: Align.start)`;
    case "ActionOption":
      return `ActionOption(name: ${n}, label: ${label})`;
    case "StringState":
      return `StringState(name: ${n}, default: "")`;
    case "NumberState":
      return `NumberState(name: ${n}, default: 0)`;
    case "BoolState":
      return `BoolState(name: ${n}, default: false)`;
    case "Part":
      return `Part(name: ${n}, build: Column(children: []))`;
  }
  throw new Error("Unknown declaration type: " + type);
}

/** The declared names in a component's options/states/parts list. */
export function declaredNames(root: CallExpr | undefined, list: "options" | "states" | "parts"): string[] {
  const items = root?.args[list];
  if (items?.type !== "list") return [];
  return items.items.flatMap((item) => {
    const name = item.type === "call" ? literalValue(item.args.name) : undefined;
    return typeof name === "string" ? [name] : [];
  });
}

/** A short label for a call in the structure tree. */
/**
 * What the editor calls a constructor, where its Flux name reads poorly:
 * Part (declare) and Use (insert) are both "Snippet" to designers.
 */
const DISPLAY_NAMES: Record<string, string> = { Part: "Snippet", Use: "Snippet" };
export function displayName(name: string): string {
  return DISPLAY_NAMES[name] ?? name;
}

export function nodeLabel(node: CallExpr): string {
  const hint =
    literalValue(node.args.label) ??
    literalValue(node.args.name) ??
    literalValue(node.args.part) ??
    literalValue(node.args.child) ??
    literalValue(node.args.title);
  const name = displayName(node.name);
  return typeof hint === "string" && hint ? `${name} · ${hint.slice(0, 40)}` : name;
}

/** Whether a call is a declaration (an option, state or part). */
export function isDeclaration(node: CallExpr): boolean {
  const group = constructorRegistry.get(node.name)?.group;
  return group === "Options" || node.name === "Part";
}

// --- structure ---------------------------------------------------------------

/** One row of the Visual editor's structure tree. */
export interface StructureNode {
  /** The widget call, or the expression filling a slot (conditional, binding…). */
  expr: Expr;
  /** The parent's slot this sits in ("child", "children", "body"…). */
  slot?: string;
  /** Shown beside the label when its parent has more than one slot. */
  slotLabel?: string;
  /** Sits in a children list (so it can be inserted beside, duplicated, moved). */
  listed: boolean;
  /** Position in that list, and the list's length. */
  index: number;
  siblings: number;
  children: StructureNode[];
  /** Empty single slots of this widget, offered as "+ Add …" rows. */
  emptySlots: string[];
  /** Children lists of this widget (to offer "+ Add child" into). */
  listSlots: string[];
}

export interface StructureContext {
  components?: ReadonlyMap<string, ReferenceEntry>;
  currentComponent?: string;
}

function entryOf(node: CallExpr, context: StructureContext): ReferenceEntry | undefined {
  if (node.name === context.currentComponent && constructorRegistry.has(node.name))
    return constructorRegistry.get(node.name);
  return context.components?.get(node.name) ?? constructorRegistry.get(node.name);
}

function isEmptySlotValue(expr: Expr | undefined): boolean {
  return !expr || (expr.type === "call" && expr.name === "SizedBox" && !Object.keys(expr.args).length);
}

/** The structure under one widget (a variant's build, a part's build). */
export function structureOf(expr: Expr, context: StructureContext = {}, slot?: string, slotLabel?: string, listed = false, index = 0, siblings = 1): StructureNode {
  const node: StructureNode = { expr, slot, slotLabel, listed, index, siblings, children: [], emptySlots: [], listSlots: [] };
  if (expr.type !== "call") return node;
  const entry = entryOf(expr, context);
  if (!entry) return node;
  const slots = Object.entries(entry.parameters).filter(([, type]) => type === "Widget" || type === "List<Widget>");
  const several = slots.length > 1;
  for (const [name, type] of slots) {
    const value = expr.args[name];
    if (type === "List<Widget>") {
      node.listSlots.push(name);
      if (value?.type === "list")
        value.items.forEach((item, i) =>
          node.children.push(structureOf(item, context, name, several ? name : undefined, true, i, value.items.length)),
        );
      else if (value) node.children.push(structureOf(value, context, name, several ? name : undefined));
    } else if (isEmptySlotValue(value)) node.emptySlots.push(name);
    else node.children.push(structureOf(value!, context, name, several ? name : undefined));
  }
  return node;
}

/**
 * The call the Visual editor selects for a cursor position: the innermost
 * widget, declaration, variant or the component itself around it — so a
 * cursor inside a button's Navigate(...) selects the Button.
 */
export function selectableAt(root: CallExpr | undefined, position: number, context: StructureContext = {}): CallExpr | undefined {
  if (!root) return undefined;
  let found: CallExpr | undefined;
  const selectable = (node: CallExpr) => {
    if (node === root || node.name === "Variant" || isDeclaration(node)) return true;
    const group = entryOf(node, context)?.group ?? "";
    return [...WIDGET_PICKER_GROUPS, "Components"].includes(group);
  };
  (function visit(expr: Expr) {
    if (position < expr.from || position > expr.to) return;
    if (expr.type === "call" && selectable(expr)) found = expr;
    for (const child of childrenOfExpr(expr)) visit(child);
  })(root);
  return found;
}

function childrenOfExpr(expr: Expr): Expr[] {
  switch (expr.type) {
    case "call":
      return [...Object.values(expr.args), ...expr.positional];
    case "list":
      return expr.items;
    case "unary":
      return [expr.child];
    case "binary":
      return [expr.left, expr.right];
    case "conditional":
      return [expr.condition, expr.yes, expr.no];
    case "index":
      return [expr.target, expr.index];
    default:
      return [];
  }
}
