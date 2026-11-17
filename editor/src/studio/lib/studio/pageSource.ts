// Synced from Upskale Studio (upskaleapp/src/lib/studio/pageSource.ts). Edit it there, then npm run sync.
import { CLIENT_RESOURCES, type ClientResource,
  MAX_IMPORTS,
  TENANT_RESOURCES,
  declaredType,
  pageDataProblem,
  routeParams,
  type PageDataImport,
  type PageDataParam,
  type PageSearchParam,
  type PageSeo,
  type TenantResource,
} from "./pageData";
import { literalValue, parseSource, type CallExpr, type Expr } from "./parser";
import { bindingFields } from "./dataBindings";
import { ensureBlockSources, newBlockEdit } from "./blockSource";
import { cdslString } from "./sourceEdits";
import type { StudioPage, StudioProject } from "./types";

/**
 * A page's route, data and SEO, written in its own Flux rather than in
 * settings beside it: fields of its Page (pageModel.ts), beside its states
 * and its build:
 *
 *   Page(
 *     name: "Dish",
 *     route: Route(path: "/dishes/$dish"),
 *     data: [
 *       Data(name: "dish", from: Tenant.product(id: route.dish)),
 *       Data(name: "store", from: Tenant.store(store: dish.store_id)),
 *       Data(name: "weather", select: "data", from: Http(
 *         url: "https://api.example.com/w?city={city}", secret: "WEATHER_KEY",
 *         params: [Param(name: "city", value: query.city)])),
 *     ],
 *     seo: Seo(title: "${dish.name} | ${store.name}", description: dish.description,
 *              image: dish.image_url, schema: Schema.product(of: dish)),
 *     states: [...],
 *     build: Scaffold(...),
 *   )
 *
 * Every parameter says where its value comes from: route.x (the page's
 * path), query.x (the address's query string), site.store (the store the
 * site is built for), an earlier Data's field (dish.store_id), or a value.
 *
 * The source is the truth. A page's path, data and seo fields (types.ts,
 * pageData.ts) are kept as what this reads from it (syncPage), so the
 * preview, the compilers and upskale-backend's builds read them as before.
 * A page written as a Component, from before Page, becomes one as its
 * project opens (asPageSource).
 */

export interface PageFieldProblem {
  message: string;
  from: number;
  to: number;
}

export interface PageFields {
  /** Which of the three fields the source has. */
  has: { route: boolean; data: boolean; seo: boolean };
  path?: string;
  /** The search params its route declares; absent when it declares none. */
  search?: PageSearchParam[];
  data: PageDataImport[];
  seo?: PageSeo;
  problems: PageFieldProblem[];
}

const TENANT = "Tenant.";
const CLIENT = "Client.";

const schemaNames: Record<string, PageSeo["schema"]> = {
  "Schema.product": "Product",
  "Schema.restaurant": "Restaurant",
};

/** A Data parameter's value: where it comes from, as pageData models it. */
function paramValue(
  expr: Expr,
  earlier: Set<string>,
  name: string,
  problem: (node: Expr, message: string) => void,
): Omit<PageDataParam, "name"> | undefined {
  const literal = literalValue(expr);
  if ((typeof literal === "string" && !(expr.type === "literal" && expr.segments)) || typeof literal === "number")
    return { from: "value", value: String(literal) };
  if (expr.type === "ref") {
    const [family, ...rest] = expr.name.split(".");
    const field = rest.join(".");
    if (family === "route" && rest.length === 1) return { from: "route", value: field };
    if (family === "query" && rest.length === 1) return { from: "query", value: field };
    if (expr.name === "site.store") return { from: "store" };
    if (earlier.has(family)) return { from: "import", value: expr.name };
  }
  problem(
    expr,
    `${name} needs a value it can be fetched with: route.x (the path), query.x (the address), site.store, an earlier Data's field (such as dish.store_id) or a plain value.`,
  );
  return undefined;
}

const SEARCH_TYPES = ["String", "Number", "Bool"] as const;

