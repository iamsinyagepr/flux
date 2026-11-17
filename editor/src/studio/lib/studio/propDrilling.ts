// Synced from Upskale Studio (upskaleapp/src/lib/studio/propDrilling.ts). Edit it there, then npm run sync.
import { linkDynamic, writeDynamic } from "./dynamicProps";
import { parseSource, type CallExpr, type Expr } from "./parser";
import {
  addDeclaration,
  callLocations,
  cdslString,
  isWidget,
  setArgument,
  type EditContext,
  type SourceEdit,
  type SourceRangeRef,
} from "./sourceEdits";

/**
 * Prop drilling on the property canvas. A component can't read the state of
 * the page that uses it; it gets values through its options. So a parent's
 * state or option is shown on the component's canvas (marked with where it
 * was declared), and linking it to a property:
 *   1. adds a matching option to the component (or reuses one),
 *   2. makes the property follow that option, and
 *   3. passes the parent's state to every use of the component in the parent.
 */
export interface InheritedDriver {
  /** As the parent reads it: state.x or options.x. */
  ref: string;
  /** BoolState, StringOption… */
  type: string;
  initial?: string;
  values?: string[];
  /** The document that declares it: a page id or a component name. */
  from: string;
}

const declarations = (root: CallExpr, list: "states" | "options") => {
  const value = root.args[list];
  return value?.type === "list"
    ? value.items.filter((item): item is CallExpr => item.type === "call" && item.args.name?.type === "literal")
    : [];
};
const nameOf = (item: CallExpr) => String((item.args.name as Extract<Expr, { type: "literal" }>).value);
const DRILLABLE = /^(String|Number|Bool)(State|Option)$|^EnumOption$/;

/** The states and options of every document that uses [component] directly. */
export function inheritedDrivers(component: string, documents: Record<string, string>): InheritedDriver[] {
  const out: InheritedDriver[] = [];
  for (const [from, source] of Object.entries(documents)) {
    if (from === component) continue;
    const root = parseSource(source).root;
    if (!root || !callLocations(root).some(({ node }) => node.name === component)) continue;
    const text = (expr: Expr | undefined) => (expr ? source.slice(expr.from, expr.to) : undefined);
    for (const list of ["states", "options"] as const)
      for (const item of declarations(root, list))
        if (DRILLABLE.test(item.name))
          out.push({
            ref: (list === "states" ? "state." : "options.") + nameOf(item),
            type: item.name,
            initial: text(item.args.default),
            values:
              item.name === "EnumOption" && item.args.values?.type === "list"
                ? item.args.values.items.map((value) => source.slice(value.from, value.to))
                : undefined,
            from,
          });
  }
  return out;
}

/** The option a parent's state or option becomes in the component. */
export function optionDeclaration(driver: InheritedDriver, name: string): { type: string; snippet: string } {
  const n = cdslString(name);
  const label = cdslString(name[0].toUpperCase() + name.slice(1));
  const kind = driver.type.replace(/(State|Option)$/, "");
  const initial = driver.initial;
  switch (kind) {
    case "Bool":
      return { type: "BoolOption", snippet: `BoolOption(name: ${n}, label: ${label}, default: ${initial ?? "false"})` };
    case "Number":
      return { type: "NumberOption", snippet: `NumberOption(name: ${n}, label: ${label}, min: -1000000, max: 1000000, default: ${initial ?? "0"})` };
    case "Enum":
      return {
        type: "EnumOption",
        snippet: `EnumOption(name: ${n}, label: ${label}, values: [${(driver.values ?? []).join(", ")}], default: ${initial ?? driver.values?.[0] ?? "null"})`,
      };
    default:
      return { type: "StringOption", snippet: `StringOption(name: ${n}, label: ${label}, maxLength: 200, default: ${initial ?? '""'})` };
  }
}

/**
 * The component's option for [driver]: one of the same name and type is
 * reused; otherwise a free name is chosen and it is added.
 */
export function optionFor(componentSource: string, driver: InheritedDriver): { name: string; add?: string } {
  const root = parseSource(componentSource).root;
  const options = root ? declarations(root, "options") : [];
  const base = driver.ref.replace(/^(state|options)\./, "");
  const wanted = optionDeclaration(driver, base).type;
  const same = options.find((item) => nameOf(item) === base);
  if (same && same.name === wanted) return { name: base };
  const taken = new Set([...options, ...(root ? declarations(root, "states") : [])].map(nameOf));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = base + n;
  return { name, add: optionDeclaration(driver, name).snippet };
}

/** Pass [valueRef] as [option] to every use of [component] that doesn't set it yet. */
export function passToUses(parentSource: string, component: string, option: string, valueRef: string): string {
  const calls = (text: string) => {
    const root = parseSource(text).root;
    return root ? callLocations(root).map(({ node }) => node) : [];
  };
  const ordinals = calls(parentSource)
    .map((node, index) => (node.name === component && !node.args[option] ? index : -1))
    .filter((index) => index >= 0);
  let current = parentSource;
  // Setting an argument adds no call before a later use, so ordinals hold.
  for (const ordinal of ordinals) {
    const node = calls(current)[ordinal];
    if (node?.name === component) current = setArgument(current, { from: node.from, to: node.to }, option, valueRef).source;
  }
  return current;
}

/**
 * In the component: make property [property] of the widget at [range]
 * follow options.[option] (adding the option when [add] is given), as one
 * edit that leaves the widget selected.
 */
export function drillProperty(
  source: string,
  range: SourceRangeRef,
  property: string,
  current: string,
  option: string,
  driver: InheritedDriver,
  add?: string,
): SourceEdit {
  const calls = (text: string) => {
    const root = parseSource(text).root;
    return root ? callLocations(root).map(({ node }) => node) : [];
  };
  const ordinal = calls(source).findIndex((node) => node.from === range.from && node.to === range.to);
  if (ordinal < 0) throw new Error("Select the widget again and retry.");
  const bool = /Bool/.test(driver.type);
  const first = driver.values?.[0] ?? driver.initial ?? (/Number/.test(driver.type) ? "0" : '""');
  let next = setArgument(source, range, property, writeDynamic(linkDynamic(current, "options." + option, bool, first))).source;
  // The new option is a call before the widget (options come before variants).
  if (add) next = addDeclaration(next, "options", add).source;
  const node = calls(next)[ordinal + (add ? 1 : 0)];
  return { source: next, selection: { from: node.from, to: node.from + node.name.length } };
}

/**
 * The widgets inside a component that read its options, one entry per widget
 * and option: what a value passed into the component ends up driving. Only a
 * widget's own arguments count (not the widgets it holds).
 */
export function optionUses(componentSource: string, context: EditContext = {}): { option: string; widget: CallExpr }[] {
  const root = parseSource(componentSource).root;
  if (!root) return [];
  const holdsWidgets = (value: Expr) =>
    value.type === "call"
      ? isWidget(value, context)
      : value.type === "list" && value.items.some((item) => item.type === "call" && isWidget(item, context));
  const out: { option: string; widget: CallExpr }[] = [];
  for (const { node } of callLocations(root)) {
    if (!isWidget(node, context)) continue;
    const seen = new Set<string>();
    for (const value of [...Object.values(node.args), ...node.positional]) {
      if (holdsWidgets(value)) continue;
      for (const match of componentSource.slice(value.from, value.to).matchAll(/(?<![\w.])options\.([A-Za-z_]\w*)/g))
        if (!seen.has(match[1])) {
          seen.add(match[1]);
          out.push({ option: match[1], widget: node });
        }
    }
  }
  return out;
}
