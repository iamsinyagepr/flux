// Synced from Upskale Studio (upskaleapp/src/lib/studio/autoWire.ts). Edit it there, then npm run sync.
import { parseSource, type CallExpr, type Expr } from "./parser";
import { optionDeclaration } from "./propDrilling";
import { addDeclaration, callLocations, cdslString, insertWidget, type EditContext, type SourceEdit } from "./sourceEdits";

/**
 * Auto-wiring: what a widget needs from the page it's added to, added with
 * it, so dropping a component in doesn't mean setting it up by hand.
 *
 *  - A component that hands a value up (a search box's text, a menu that
 *    opens) declares it as a value option plus an action option that changes
 *    it: `query` + `setQuery`/`onQueryChange`, `menuOpen` + `toggleMenuOpen`/
 *    `onMenuOpen`. The page gets a state for it, and the component is passed
 *    both: `query: state.query, setQuery: SetState(state: "query", value: event.value)`
 *    (a true/false one is toggled: `onMenuOpen: Toggle(state: "menuOpen")`).
 *  - Any state the inserted widgets name (`SearchField(state: "query")`,
 *    `Toggle(state: "open")`, `state.count`) that the page doesn't declare
 *    yet is declared, with a type that fits how it's used.
 *
 * A state the page already has (same name, a fitting type) is reused.
 */
export interface Wiring {
  /** The widget to insert, with what the component is passed. */
  snippet: string;
  /** States to declare on the page: StringState(…) … */
  declarations: string[];
  /** What was wired, in plain words, e.g. "state.query for SharedHeader's search". */
  notes: string[];
}

type StateType = "BoolState" | "StringState" | "NumberState";
const literal = (expr: Expr | undefined) => (expr?.type === "literal" ? expr.value : undefined);
const declaredOf = (root: CallExpr | undefined, list: "states" | "options") => {
  const value = root?.args[list];
  return value?.type === "list"
    ? value.items.filter((item): item is CallExpr => item.type === "call" && typeof literal(item.args.name) === "string")
    : [];
};
const nameOf = (item: CallExpr) => String(literal(item.args.name));

/** "setQuery", "onQueryChange", "toggleMenuOpen", "onMenuOpen" → "query" / "menuopen". */
const subjectOf = (action: string) =>
  action
    .replace(/^(on|set|toggle|update|change)(?=[A-Z_])/, "")
    .replace(/(Change|Changed|Toggle|Toggled)$/, "")
    .toLowerCase();

const stateFor = (optionType: string): StateType =>
  /^Bool/.test(optionType) ? "BoolState" : /^Number/.test(optionType) ? "NumberState" : "StringState";
const emptyFor = (type: StateType) => (type === "BoolState" ? "false" : type === "NumberState" ? "0" : '""');

/** The widget in [snippet] parsed on its own, or undefined. */
function parseSnippet(snippet: string): { call: CallExpr; offset: number } | undefined {
  const prefix = "Component(value: ";
  const value = parseSource(prefix + snippet + ")").root?.args.value;
  return value?.type === "call" ? { call: value, offset: prefix.length } : undefined;
}