/** Route(search: Search(city: String(default: ""), page: Number(default: 1))): the page's search params. */
function readSearch(expr: Expr, problem: (node: Expr, message: string) => void): PageSearchParam[] {
  if (expr.type !== "call" || expr.name !== "Search") {
    problem(expr, 'search is Search(name: String(default: ""), …): the page\'s search params, as ?name= in its address.');
    return [];
  }
  const params: PageSearchParam[] = [];
  for (const [name, value] of Object.entries(expr.args)) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,39}$/.test(name)) problem(value, `${name} isn't a usable search param name.`);
    const type = value.type === "call" ? SEARCH_TYPES.find((known) => known === value.name) : undefined;
    if (!type || value.type !== "call" || value.positional.length || Object.keys(value.args).some((key) => key !== "default")) {
      problem(value, `${name} is String(default: …), Number(default: …) or Bool(default: …); its default is optional.`);
      continue;
    }
    const param: PageSearchParam = { name, type };
    if (value.args.default) {
      const given = literalValue(value.args.default);
      const ok = type === "String" ? typeof given === "string" : type === "Number" ? typeof given === "number" : typeof given === "boolean";
      if (!ok) problem(value.args.default, `${name}'s default is a ${type === "String" ? "text" : type === "Number" ? "number" : "true or false"}.`);
      else param.default = given as string | number | boolean;
    }
    params.push(param);
  }
  if (params.length > 20) problem(expr, "A page has at most 20 search params.");
  return params;
}

function readData(
  list: Expr,
  problem: (node: Expr, message: string) => void,
  search?: PageSearchParam[],
): PageDataImport[] {
  if (list.type !== "list") {
    problem(list, "data is a list: data: [Data(...), ...].");
    return [];
  }
  const imports: PageDataImport[] = [];
  const earlier = new Set<string>();
  for (const item of list.items) {
    if (item.type !== "call" || item.name !== "Data") {
      problem(item, "Each entry of data is a Data(name: ..., from: ...).");
      continue;
    }
    const name = String(literalValue(item.args.name) ?? "");
    const from = item.args.from;
    if (!name) problem(item, "Data needs a name: the name the page reads it by.");
    if (!from || from.type !== "call") {
      problem(item.args.from ?? item, `Data "${name}" needs from: Tenant.… (the business's API), Client.… (the customer's own) or Http(...) (another API).`);
      continue;
    }
    const select = item.args.select === undefined ? undefined : String(literalValue(item.args.select) ?? "");
    const fetch = item.args.fetch === undefined ? undefined : literalValue(item.args.fetch);
    if (fetch !== undefined && fetch !== "server" && fetch !== "client")
      problem(item.args.fetch!, `fetch is "server" (rendered into the page) or "client" (fetched in the browser once it's showing).`);
    const label = name || "Data";
    let entry: PageDataImport | undefined;
    if (from.name.startsWith(CLIENT)) {
      const resource = from.name.slice(CLIENT.length) as ClientResource;
      if (!Object.hasOwn(CLIENT_RESOURCES, resource)) {
        problem(from, `There's no ${from.name}. The client has: ${Object.keys(CLIENT_RESOURCES).map((key) => CLIENT + key + "()").join(", ")}.`);
        continue;
      }
      for (const value of Object.values(from.args)) problem(value, `${from.name}() takes no parameters: it's the customer's own.`);
      entry = { name, source: "client", resource };
    } else if (from.name.startsWith(TENANT)) {
      const resource = from.name.slice(TENANT.length) as TenantResource;
      if (!Object.hasOwn(TENANT_RESOURCES, resource)) {
        problem(from, `There's no ${from.name}. The tenant API has: ${Object.keys(TENANT_RESOURCES).map((key) => TENANT + key).join(", ")}.`);
        continue;
      }
      const params: PageDataParam[] = [];
      for (const [key, value] of Object.entries(from.args)) {
        if (!TENANT_RESOURCES[resource].params.some((param) => param.name === key)) {
          problem(value, `${from.name} has no parameter ${key}.`);
          continue;
        }
        const read = paramValue(value, earlier, `${label}.${key}`, problem);
        if (read) params.push({ name: key, ...withFallback(read, search) });
      }
      entry = { name, source: "tenant", resource, ...(params.length && { params }) };
    } else if (from.name === "Http") {
      const url = String(literalValue(from.args.url) ?? "");
      const secret = from.args.secret === undefined ? undefined : String(literalValue(from.args.secret) ?? "");
      const header = from.args.header === undefined ? undefined : String(literalValue(from.args.header) ?? "");
      const params: PageDataParam[] = [];
      const given = from.args.params;
      if (given && given.type !== "list") problem(given, "params is a list: params: [Param(name: ..., value: ...)].");
      for (const param of given?.type === "list" ? given.items : []) {
        if (param.type !== "call" || param.name !== "Param" || !param.args.value) {
          problem(param, "Each of params is a Param(name: ..., value: ...).");
          continue;
        }
        const key = String(literalValue(param.args.name) ?? "");
        const read = paramValue(param.args.value, earlier, `${label}.${key}`, problem);
        if (read) params.push({ name: key, ...withFallback(read, search) });
      }
      entry = {
        name,
        source: "external",
        url,
        ...(secret && { secret }),
        ...(header && { secretHeader: header }),
        ...(params.length && { params }),
      };
    } else {
      problem(from, `from is Tenant.… (the business's API), Client.… (the customer's own) or Http(...) (another API), not ${from.name}.`);
      continue;
    }
    if (select) entry.select = select;
    if (fetch === "client") entry.fetch = "client";
    // dish<Product>(...): what the page reads it as, held to its source.
    const typeArg = item.args.type;
    if (typeArg) {
      const declared =
        typeArg.type === "ref" ? typeArg.name + (literalValue(item.args.list) === true ? "[]" : "") : undefined;
      if (!declared) problem(typeArg, "type is one of the API's types: Store, Product, Order…, or Json.");
      else {
        const known = (type: string) => Object.keys(bindingFields(type)).length > 0;
        const held = declaredType(entry, declared, known);
        if (held.problem) problem(typeArg, held.problem);
        if (held.select && !entry.select) entry.select = held.select;
        if (held.type) entry.type = held.type;
      }
    }
    imports.push(entry);
    if (name) earlier.add(name);
  }
  return imports;
}

