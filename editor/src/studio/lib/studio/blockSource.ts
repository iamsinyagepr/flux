// Synced from Upskale Studio (upskaleapp/src/lib/studio/blockSource.ts). Edit it there, then npm run sync.
import { CLIENT_RESOURCES, type ClientResource, declaredResourceType, TENANT_RESOURCES, type TenantResource } from "./pageData";
import { literalValue, OPTION_TYPES, parseSource, STATE_TYPES, type CallExpr, type Expr } from "./parser";

/**
 * A file in the single-call form, Page(name:, route:, data: [...], states:
 * [...], build:) or Component(dsl:, id:, options: [...], variants: [...]),
 * written in the block form (FLUX.md): its header, then usingServer,
 * usingClient, State, Parts and Build (a page), or Options, State, Parts and
 * Build or Variants (a component). Values are copied as they're written,
 * comments and all, re-indented. One already in blocks, one that doesn't
 * parse, and one the block form can't say (a state named "two words") come
 * back as they are.
 */
export function toBlockSource(source: string): string {
  const root = parseSource(source).root;
  if (!root || root.blocks) return source;
  try {
    return root.name === "Page" ? pageBlocks(root, source) : componentBlocks(root, source);
  } catch (error) {
    if (error instanceof CantSay) return source;
    throw error;
  }
}

/** Whether a source is written in the block form. */
export function isBlockSource(source: string): boolean {
  return Boolean(parseSource(source).root?.blocks);
}

class CantSay extends Error {}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PAGE_FIELDS = new Set(["data", "states", "parts", "build"]);
const COMPONENT_FIELDS = new Set(["options", "data", "states", "parts", "variants", "dsl"]);
const STATE_NAMES = Object.fromEntries(Object.entries(STATE_TYPES).map(([short, full]) => [full, short]));
const OPTION_NAMES = Object.fromEntries(Object.entries(OPTION_TYPES).map(([short, full]) => [full, short]));

/** An expression's text as written, its continuation lines at indent. */
function text(source: string, expr: Expr, indent: string): string {
  const raw = source.slice(expr.from, expr.to);
  const lines = raw.split("\n");
  if (lines.length === 1) return raw;
  const rest = lines.slice(1).filter((line) => line.trim());
  const common = Math.min(...rest.map((line) => line.length - line.trimStart().length));
  // The first line's own indent, in the file: the rest sit relative to it.
  const lineStart = source.lastIndexOf("\n", expr.from - 1) + 1;
  const base = source.slice(lineStart, expr.from).length - source.slice(lineStart, expr.from).trimStart().length;
  const shift = Math.min(common, base);
  return [lines[0], ...lines.slice(1).map((line) => (line.trim() ? indent + line.slice(shift) : ""))].join("\n");
}

/** An entry's name: one the block form can write bare. */
function entryName(call: CallExpr): string {
  const name = literalValue(call.args.name);
  if (typeof name !== "string" || !NAME.test(name)) throw new CantSay();
  return name;
}

function args(source: string, call: CallExpr, skip: Set<string>, indent: string): string[] {
  return Object.entries(call.args)
    .filter(([key]) => !skip.has(key))
    .map(([key, value]) => `${key}: ${text(source, value, indent)}`);
}

/** A call's arguments on one line, or one a line when they'd be long. */
function call(name: string, parts: string[], indent: string): string {
  const flat = `${name}(${parts.join(", ")})`;
  if (flat.length <= 100 && !flat.includes("\n")) return flat;
  return `${name}(\n${parts.map((part) => indent + "  " + part.replace(/\n/g, "\n  ") + ",").join("\n")}\n${indent})`;
}

function block(name: string, entries: string[]): string {
  return `${name}(\n${entries.map((entry) => "  " + entry + ",").join("\n")}\n)`;
}

const items = (expr: Expr | undefined): CallExpr[] =>
  expr?.type === "list" ? expr.items.filter((item): item is CallExpr => item.type === "call") : [];