export function wiringFor(host: string, snippet: string, componentSource?: string): Wiring {
  const hostRoot = parseSource(host).root;
  const hostStates = new Map(declaredOf(hostRoot, "states").map((item) => [nameOf(item), item.name]));
  const taken = new Set([...hostStates.keys(), ...declaredOf(hostRoot, "options").map(nameOf)]);
  const added = new Map<string, { type: StateType; initial: string }>();
  const notes: string[] = [];
  /** A page state of [type] named after [base]: the page's own when it fits, else a new one. */
  const claim = (base: string, type: StateType, initial: string) => {
    if (hostStates.get(base) === type || added.get(base)?.type === type) return base;
    let name = base;
    for (let n = 2; taken.has(name) || added.has(name); n++) name = base + n;
    added.set(name, { type, initial });
    taken.add(name);
    return name;
  };

  // 1. The component's value + action option pairs.
  let text = snippet;
  const parsed = parseSnippet(snippet);
  const component = componentSource ? parseSource(componentSource).root : undefined;
  if (parsed && component) {
    const options = declaredOf(component, "options");
    const values = options.filter((item) => item.name !== "ActionOption");
    const extra: string[] = [];
    for (const action of options.filter((item) => item.name === "ActionOption")) {
      const actionName = nameOf(action);
      const subject = subjectOf(actionName);
      const value = values.find((item) => nameOf(item).toLowerCase() === subject);
      if (!value || parsed.call.args[actionName] || parsed.call.args[nameOf(value)]) continue;
      const type = stateFor(value.name);
      const initial = value.args.default ? componentSource!.slice(value.args.default.from, value.args.default.to) : emptyFor(type);
      const state = claim(nameOf(value), type, initial);
      extra.push(
        `${nameOf(value)}: state.${state}`,
        `${actionName}: ${type === "BoolState" ? `Toggle(state: ${cdslString(state)})` : `SetState(state: ${cdslString(state)}, value: event.value)`}`,
      );
      notes.push(`state.${state} for ${parsed.call.name}'s ${nameOf(value)}`);
    }
    if (extra.length) {
      const call = parsed.call;
      const close = call.to - parsed.offset - 1; // the ")" of the call
      const hasArgs = Object.keys(call.args).length > 0 || call.positional.length > 0;
      text = snippet.slice(0, close) + (hasArgs ? ", " : "") + extra.join(", ") + snippet.slice(close);
    }
  }

  // 2. States the inserted widgets name that the page doesn't declare.
  const wired = parseSnippet(text);
  if (wired) {
    const uses = new Map<string, StateType>();
    const note = (name: string, type: StateType) => {
      if (!uses.has(name) || uses.get(name) === "StringState") uses.set(name, type);
    };
    for (const { node } of callLocations(wired.call)) {
      const bound = literal(node.args.state);
      if (typeof bound !== "string") continue;
      if (node.name === "Toggle" || node.name === "Checkbox" || node.name === "Switch") note(bound, "BoolState");
      else if (node.name === "SetState") {
        const next = node.args.value;
        note(
          bound,
          next?.type === "literal" && typeof next.value === "boolean"
            ? "BoolState"
            : next?.type === "literal" && typeof next.value === "number"
              ? "NumberState"
              : next?.type === "binary" && ["+", "-", "*", "/"].includes(next.op)
                ? "NumberState"
                : "StringState",
        );
      } else note(bound, "StringState");
    }
    for (const match of text.matchAll(/(?<![\w.])state\.([A-Za-z_]\w*)/g)) note(match[1], "StringState");
    for (const [name, type] of uses)
      if (!hostStates.has(name) && !added.has(name)) {
        added.set(name, { type, initial: emptyFor(type) });
        taken.add(name);
        notes.push(`state.${name}`);
      }
  }

  return {
    snippet: text,
    declarations: [...added].map(([name, { type, initial }]) => `${type}(name: ${cdslString(name)}, default: ${initial})`),
    notes,
  };
}

/** [source] with [declarations] added as the page's states. */
export function declareStates(source: string, declarations: string[]): string {
  return declarations.reduce((current, declaration) => addDeclaration(current, "states", declaration).source, source);
}

/**
 * [edit] with [declarations] added, keeping its selection on the same widget
 * (each new state is one more call before it in the document).
 */
export function withStates(edit: SourceEdit, declarations: string[]): SourceEdit {
  if (!declarations.length) return edit;
  const calls = (text: string) => {
    const root = parseSource(text).root;
    return root ? callLocations(root).map(({ node }) => node) : [];
  };
  const ordinal = calls(edit.source).findIndex((node) => node.from === edit.selection.from);
  const source = declareStates(edit.source, declarations);
  const node = ordinal >= 0 ? calls(source)[ordinal + declarations.length] : undefined;
  return { source, selection: node ? { from: node.from, to: node.from + node.name.length } : edit.selection };
}

