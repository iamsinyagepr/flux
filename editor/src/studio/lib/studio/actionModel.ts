// Synced from Upskale Studio (upskaleapp/src/lib/studio/actionModel.ts). Edit it there, then npm run sync.
import type { Expr } from "./parser";
import { constructorRegistry } from "./registry";
import { cdslString } from "./sourceEdits";

/**
 * Actions as the action builder edits them: which action, and each of its
 * parameters as Flux text. Everything is chosen from lists (states, routes,
 * pages, bindings); a parameter written some other way is kept as it is.
 */
export type ActionNode =
  | { kind: "none" }
  /** An ActionOption passed straight through: `onTap: options.onPick`. */
  | { kind: "option"; name: string }
  | { kind: "call"; name: string; args: Record<string, string> }
  /** Actions(actions: [...]): several in order. */
  | { kind: "sequence"; steps: ActionNode[] }
  /** Something the builder can't show as choices (a conditional…). */
  | { kind: "unknown"; text: string };

export interface ActionChoice {
  name: string;
  label: string;
  group: string;
}

/** The actions the builder offers, grouped and in plain words. */
export const ACTION_CHOICES: ActionChoice[] = [
  { name: "Navigate", label: "Go to a page", group: "Navigation" },
  { name: "OpenProduct", label: "Open a product", group: "Navigation" },
  { name: "ScrollTo", label: "Scroll to a section", group: "Navigation" },
  { name: "SetState", label: "Set a state", group: "State" },
  { name: "Toggle", label: "Toggle a state", group: "State" },
  { name: "AddToCart", label: "Add a product to the cart", group: "Cart and orders" },
  { name: "AddConfiguredProduct", label: "Add this product (with its choices)", group: "Cart and orders" },
  { name: "PlaceOrder", label: "Place the order", group: "Cart and orders" },
  { name: "SetCheckout", label: "Set a checkout choice", group: "Cart and orders" },
  { name: "SetTip", label: "Set the tip", group: "Cart and orders" },
  { name: "CancelOrder", label: "Cancel the order", group: "Cart and orders" },
  { name: "SubmitReview", label: "Review the order", group: "Cart and orders" },
  { name: "ToggleOption", label: "Choose a product option", group: "Cart and orders" },
  { name: "ChangeCartLine", label: "Change a cart line's quantity", group: "Cart and orders" },
  { name: "RemoveCartLine", label: "Remove a cart line", group: "Cart and orders" },
  { name: "OpenOrder", label: "Open an order", group: "Cart and orders" },
  { name: "SearchPlaces", label: "Search addresses", group: "Finding a store" },
  { name: "ChoosePlace", label: "Choose an address", group: "Finding a store" },
  { name: "UseMyLocation", label: "Use my location", group: "Finding a store" },
  { name: "ChooseCity", label: "Choose a city", group: "Finding a store" },
  { name: "SearchStores", label: "Search stores", group: "Finding a store" },
  { name: "ChooseStore", label: "Open a store", group: "Finding a store" },
  { name: "SubmitForm", label: "Submit a form", group: "Forms" },
  { name: "RemoveAddress", label: "Remove an address", group: "Account" },
  { name: "ResetForm", label: "Reset a form", group: "Forms" },
  { name: "SavePreviewAddress", label: "Save the address", group: "Forms" },
  { name: "ResetPreviewPassword", label: "Update the password", group: "Forms" },
  { name: "PayOrder", label: "Pay for an online order", group: "Cart and orders" },
  { name: "SignIn", label: "Sign in", group: "Account" },
  { name: "SignUp", label: "Create an account", group: "Account" },
  { name: "SignOut", label: "Sign out", group: "Account" },
  { name: "ShowMessage", label: "Show a message", group: "Feedback" },
  { name: "ToggleDarkMode", label: "Switch light or dark mode", group: "Feedback" },
  { name: "RunAction", label: "Call an option", group: "Component" },
  { name: "Actions", label: "Several actions in order", group: "Component" },
];
// And older names still in pages, edited as before though no longer offered.
const KNOWN = new Set([...ACTION_CHOICES.map((choice) => choice.name), "SignOutPreviewCustomer"]);

/** A parameter of an action, in the registry's order. */
export function actionParameters(name: string): { name: string; type: string; required: boolean }[] {
  const entry = constructorRegistry.get(name);
  if (!entry) return [];
  return Object.entries(entry.parameters).map(([key, type]) => ({
    name: key,
    type,
    required: entry.required.includes(key),
  }));
}

export function readActionNode(source: string, expr: Expr | undefined): ActionNode {
  if (!expr) return { kind: "none" };
  const text = source.slice(expr.from, expr.to);
  if (expr.type === "literal" && expr.value === null) return { kind: "none" };
  if (expr.type === "ref" && /^options\.[A-Za-z_]\w*$/.test(expr.name)) return { kind: "option", name: expr.name.slice(8) };
  if (expr.type !== "call" || !KNOWN.has(expr.name) || expr.positional.length) return { kind: "unknown", text };
  if (expr.name === "Actions") {
    const list = expr.args.actions;
    if (list?.type !== "list" || Object.keys(expr.args).length !== 1) return { kind: "unknown", text };
    return { kind: "sequence", steps: list.items.map((item) => readActionNode(source, item)) };
  }
  const known = new Set(actionParameters(expr.name).map((parameter) => parameter.name));
  if (Object.keys(expr.args).some((key) => !known.has(key))) return { kind: "unknown", text };
  return {
    kind: "call",
    name: expr.name,
    args: Object.fromEntries(Object.entries(expr.args).map(([key, value]) => [key, source.slice(value.from, value.to)])),
  };
}