/** A Data as dish<Product>(src: ...): its type declared, a list's select said by it. */
function dataEntry(source: string, data: CallExpr): string {
  const name = entryName(data);
  const from = data.args.from;
  if (!from) throw new CantSay();
  let select = literalValue(data.args.select);
  let type: string;
  const typeArg = data.args.type;
  if (typeArg?.type === "ref") type = typeArg.name + (literalValue(data.args.list) === true ? "[]" : "");
  else if (from.type === "call" && from.name.startsWith("Client.") && Object.hasOwn(CLIENT_RESOURCES, from.name.slice(7)))
    type = CLIENT_RESOURCES[from.name.slice(7) as ClientResource].type;
  else if (from.type === "call" && from.name.startsWith("Tenant.") && Object.hasOwn(TENANT_RESOURCES, from.name.slice(7))) {
    const resource = from.name.slice(7) as TenantResource;
    const own = declaredResourceType(resource);
    const page = /^Page<(.+)>$/.exec(own);
    if (page && select === "data") {
      type = page[1] + "[]";
      select = undefined;
    } else type = select ? "Json" : own;
  } else type = "Json";
  const rest = [`src: ${text(source, from, "  ")}`];
  if (typeof select === "string") rest.push(`select: ${text(source, data.args.select!, "  ")}`);
  rest.push(...args(source, data, new Set(["name", "from", "select", "type", "list", "fetch"]), "  "));
  return `${name}<${type}>(${rest.join(", ")})`;
}

function stateEntry(source: string, state: CallExpr): string {
  const short = STATE_NAMES[state.name];
  if (!short) throw new CantSay();
  return `${entryName(state)}: ${short}(${args(source, state, new Set(["name"]), "  ").join(", ")})`;
}

function optionEntry(source: string, option: CallExpr, indent: string): string {
  const name = entryName(option);
  if (option.name === "DataOption") {
    const type = option.args.type;
    if (type?.type !== "ref") throw new CantSay();
    const list = literalValue(option.args.list) === true ? "[]" : "";
    return `${name}<${type.name}${list}>(${args(source, option, new Set(["name", "type", "list"]), indent).join(", ")})`;
  }
  const short = OPTION_NAMES[option.name];
  if (!short) throw new CantSay();
  return `${name}: ${short}(${args(source, option, new Set(["name"]), indent).join(", ")})`;
}

function partEntry(source: string, part: CallExpr): string {
  if (!part.args.build) throw new CantSay();
  return `${entryName(part)}: ${text(source, part.args.build, "  ")}`;
}

function shared(source: string, root: CallExpr, out: string[]) {
  const states = items(root.args.states);
  if (states.length) out.push(block("State", states.map((state) => stateEntry(source, state))));
  const parts = items(root.args.parts);
  if (parts.length) out.push(block("Parts", parts.map((part) => partEntry(source, part))));
}

function pageBlocks(root: CallExpr, source: string): string {
  if (root.positional.length) throw new CantSay();
  const out = [call("Page", args(source, root, PAGE_FIELDS, "  "), "")];
  const data = items(root.args.data);
  const server = data.filter((item) => literalValue(item.args.fetch) !== "client");
  const client = data.filter((item) => literalValue(item.args.fetch) === "client");
  if (server.length) out.push(block("usingServer", server.map((item) => dataEntry(source, item))));
  if (client.length) out.push(block("usingClient", client.map((item) => dataEntry(source, item))));
  shared(source, root, out);
  if (!root.args.build) throw new CantSay();
  out.push(`Build(\n  ${text(source, root.args.build, "  ")}\n)`);
  return out.join("\n\n") + "\n";
}