/** A query param with its search param's default, for when the address has none. */
function withFallback(read: Omit<PageDataParam, "name">, search?: PageSearchParam[]): Omit<PageDataParam, "name"> {
  if (read.from !== "query") return read;
  const declared = search?.find((param) => param.name === read.value);
  return declared?.default !== undefined ? { ...read, fallback: String(declared.default) } : read;
}

/** The route, data and SEO a page's source declares, with where each problem is. */
export function readPageFields(source: string, root?: CallExpr): PageFields {
  root ??= parseSource(source).root;
  const fields: PageFields = { has: { route: false, data: false, seo: false }, data: [], problems: [] };
  // Only a Page has them: a component's are reported by the language service.
  if (!root || root.name !== "Page") return fields;
  const problem = (node: Expr, message: string) => {
    if (fields.problems.length < 20) fields.problems.push({ message, from: node.from, to: node.to });
  };
  const { route, data, seo } = root.args;
  if (route) {
    fields.has.route = true;
    const path = route.type === "call" && route.name === "Route" ? literalValue(route.args.path) : undefined;
    if (typeof path === "string") fields.path = path;
    else problem(route, 'route is Route(path: "/…"), its path a plain string with $params: "/dishes/$dish".');
    if (route.type === "call" && route.args.search) fields.search = readSearch(route.args.search, problem);
  }
  if (data) {
    fields.has.data = true;
    fields.data = readData(data, problem, fields.search);
  }
  if (seo) {
    fields.has.seo = true;
    if (seo.type !== "call" || seo.name !== "Seo") problem(seo, "seo is Seo(title: ..., description: ..., image: ..., schema: ...).");
    else {
      const out: PageSeo = {};
      // The head's fields are Flux expressions over the page's data: kept as written.
      for (const key of ["title", "description", "image"] as const)
        if (seo.args[key]) out[key] = source.slice(seo.args[key].from, seo.args[key].to);
      const schema = seo.args.schema;
      if (schema) {
        const kind = schema.type === "call" ? schemaNames[schema.name] : undefined;
        const subject = schema.type === "call" ? schema.args.of : undefined;
        if (!kind || subject?.type !== "ref" || subject.name.includes("."))
          problem(schema, "schema is Schema.product(of: dish) or Schema.restaurant(of: store): what it describes, by its Data name.");
        else {
          out.schema = kind;
          out.subject = subject.name;
        }
      }
      // In the sitemap, indexed: true or false, said outright.
      for (const key of ["sitemap", "index"] as const) {
        const given = seo.args[key];
        if (!given) continue;
        const value = literalValue(given);
        if (typeof value === "boolean") out[key] = value;
        else problem(given, `${key} is true or false.`);
      }
      fields.seo = out;
    }
  }
  // The rules the compilers and upskale-backend hold (pagedata.Validate),
  // pointed at the field they're about.
  const rule = pageDataProblem(fields.data, fields.seo, fields.path ?? "", fields.search);
  if (rule) {
    const at = /SEO|structured data|sitemap/.test(rule) ? seo : data;
    problem(at ?? root, rule);
  }
  if (fields.data.length > MAX_IMPORTS && data) problem(data, `A page reads at most ${MAX_IMPORTS} pieces of data.`);
  return fields;
}