/** One way to pass a page's state (or a component's option) into a shared widget. */
export interface PassChoice {
  /** The shared widget's option that receives it. */
  option: string;
  /** What the menu says: "query", "New option title". */
  label: string;
  /** Arguments to set on the widget: the value, and its paired action for a state. */
  entries: [string, string][];
  /** An option to declare in the component first, when none of its own fits. */
  add?: string;
}

/**
 * The ways [ref] (state.x or options.x, declared in [host]) can be passed into
 * [use], a call of the component whose source is [componentSource]: each of its
 * options of the same type (same name first), then a new option named after
 * the ref when it has none of that name. A state also feeds the option's
 * paired action (setQuery: SetState(…)), so the widget can change it.
 */
export function passChoices(host: string, use: CallExpr, componentSource: string, ref: string): PassChoice[] {
  const hostRoot = parseSource(host).root;
  const component = parseSource(componentSource).root;
  const match = /^(state|options)\.([A-Za-z_]\w*)$/.exec(ref);
  if (!hostRoot || !component || !match) return [];
  const [, scope, name] = match;
  const declared = declaredOf(hostRoot, scope === "state" ? "states" : "options").find((item) => nameOf(item) === name);
  if (!declared || declared.name === "ActionOption") return [];
  const driver = {
    ref,
    type: declared.name,
    initial: declared.args.default ? host.slice(declared.args.default.from, declared.args.default.to) : undefined,
    values:
      declared.args.values?.type === "list" ? declared.args.values.items.map((value) => host.slice(value.from, value.to)) : undefined,
    from: "",
  };
  const wanted = optionDeclaration(driver, name).type;
  const options = declaredOf(component, "options");
  const passed = (option: string) => {
    const value = use.args[option];
    return value ? host.slice(value.from, value.to).trim() : undefined;
  };
  const paired = (option: string): [string, string][] => {
    if (scope !== "state") return [];
    const action = options.find(
      (item) => item.name === "ActionOption" && subjectOf(nameOf(item)) === option.toLowerCase() && !use.args[nameOf(item)],
    );
    if (!action) return [];
    const write = wanted === "BoolOption" ? `Toggle(state: ${cdslString(name)})` : `SetState(state: ${cdslString(name)}, value: event.value)`;
    return [[nameOf(action), write]];
  };
  const choices: PassChoice[] = options
    .filter((item) => item.name === wanted && passed(nameOf(item)) !== ref)
    .sort((a, b) => Number(nameOf(b) === name) - Number(nameOf(a) === name) || Number(!!use.args[nameOf(a)]) - Number(!!use.args[nameOf(b)]))
    .map((item) => ({
      option: nameOf(item),
      label: nameOf(item) + (use.args[nameOf(item)] ? " (replaces " + passed(nameOf(item)) + ")" : ""),
      entries: [[nameOf(item), ref], ...paired(nameOf(item))],
    }));
  if (!options.some((item) => nameOf(item) === name) && !declaredOf(component, "states").some((item) => nameOf(item) === name))
    choices.push({ option: name, label: "New option " + name, entries: [[name, ref]], add: optionDeclaration(driver, name).snippet });
  return choices;
}

/**
 * Insert a picked widget at [range] ([placement], into [slot]) with what it
 * needs from the page (see [wiringFor]): one edit, the new widget selected.
 */
export function insertWired(
  source: string,
  request: { range: { from: number; to: number }; placement: "inside" | "before" | "after"; slot?: string },
  snippet: string,
  componentSource: string | undefined,
  context: EditContext = {},
): SourceEdit {
  const wiring = wiringFor(source, snippet, componentSource);
  return withStates(insertWidget(source, request.range, request.placement, wiring.snippet, context, request.slot), wiring.declarations);
}