function componentBlocks(root: CallExpr, source: string): string {
  if (root.positional.length || literalValue(root.args.dsl) !== 1) throw new CantSay();
  const out = [call("Component", args(source, root, COMPONENT_FIELDS, "  "), "")];
  const options = items(root.args.options);
  if (options.length) out.push(block("Options", options.map((option) => optionEntry(source, option, "  "))));
  // A component's usingClient: the customer's own data (Client.cart(), …).
  const data = items(root.args.data);
  if (data.length) out.push(block("usingClient", data.map((item) => dataEntry(source, item))));
  shared(source, root, out);
  const variants = items(root.args.variants);
  if (!variants.length) throw new CantSay();
  const only = variants[0];
  if (
    variants.length === 1 &&
    literalValue(only.args.id) === "default" &&
    literalValue(only.args.label) === "Default" &&
    Object.keys(only.args).every((key) => ["id", "label", "build"].includes(key)) &&
    only.args.build
  ) {
    out.push(`Build(\n  ${text(source, only.args.build, "  ")}\n)`);
  } else {
    out.push(
      block(
        "Variants",
        variants.map((variant) => {
          const id = literalValue(variant.args.id);
          if (typeof id !== "string" || !NAME.test(id) || !variant.args.build) throw new CantSay();
          const parts = args(source, variant, new Set(["id", "options", "build"]), "    ");
          const own = items(variant.args.options);
          if (own.length) parts.push(`options: Options(${own.map((option) => optionEntry(source, option, "    ")).join(", ")})`);
          parts.push(`Build(\n    ${text(source, variant.args.build, "    ")}\n  )`);
          return `${id}: Variant(${parts.join(", ")})`;
        }),
      ),
    );
  }
  return out.join("\n\n") + "\n";
}

/**
 * A declaration written for the single-call form (StringState(name: "q",
 * default: ""), a StringOption, a Part) as its entry in a block: q: String(default: "").
 */
export function blockEntry(list: "options" | "states" | "parts", snippet: string): string {
  const wrapped = "Component(value: " + snippet + ")";
  const value = parseSource(wrapped).root?.args.value;
  if (value?.type !== "call") throw new Error("Expected a declaration.");
  if (list === "states") return stateEntry(wrapped, value);
  if (list === "parts") return partEntry(wrapped, value);
  return optionEntry(wrapped, value, "  ");
}

/** The block a declaration list is written in. */
export const LIST_BLOCKS = { options: "Options", states: "State", parts: "Parts", data: "usingServer" } as const;

/**
 * Where a new block goes in a block-form file: before the first block that
 * comes after it in the order Studio writes them, as text with the blank
 * lines around it.
 */
export function newBlockEdit(source: string, root: CallExpr, name: string, body: string): { from: number; to: number; text: string } {
  const order = root.name === "Page" ? PAGE_ORDER : COMPONENT_ORDER;
  const rank = order.indexOf(name);
  const next = (root.blocks ?? []).find((block) => order.indexOf(block.name) > rank);
  const text = name + "(\n" + body + ")";
  if (next) return { from: next.from, to: next.from, text: text + "\n\n" };
  return { from: source.length, to: source.length, text: (source.endsWith("\n") ? "\n" : "\n\n") + text + "\n" };
}
const PAGE_ORDER = ["usingServer", "usingClient", "State", "Parts", "Build"];
const COMPONENT_ORDER = ["Options", "usingClient", "State", "Parts", "Build", "Variants"];

/** Every source of a project in the block form: its pages, header, components and own source. */
export function ensureBlockSources<T extends { source?: string; shellSource?: string; pages?: { source: string }[]; componentSources?: Record<string, string> }>(
  project: T,
): T {
  let changed = false;
  const convert = (source: string) => {
    const next = toBlockSource(source);
    if (next !== source) changed = true;
    return next;
  };
  const next = { ...project };
  if (typeof project.source === "string" && project.source) next.source = convert(project.source);
  if (project.shellSource) next.shellSource = convert(project.shellSource);
  if (project.pages) next.pages = project.pages.map((page) => {
    const source = convert(page.source);
    return source === page.source ? page : { ...page, source };
  });
  if (project.componentSources)
    next.componentSources = Object.fromEntries(Object.entries(project.componentSources).map(([name, source]) => [name, convert(source)]));
  return changed ? next : project;
}