// --- Writing them: an old project's settings, moved into its source ------------------

function paramText(param: PageDataParam): string {
  switch (param.from) {
    case "route":
      return "route." + (param.value ?? "");
    case "query":
      return "query." + (param.value ?? "");
    case "store":
      return "site.store";
    case "import":
      return param.value ?? "";
    default:
      return cdslString(param.value ?? "");
  }
}

/**
 * A path as a Flux string: its $params as they are (only ${…} reads a value
 * in Flux, so "/dishes/$dish" needs no escaping), anything else escaped.
 */
function pathString(path: string): string {
  return path.includes("${") ? cdslString(path) : JSON.stringify(path);
}

export function dataText(item: PageDataImport): string {
  const select = (item.select ? `, select: ${cdslString(item.select)}` : "") + (item.fetch === "client" ? `, fetch: "client"` : "");
  if (item.source === "client") return `Data(name: ${cdslString(item.name)}, from: ${CLIENT}${item.resource}()${select})`;
  if (item.source === "tenant") {
    const args = (item.params ?? []).map((param) => `${param.name}: ${paramText(param)}`).join(", ");
    return `Data(name: ${cdslString(item.name)}, from: ${TENANT}${item.resource}(${args})${select})`;
  }
  const args = [
    `url: ${cdslString(item.url ?? "")}`,
    ...(item.secret ? [`secret: ${cdslString(item.secret)}`] : []),
    ...(item.secretHeader ? [`header: ${cdslString(item.secretHeader)}`] : []),
    ...(item.params?.length
      ? [`params: [${item.params.map((param) => `Param(name: ${cdslString(param.name)}, value: ${paramText(param)})`).join(", ")}]`]
      : []),
  ];
  return `Data(name: ${cdslString(item.name)}, from: Http(${args.join(", ")})${select})`;
}

export function seoText(seo: PageSeo): string {
  const args = [
    ...(["title", "description", "image"] as const).filter((key) => seo[key]).map((key) => `${key}: ${seo[key]}`),
    ...(seo.schema && seo.subject ? [`schema: Schema.${seo.schema === "Product" ? "product" : "restaurant"}(of: ${seo.subject})`] : []),
    ...(["sitemap", "index"] as const).filter((key) => seo[key] !== undefined).map((key) => `${key}: ${seo[key]}`),
  ];
  return `Seo(${args.join(", ")})`;
}

/**
 * A piece of source moved to a new depth: its first line where it lands, the
 * rest shifted so its last line (a closing bracket, usually) sits at
 * `indent`. Keeps the relative indentation inside it.
 */