/** The Flux for an action (undefined for none: remove the property). */
export function writeActionNode(node: ActionNode): string | undefined {
  switch (node.kind) {
    case "none":
      return undefined;
    case "option":
      return "options." + node.name;
    case "unknown":
      return node.text;
    case "sequence": {
      const steps = node.steps.map(writeActionNode).filter((step): step is string => !!step);
      return steps.length ? `Actions(actions: [${steps.join(", ")}])` : undefined;
    }
    case "call": {
      const order = actionParameters(node.name).map((parameter) => parameter.name);
      const args = order.filter((key) => node.args[key] !== undefined && node.args[key] !== "").map((key) => `${key}: ${node.args[key]}`);
      return `${node.name}(${args.join(", ")})`;
    }
  }
}

export interface ActionContext {
  /** Declared states and their types (BoolState…). */
  states: Record<string, string>;
  /** ActionOption names. */
  actionOptions: string[];
  /** Built-in Route tokens. */
  routes: string[];
  /** The app's page paths, for Navigate. */
  pagePaths: string[];
  /** Bindings in scope (product, store.name…). */
  bindings: string[];
}

/** A starting action: each required parameter filled with a sensible choice. */
export function starterAction(name: string, context: ActionContext): ActionNode {
  if (name === "none") return { kind: "none" };
  if (name === "Actions") return { kind: "sequence", steps: [{ kind: "call", name: "ShowMessage", args: { message: cdslString("Done") } }] };
  const bools = Object.keys(context.states).filter((state) => context.states[state] === "BoolState");
  const anyState = Object.keys(context.states)[0];
  const args: Record<string, string> = {};
  for (const parameter of actionParameters(name)) {
    if (!parameter.required && !(name === "AddToCart" && parameter.name === "quantity") && !(name === "AddConfiguredProduct" && parameter.name === "quantity"))
      continue;
    const choices = parameterChoices(name, parameter.name, { kind: "call", name, args }, context);
    if (name === "Toggle" && parameter.name === "state") args.state = cdslString(bools[0] ?? anyState ?? "open");
    else if (name === "SetState" && parameter.name === "state") args.state = cdslString(anyState ?? "value");
    else if (choices.length) args[parameter.name] = choices[0].value;
    else if (/Number/.test(parameter.type)) args[parameter.name] = "1";
    else args[parameter.name] = cdslString(parameter.name === "message" ? "Done" : "");
  }
  if (name === "SetState") args.value = parameterChoices(name, "value", { kind: "call", name, args }, context)[0]?.value ?? '""';
  return { kind: "call", name, args };
}

export interface ParameterChoice {
  value: string;
  label: string;
  /** Pick a fixed value: the builder shows a text or number box. */
  input?: "text" | "number";
}

const stateName = (text: string | undefined) => (text && /^"(.*)"$/.test(text) ? JSON.parse(text) as string : undefined);

/**
 * The choices for one parameter of an action, given what's in scope. A
 * choice with `input` stands for "a value you type"; an empty list means the
 * parameter is typed freely (a message).
 */
export function parameterChoices(
  action: string,
  parameter: string,
  node: Extract<ActionNode, { kind: "call" }>,
  context: ActionContext,
): ParameterChoice[] {
  const states = Object.keys(context.states);
  if ((action === "SetState" || action === "Toggle") && parameter === "state") {
    const allowed = action === "Toggle" ? states.filter((state) => context.states[state] === "BoolState") : states;
    return allowed.map((state) => ({ value: cdslString(state), label: state }));
  }
  if (action === "SetState" && parameter === "value") {
    const target = stateName(node.args.state);
    const type = target ? context.states[target] : undefined;
    const ref = "state." + target;
    if (type === "BoolState")
      return [
        { value: "true", label: "true" },
        { value: "false", label: "false" },
        { value: "!" + ref, label: "the opposite" },
      ];
    if (type === "NumberState")
      return [
        { value: ref + " + 1", label: "add 1" },
        { value: ref + " - 1", label: "subtract 1" },
        { value: "0", label: "a number…", input: "number" },
      ];
    return [
      { value: '""', label: "a text…", input: "text" },
      ...context.bindings.slice(0, 40).map((binding) => ({ value: binding, label: binding })),
    ];
  }
  if (action === "Navigate" && parameter === "to")
    return [
      ...context.routes.map((route) => ({ value: "Route." + route, label: "Route." + route })),
      ...context.pagePaths.map((path) => ({ value: cdslString(path), label: path })),
    ];
  if ((action === "OpenProduct" || action === "AddToCart") && parameter === "product") {
    const products = context.bindings.filter((binding) => /^product\b|\.product\b/.test(binding) && !/\.(name|id|price|description|image)/.test(binding));
    return [...new Set(["product", ...products])].map((value) => ({ value, label: value }));
  }
  if (action === "RunAction" && parameter === "action")
    return context.actionOptions.map((name) => ({ value: "options." + name, label: "options." + name }));
  const type = actionParameters(action).find((item) => item.name === parameter)?.type ?? "";
  if (/Number/.test(type))
    return [
      { value: "1", label: "a number…", input: "number" },
      ...states.filter((state) => context.states[state] === "NumberState").map((state) => ({ value: "state." + state, label: "state." + state })),
    ];
  return [];
}

/**
 * Set one parameter. Choosing another state for SetState also resets its
 * value to one that suits the new state's type (true for a BoolState…).
 */
export function setActionArgument(
  node: Extract<ActionNode, { kind: "call" }>,
  parameter: string,
  value: string,
  context: ActionContext,
): Extract<ActionNode, { kind: "call" }> {
  const next = { ...node, args: { ...node.args, [parameter]: value } };
  if (node.name === "SetState" && parameter === "state" && value !== node.args.state)
    next.args.value = parameterChoices("SetState", "value", next, context)[0]?.value ?? '""';
  return next;
}
