// Synced from Upskale Studio (upskaleapp/src/lib/studio/migrateImports.ts). Edit it there, then npm run sync.
import { migrateStoreRoutes } from "./storeRoutes";
import { FORMER_BINDINGS, bindingFields, type FormerBinding } from "./dataBindings";
import { analyzeSource } from "./languageService";
import { parseSource, type CallExpr } from "./parser";
import { newBlockEdit } from "./blockSource";
import { ensurePageFields, readPageFields, withPageSettings } from "./pageSource";
import { routeParams } from "./pageData";

/**
 * Pages and components once read the cart, the store, the menu and the rest
 * without importing them; nothing is assumed now (FLUX.md, Data). A source
 * written that way is brought up to date: each name it reads but doesn't
 * import gets its import (dataBindings.ts's FORMER_BINDINGS), in usingClient,
 * and each read of it reads it as it is now (cartTotal is cart.total_cents).
 *
 * The checker finds them, so a name a ForEach or an option already gives
 * is left alone. A source that can't be read, or a name with no import to
 * give it (a component's menu: a page passes that in), stays as it is, and
 * the checker says what to do.
 */
export function migrateImports(source: string): string {
  let current = source;
  // The checker says at most 60 things: again, until nothing changes.
  for (let round = 0; round < 6; round++) {
    const next = migrateOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

const SAID = /^([A-Za-z_]\w*) isn't imported: /;

function migrateOnce(source: string): string {
  const root = parseSource(source).root;
  if (!root || (root.name !== "Page" && root.name !== "Component")) return source;
  const page = root.name === "Page";
  const routeHas = page ? routeParams(readPageFields(source, root).path ?? "") : [];
  const analysis = analyzeSource(source);
  const edits: { from: number; to: number; text: string }[] = [];
  const wanted = new Map<string, FormerBinding>();
  // A component's page data: an option a page passes (product<Product>(required: true)).
  const passed = new Map<string, FormerBinding>();
  for (const issue of analysis.diagnostics) {
    const name = SAID.exec(issue.message)?.[1];
    const former = name ? FORMER_BINDINGS[name] : undefined;
    if (!name || !former) continue;
    if (!page && !former.client) {
      const written = source.slice(issue.from, issue.to);
      if (!written.startsWith(name)) continue;
      passed.set(former.name, former);
      edits.push({ from: issue.from, to: issue.to, text: "options." + former.read + written.slice(name.length) });
      continue;
    }
    if (former.route && !routeHas.includes(former.route)) continue;
    const written = source.slice(issue.from, issue.to);
    if (!written.startsWith(name)) continue;
    wanted.set(former.name, former);
    // Already read as it is now (cart.count, stores.results): only its import is missing.
    const first = /^\.(\w+)/.exec(written.slice(name.length))?.[1];
    if (name === former.name && first && Object.hasOwn(bindingFields(typeOf(former).type), first)) continue;
    const text = written === name && former.bare ? former.bare : former.read + written.slice(name.length);
    if (text !== written) edits.push({ from: issue.from, to: issue.to, text });
  }
  if (passed.size) edits.push(...optionEdits(source, root, [...passed.values()]));
  if (!wanted.size) return applyEdits(source, edits);
  // The chosen store, before what's fetched for it.
  const entries = [...wanted.values()];
  if (entries.some((former) => former.store) && !wanted.has("store")) entries.unshift(FORMER_BINDINGS.store);
  const declared = new Set(declaredNames(root));
  const add = entries
    .filter((former, index) => !declared.has(former.name) && entries.findIndex((other) => other.name === former.name) === index)
    .sort((a, b) => Number(Boolean(b.client)) - Number(Boolean(a.client)))
    .map((former) => "  " + former.entry + ",\n");
  if (add.length && !root.blocks) {
    // The single-call form: Data(...) entries in its data list.
    const items = entries
      .filter((former, index) => !declared.has(former.name) && entries.findIndex((other) => other.name === former.name) === index)
      .sort((a, b) => Number(Boolean(b.client)) - Number(Boolean(a.client)))
      .map((former) => singleCallEntry(former.entry));
    const list = root.args.data;
    if (list?.type === "list") {
      const close = source.lastIndexOf("]", list.to);
      const inside = source.slice(source.indexOf("[", list.from) + 1, close).trim();
      edits.push({ from: close, to: close, text: (inside && !inside.endsWith(",") ? ", " : "") + items.join(", ") });
    } else {
      const close = source.lastIndexOf(")", root.to);
      const before = source.slice(0, close).trimEnd();
      const comma = before.endsWith(",");
      edits.push({ from: before.length, to: close, text: (comma || before.endsWith("(") ? "" : ",") + " data: [" + items.join(", ") + "]" + (comma ? "," : "") + String.fromCharCode(10) });
    }
  } else if (add.length) {
    const block = root.blocks?.find((item) => item.name === "usingClient");
    if (block) {
      // After its entries: the store first wouldn't be read before it.
      const open = source.indexOf("(", block.from) + 1;
      const close = source.lastIndexOf(")", block.to);
      const inside = source.slice(open, close).replace(/\s+$/, "");
      const separator = inside.trim() && !inside.trim().endsWith(",") ? "," : "";
      edits.push({ from: open, to: close, text: inside + separator + (inside.trim() ? "\n" : "\n") + add.join("") });
    } else edits.push(newBlockEdit(source, root, "usingClient", add.join("")));
  }
  return applyEdits(source, edits);
}

/** The edits applied, if what comes out reads; otherwise the source as it was, for the person. */
function applyEdits(source: string, edits: { from: number; to: number; text: string }[]): string {
  if (!edits.length) return source;
  let out = source;
  for (const edit of [...edits].sort((a, b) => b.from - a.from)) out = out.slice(0, edit.from) + edit.text + out.slice(edit.to);
  return parseSource(out).root ? out : source;
}

/** A component's new data options: product<Product>(required: true), in its Options (or options: [...]). */
function optionEdits(source: string, root: CallExpr, passed: FormerBinding[]): { from: number; to: number; text: string }[] {
  const have = new Set(
    (root.args.options?.type === "list" ? root.args.options.items : []).flatMap((item) =>
      item.type === "call" && item.args.name?.type === "literal" && typeof item.args.name.value === "string" ? [item.args.name.value] : [],
    ),
  );
  const fresh = passed.filter((former, index) => !have.has(former.name) && passed.findIndex((other) => other.name === former.name) === index);
  if (!fresh.length) return [];
  if (root.blocks) {
    const body = fresh.map((former) => {
      const { type, list } = typeOf(former);
      return `  ${former.name}<${type}${list ? "[]" : ""}>(required: true),
`;
    });
    const block = root.blocks.find((item) => item.name === "Options");
    if (!block) return [newBlockEdit(source, root, "Options", body.join(""))];
    const open = source.indexOf("(", block.from) + 1;
    const close = source.lastIndexOf(")", block.to);
    const inside = source.slice(open, close).replace(/\s+$/, "");
    const separator = inside.trim() && !inside.trim().endsWith(",") ? "," : "";
    return [{ from: open, to: close, text: inside + separator + "\n" + body.join("") }];
  }
  const items = fresh.map((former) => {
    const { type, list } = typeOf(former);
    return `DataOption(name: "${former.name}", type: ${type}${list ? ", list: true" : ""}, required: true)`;
  });
  const list = root.args.options;
  if (list?.type === "list") {
    const close = source.lastIndexOf("]", list.to);
    const inside = source.slice(source.indexOf("[", list.from) + 1, close).trim();
    return [{ from: close, to: close, text: (inside && !inside.endsWith(",") ? ", " : "") + items.join(", ") }];
  }
  const close = source.lastIndexOf(")", root.to);
  const before = source.slice(0, close).trimEnd();
  const comma = before.endsWith(",");
  return [{ from: before.length, to: close, text: (comma || before.endsWith("(") ? "" : ",") + " options: [" + items.join(", ") + "]" + (comma ? "," : "") + String.fromCharCode(10) }];
}

/** The names a file already imports. */
function declaredNames(root: CallExpr): string[] {
  const data = root.args.data;
  if (data?.type !== "list") return [];
  return data.items.flatMap((item) =>
    item.type === "call" && item.args.name?.type === "literal" && typeof item.args.name.value === "string" ? [item.args.name.value] : [],
  );
}

/** Every source of a project, brought up to date. */
export function migrateProjectImports<
  T extends { source?: string; shellSource?: string; pages?: { source: string }[]; componentSources?: Record<string, string> },
>(project: T): T {
  let changed = false;
  const migrate = (source: string) => {
    const next = migrateImports(source);
    if (next !== source) changed = true;
    return next;
  };
  const next = { ...project };
  if (typeof project.source === "string" && project.source) next.source = migrate(project.source);
  if (project.shellSource) next.shellSource = migrate(project.shellSource);
  if (project.pages)
    next.pages = project.pages.map((page) => {
      const source = migrate(page.source);
      return source === page.source ? page : { ...page, source };
    });
  if (project.componentSources)
    next.componentSources = Object.fromEntries(Object.entries(project.componentSources).map(([name, source]) => [name, migrate(source)]));
  return changed ? next : project;
}

/**
 * A project as Studio opens it: in the block form, its pages' settings read
 * from their sources (ensurePageFields), and every source importing what it
 * reads; then its pages' settings again, from what changed.
 */
export function withImports<T extends Parameters<typeof ensurePageFields>[0]>(project: T): T {
  const settled = ensurePageFields(project);
  // A storefront's store pages at the store in their address (storeRoutes.ts).
  const moved = migrateStoreRoutes(settled);
  const ready = moved === settled ? settled : ensurePageFields(moved);
  const migrated = migrateProjectImports(ready);
  return migrated === ready ? ready : ensurePageFields(migrated);
}

/** cart<Cart>(src: Client.cart()) as the single-call form writes it: Data(name: "cart", from: Client.cart(), fetch: "client", type: Cart). */
function singleCallEntry(entry: string): string {
  const match = /^(\w+)<(\w+)(\[\])?>\(src: (.*)\)$/.exec(entry);
  if (!match) throw new Error("Not a data entry: " + entry);
  const [, name, type, list, src] = match;
  return `Data(name: "${name}", from: ${src}, fetch: "client", type: ${type}${list ? ", list: true" : ""})`;
}

/**
 * A template as it's written (the single-call form), importing what it
 * reads: its pages' settings in their sources, migrated, then read back.
 * Quicker than withImports, which also moves every source to the block form.
 */
export function templateWithImports<T extends Parameters<typeof withPageSettings>[0] & { shellSource?: string; componentSources?: Record<string, string> }>(
  project: T,
): T {
  const settled = withPageSettings(project);
  const migrated = migrateProjectImports(settled);
  return migrated === settled ? settled : withPageSettings(migrated);
}

/** A former binding's import's type: cart<Cart> is Cart; products<Product[]> is a list of Product. */
function typeOf(former: FormerBinding): { type: string; list: boolean } {
  const match = /^\w+<(\w+)(\[\])?>/.exec(former.entry)!;
  return { type: match[1], list: Boolean(match[2]) };
}