function reindent(text: string, indent: string): string {
  const lines = text.split("\n");
  if (lines.length === 1) return text;
  const rest = lines.slice(1).filter((line) => line.trim());
  const least = Math.min(...rest.map((line) => line.length - line.trimStart().length));
  const shift = indent.length - least;
  return [
    lines[0],
    ...lines.slice(1).map((line) =>
      !line.trim() ? line : shift >= 0 ? " ".repeat(shift) + line : line.slice(Math.min(-shift, line.length - line.trimStart().length)),
    ),
  ].join("\n");
}

/**
 * A page written as a Component (every page before Page) as a Page: its
 * name, its route, data and SEO (from its settings, or the fields it had),
 * its states and parts, and its one variant's build. A page that can't be
 * one without losing something (more than one variant, options) stays as it
 * is, as does a source that doesn't parse.
 */
export function asPageSource(page: StudioPage): string {
  const source = page.source;
  const root = parseSource(source).root;
  if (!root || root.name !== "Component") return source;
  const variants = root.args.variants?.type === "list" ? root.args.variants.items : [];
  const variant = variants[0];
  if (variants.length !== 1 || variant.type !== "call" || !variant.args.build) return source;
  if (root.args.options || variant.args.options) return source;
  const slice = (expr: Expr) => reindent(source.slice(expr.from, expr.to), "  ");
  const fields: string[] = [`name: ${root.args.name ? source.slice(root.args.name.from, root.args.name.to) : JSON.stringify(page.name)}`];
  if (root.args.route) fields.push("route: " + slice(root.args.route));
  else if (page.path) fields.push(`route: Route(path: ${pathString(page.path)})`);
  if (root.args.data) fields.push("data: " + slice(root.args.data));
  else if (page.data?.length) fields.push("data: [\n" + page.data.map((item) => "    " + dataText(item) + ",\n").join("") + "  ]");
  if (root.args.seo) fields.push("seo: " + slice(root.args.seo));
  else if (page.seo && Object.keys(page.seo).length) fields.push("seo: " + seoText(page.seo));
  if (root.args.states) fields.push("states: " + slice(root.args.states));
  if (root.args.parts) fields.push("parts: " + slice(root.args.parts));
  fields.push("build: " + slice(variant.args.build));
  return "Page(\n" + fields.map((field) => "  " + field + ",\n").join("") + ")\n";
}

/** Kept for old callers: a page's settings written into its source (as a Page). */
export const withPageFields = asPageSource;

/**
 * Fields written in just before the first of a Page's states, parts or
 * build, at its indentation: no reformatting of the rest of the page.
 */
function insertFields(source: string, root: CallExpr, fields: string[]): string {
  const next = ["states", "parts", "build"].map((key) => root.args[key]).find((value) => value);
  if (!fields.length || !next) return source;
  const keyName = ["states", "parts", "build"].find((key) => root.args[key] === next)!;
  const key = source.lastIndexOf(keyName, next.from);
  if (key < 0) return source;
  const lineStart = source.lastIndexOf("\n", key) + 1;
  const before = source.slice(lineStart, key);
  if (/^[ \t]*$/.test(before)) {
    // It starts its own line: each field gets a line of its own above it.
    const text = fields.map((field) => before + field.replace(/\n/g, "\n" + before) + ",\n").join("");
    return source.slice(0, lineStart) + text + source.slice(lineStart);
  }
  // It shares its line: the fields go in front of it on that line.
  return source.slice(0, key) + fields.map((field) => field + ", ").join("") + source.slice(key);
}

export type PageField = "route" | "data" | "seo";

/** Where a page field's value is in the source, or undefined when it has none. */
export function pageFieldRange(source: string, field: PageField): { from: number; to: number } | undefined {
  const root = parseSource(source).root;
  const value = root?.name === "Page" ? root.args[field] : undefined;
  return value && { from: value.from, to: value.to };
}

/**
 * The source with a field to start from, for one the page doesn't have yet
 * (the editor's Route, Data and SEO buttons): its route as it is, an empty
 * data list, or a title. A page still written as a Component becomes a
 * Page first.
 */
export function withPageField(page: StudioPage, field: PageField): string {
  const source = asPageSource(page);
  const root = parseSource(source).root;
  if (!root || root.name !== "Page" || root.args[field]) return source;
  if (root.blocks) {
    // In blocks: data is a usingServer(...) block; a route or SEO, the header's.
    if (field === "data") {
      const edit = newBlockEdit(source, root, "usingServer", "");
      return source.slice(0, edit.from) + edit.text + source.slice(edit.to);
    }
    const stub = field === "route" ? `route: Route(path: ${pathString(page.path || "/")})` : 'seo: Seo(title: "")';
    const headerEnd = source.lastIndexOf(")", root.blocks[0].from);
    const lineStart = source.lastIndexOf("\n", headerEnd - 1) + 1;
    if (source.slice(root.from, headerEnd).includes("\n") && !source.slice(lineStart, headerEnd).trim()) {
      // One field a line: the new one on a line of its own, last.
      const inside = source.slice(0, lineStart).trimEnd();
      const comma = inside.endsWith(",") || inside.endsWith("(") ? "" : ",";
      return inside + comma + "\n  " + stub + ",\n" + source.slice(lineStart);
    }
    const inside = source.slice(root.from, headerEnd).trimEnd();
    const comma = inside.endsWith(",") || inside.endsWith("(") ? "" : ", ";
    return source.slice(0, headerEnd).trimEnd() + comma + stub + source.slice(headerEnd);
  }
  const stub =
    field === "route"
      ? `route: Route(path: ${pathString(page.path || "/")})`
      : field === "data"
        ? "data: [\n]"
        : 'seo: Seo(title: "")';
  return insertFields(source, root, [stub]);
}

/**
 * A page as its source says: its path, data and seo read from it. A field
 * the source doesn't have keeps what the page had; one that doesn't read
 * cleanly keeps the last good value until it does (the editor shows why).
 */
export function syncPage(page: StudioPage): StudioPage {
  const fields = readPageFields(page.source);
  if (fields.problems.length) return page;
  const next: StudioPage = { ...page };
  if (fields.has.route && fields.path !== undefined) next.path = fields.path;
  if (fields.has.route) {
    if (fields.search?.length) next.search = fields.search;
    else delete next.search;
  }
  if (fields.has.data) {
    if (fields.data.length) next.data = fields.data;
    else delete next.data;
  }
  if (fields.has.seo) {
    if (fields.seo && Object.keys(fields.seo).length) next.seo = fields.seo;
    else delete next.seo;
  }
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return same(next.path, page.path) && same(next.data, page.data) && same(next.seo, page.seo) && same(next.search, page.search) ? page : next;
}

/**
 * Every page of a project, its settings moved into its source and read back
 * from it. A project's own source, when it's a copy of its entry page's,
 * follows that page.
 */
export function ensurePageFields<T extends Pick<StudioProject, "pages"> & { source?: string; entryPageId?: string; shellSource?: string; componentSources?: Record<string, string> }>(
  project: T,
): T {
  // Every source in the block form (FLUX.md), once its settings are in it,
  // and its pages read back from their blocks (a Data's declared type).
  const settled = withPageSettings(project);
  const blocks = ensureBlockSources(settled);
  return blocks === settled ? settled : withPageSettings(blocks);
}

/** A project's pages with their settings written into their sources, and read back (no change of form). */
export function withPageSettings<T extends Pick<StudioProject, "pages"> & { source?: string; entryPageId?: string }>(project: T): T {
  if (!project.pages?.length) return project;
  let changed = false;
  let source = project.source;
  const pages = project.pages.map((page) => {
    const written = withPageFields(page);
    const next = syncPage(written === page.source ? page : { ...page, source: written });
    if (next !== page) {
      changed = true;
      if (page.id === project.entryPageId && project.source === page.source) source = next.source;
    }
    return next;
  });
  return changed ? { ...project, pages, ...(source !== undefined && { source }) } : project;
}

/** The $params a page's path declares (for completions in route.…). */
export function pageRouteParams(source: string): string[] {
  const path = readPageFields(source).path;
  return path ? routeParams(path) : [];
}
