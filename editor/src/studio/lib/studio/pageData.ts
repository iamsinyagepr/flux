// Synced from Upskale Studio (upskaleapp/src/lib/studio/pageData.ts). Edit it there, then npm run sync.
/**
 * A page's Data and SEO settings: what it fetches before it's drawn, and the
 * head built from it. Chosen by hand, so a page from a blank project can
 * name its imports and take their parameters from wherever its URL design
 * puts them: the route, the query string, a fixed value, an earlier import,
 * or the site's store.
 *
 * The website fetches imports on its server (rendered there, its SEO in the
 * HTML; an external API's key never reaches the browser); the Flutter app
 * when the page opens. upskale-backend's internal/studio/pagedata holds the
 * same rules for the compilers; keep the two in step.
 */

export type ParamSource = "route" | "query" | "value" | "import" | "store";

export interface PageDataParam {
  name: string;
  from: ParamSource;
  /** route: the $param's name; query: the key; value: the value; import: a path such as dish.store_id. */
  value?: string;
  /** A query param's value when the address has none: its search param's default. */
  fallback?: string;
}

export interface PageDataImport {
  /** How the page's Flux reads it; one named like a built-in (product, store) replaces it here. */
  name: string;
  /**
   * tenant: the business's API (Tenant.x()); external: another API
   * (Http(...)); client: what the app or browser itself holds (Client.x()),
   * read live, never fetched.
   */
  source: "tenant" | "external" | "client";
  /** Tenant: one of TENANT_RESOURCES; client: one of CLIENT_RESOURCES. */
  resource?: TenantResource | ClientResource;
  /** External: an https address with {param} placeholders. */
  url?: string;
  /** A dotted path to the part the page reads ("data"); empty is all of it. */
  select?: string;
  /** External: a website secret sent with the request (server only). */
  secret?: string;
  /** The header it goes in; Authorization (as "Bearer …") when empty. */
  secretHeader?: string;
  params?: PageDataParam[];
  /**
   * Where a website fetches it: "server" (the default, and when absent:
   * rendered into the page, so its SEO can read it) or "client" (by the
   * browser once the page is showing). The apps fetch it when the page opens.
   */
  fetch?: "server" | "client";
  /**
   * What the page reads it as, when that isn't the source's own type: a
   * list from a page of them (Store[], with select "data"), or another API's
   * answer as one of the API's types. Written dish<Product>(...) in the
   * block form (FLUX.md).
   */
  type?: string;
}

/**
 * One of a page's search params (Route(search: Search(city: String(default: "")))):
 * its name in the address (?city=), its type, and its value when the address
 * doesn't say.
 */
export interface PageSearchParam {
  name: string;
  type: "String" | "Number" | "Bool";
  default?: string | number | boolean;
}

export interface PageSeo {
  /** Flux expressions over the page's data, e.g. "${dish.name} | ${store.name}". */
  title?: string;
  description?: string;
  image?: string;
  schema?: "" | "Product" | "Restaurant";
  /** The import the schema describes. */
  subject?: string;
  /** Listed in the website's sitemap.xml: absent is yes, for a page at one address (no $params). */
  sitemap?: boolean;
  /** Indexed by search engines: false says noindex, and leaves it out of the sitemap. */
  index?: boolean;
}

export interface TenantResourceParam {
  name: string;
  required?: boolean;
}

const resources = {
  store: { label: "A store", path: "/stores/{store}", params: [{ name: "store", required: true }] },
  menu: { label: "A store's menu", path: "/stores/{store}/menu", params: [{ name: "store", required: true }] },
  stores: { label: "Stores", path: "/stores", params: [{ name: "q" }, { name: "city" }, { name: "cuisine" }, { name: "limit" }] },
  product: { label: "A product, with its options", path: "/products/{id}", params: [{ name: "id", required: true }] },
  products: {
    label: "A store's products",
    path: "/stores/{store}/products",
    params: [{ name: "store", required: true }, { name: "category_id" }, { name: "limit" }],
  },
  categories: { label: "A store's categories", path: "/stores/{store}/categories", params: [{ name: "store", required: true }] },
  category: { label: "A category", path: "/categories/{id}", params: [{ name: "id", required: true }] },
  cuisines: { label: "Cuisines", path: "/cuisines", params: [] },
  cities: { label: "Cities with stores", path: "/cities", params: [] },
  deliveryOptions: {
    label: "A store's delivery options",
    path: "/stores/{store}/delivery-options",
    params: [{ name: "store", required: true }],
  },
  reviews: { label: "A store's reviews", path: "/stores/{store}/reviews", params: [{ name: "store", required: true }, { name: "limit" }] },
  // The signed-in customer's: only the browser (or the app) has their session.
  me: { label: "The signed-in customer", path: "/me", params: [], auth: true },
  history: { label: "The signed-in customer's orders", path: "/orders", params: [{ name: "limit" }], auth: true },
  order: { label: "One of the signed-in customer's orders", path: "/orders/{id}", params: [{ name: "id", required: true }], auth: true },
  addresses: { label: "The signed-in customer's addresses", path: "/addresses", params: [], auth: true },
};

export type TenantResource = keyof typeof resources;

/**
 * What the app (or the browser) itself holds, imported as Client.x(): the
 * customer's cart, the store they chose, where they are, their checkout and
 * whether they're signed in. Never fetched: read live, so a page shows the
 * cart as it changes. In usingClient only, without parameters.
 */
export const CLIENT_RESOURCES = {
  cart: { label: "The cart", type: "Cart" },
  store: { label: "The store the customer chose", type: "Store" },
  stores: { label: "The stores found for the customer", type: "StoreSearch" },
  location: { label: "Where the customer is", type: "ClientLocation" },
  checkout: { label: "The checkout and its quote", type: "ClientCheckout" },
  session: { label: "Whether the customer is signed in", type: "Session" },
  choices: { label: "The open product's option choices", type: "ProductChoices" },
  review: { label: "The open order's review", type: "OrderReview" },
} as const;

export type ClientResource = keyof typeof CLIENT_RESOURCES;

/** The tenant API's public reads a page can import (pagedata.Resources). */
export const TENANT_RESOURCES: Record<
  TenantResource,
  {
    label: string;
    path: string;
    params: TenantResourceParam[];
    /** The signed-in customer's: fetched by the browser or the app with their session, never by the website's server. */
    auth?: boolean;
  }
> = resources;

export const PARAM_SOURCES: { id: ParamSource; label: string; hint: string }[] = [
  { id: "route", label: "Route", hint: "a $param in the page's path" },
  { id: "query", label: "Query string", hint: "?key= in the address" },
  { id: "value", label: "Value", hint: "fixed" },
  { id: "import", label: "Earlier import", hint: "e.g. dish.store_id" },
  { id: "store", label: "Site's store", hint: "the store the site is built for" },
];

export const MAX_IMPORTS = 8;

const IDENTIFIER = /^[a-z][A-Za-z0-9_]{0,39}$/;
const PARAM = /^[A-Za-z_][A-Za-z0-9_-]{0,39}$/;
const SECRET = /^[A-Z][A-Z0-9_]{0,39}$/;
const HEADER = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;
const SELECT = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;
const RESERVED = new Set(["state", "options", "event", "input", "route", "viewport"]);

/** The $params a page path declares. */
export function routeParams(path: string): string[] {
  return [...path.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]);
}

/** The {params} an external address names. */
export function urlPlaceholders(url: string): string[] {
  return [...url.matchAll(/\{([A-Za-z_][A-Za-z0-9_-]*)\}/g)].map((match) => match[1]);
}

/** The parameters an import needs filled in. */
export function requiredParams(item: PageDataImport): string[] {
  if (item.source === "external") return urlPlaceholders(item.url ?? "");
  if (item.source === "client") return [];
  const resource = item.resource && TENANT_RESOURCES[item.resource as TenantResource];
  return resource ? resource.params.filter((param: TenantResourceParam) => param.required).map((param) => param.name) : [];
}

/** The first problem with a page's data, or "" (pagedata.Validate's rules). */
export function pageDataProblem(
  imports: PageDataImport[] = [],
  seo: PageSeo | undefined,
  path: string,
  /** The route's search params, when it declares them: a query.x is one of them. */
  search?: PageSearchParam[],
): string {
  if (seo?.sitemap === true && path.includes("$"))
    return `${path} has $params, so it's at many addresses and the sitemap can't list it: leave sitemap out.`;
  if (imports.length > MAX_IMPORTS) return "A page imports at most 8 pieces of data.";
  const seen = new Set<string>();
  const declared = routeParams(path);
  for (const item of imports) {
    if (!IDENTIFIER.test(item.name) || RESERVED.has(item.name))
      return `"${item.name}" isn't a usable import name: start with a lowercase letter; not state, options, event, input, route or viewport.`;
    if (seen.has(item.name)) return `${item.name} is imported twice.`;
    if (item.source === "client") {
      if (!item.resource || !Object.hasOwn(CLIENT_RESOURCES, item.resource)) return `Choose what ${item.name} imports from the client.`;
      if (item.fetch !== "client") return `${item.name} is the browser's own (Client.${item.resource}()): it goes in usingClient.`;
      if (item.params?.length) return `${item.name} takes no parameters: Client.${item.resource}() is the customer's own.`;
      if (item.select) return `${item.name} is read whole: Client.${item.resource}() has no select.`;
    } else if (item.source === "tenant") {
      const resource = item.resource && TENANT_RESOURCES[item.resource as TenantResource];
      if (!resource) return `Choose what ${item.name} imports from the tenant.`;
      if (resource.auth && item.fetch !== "client")
        return `${item.name} is the signed-in customer's (Tenant.${item.resource}): only the browser has their session, so it goes in usingClient.`;
      for (const param of item.params ?? [])
        if (!resource.params.some((known: TenantResourceParam) => known.name === param.name))
          return `${item.name} has no parameter ${param.name}.`;
    } else if (item.source === "external") {
      let url: URL | undefined;
      try {
        url = new URL(item.url ?? "");
      } catch {
        url = undefined;
      }
      if (!url || url.protocol !== "https:" || url.username || url.password || (item.url ?? "").length > 500)
        return `${item.name} needs an https address.`;
      if (item.secret && !SECRET.test(item.secret)) return `${item.name}'s secret is named in capitals, such as API_KEY.`;
      if (item.secretHeader && (!HEADER.test(item.secretHeader) || !item.secret))
        return `${item.name} has an invalid secret header.`;
    } else return `${item.name} must come from the tenant, the client or an external API.`;
    if (item.select && !SELECT.test(item.select)) return `${item.name}'s selection must be a path such as data or results.0.`;
    const params = item.params ?? [];
    if (params.length > 8) return `${item.name} has more than 8 parameters.`;
    const given = new Set<string>();
    for (const param of params) {
      if (!PARAM.test(param.name) || given.has(param.name)) return `${item.name} has an invalid or repeated parameter: ${param.name}.`;
      given.add(param.name);
      const value = param.value ?? "";
      if (value.length > 200) return `${item.name}.${param.name}'s value is too long.`;
      if (param.from === "route" && !declared.includes(value))
        return `${item.name}.${param.name} reads $${value}, which the page's path doesn't have.`;
      if (param.from === "query" && !PARAM.test(value)) return `${item.name}.${param.name} needs a query string key.`;
      if (param.from === "query" && search && !search.some((known) => known.name === value))
        return `${item.name}.${param.name} reads query.${value}, which isn't one of the route's search params: add ${value} to Route(search: Search(…)).`;
      if (param.from === "import" && !seen.has(value.split(".")[0]))
        return `${item.name}.${param.name} reads ${value.split(".")[0]}, which isn't imported before it.`;
    }
    for (const name of requiredParams(item)) if (!given.has(name)) return `${item.name} needs a value for ${name}.`;
    seen.add(item.name);
  }
  if (seo) {
    if ([seo.title, seo.description, seo.image].some((field) => (field ?? "").length > 300))
      return "An SEO field is longer than 300 characters.";
    if (seo.schema && !["Product", "Restaurant"].includes(seo.schema)) return "Choose Product or Restaurant structured data.";
    if (seo.schema && !seen.has(seo.subject ?? "") && seo.subject !== "store" && seo.subject !== "product")
      return `The structured data describes ${seo.subject || "nothing"}, which isn't imported.`;
  }
  return "";
}

/** The data and SEO a page keeps: only what's set. */
export function pageDataFields(imports: PageDataImport[], seo: PageSeo): { data?: PageDataImport[]; seo?: PageSeo } {
  const cleanSeo = Object.fromEntries(Object.entries(seo).filter(([, value]) => value)) as PageSeo;
  return {
    ...(imports.length && { data: imports }),
    ...(Object.keys(cleanSeo).length && { seo: cleanSeo }),
  };
}

/**
 * What a tenant read answers with, as Studio's binding schemas name it: a
 * page's import of one is checked (and completed) like the built-ins.
 */
const RESOURCE_TYPES: Record<TenantResource, string> = {
  store: "Store",
  menu: "Menu",
  stores: "Page<Store>",
  product: "PreviewProduct",
  products: "Page<Product>",
  categories: "Page<Category>",
  category: "Category",
  cuisines: "Page<Cuisine>",
  cities: "Page<StoreCity>",
  deliveryOptions: "DeliveryOptions",
  reviews: "Page<OrderReview>",
  me: "Me",
  history: "Page<Order>",
  order: "Order",
  addresses: "Page<Address>",
};

/** A tenant read's type as a page declares it: Product for the product with its options. */
export function declaredResourceType(resource: TenantResource): string {
  const type = RESOURCE_TYPES[resource];
  return type === "PreviewProduct" ? "Product" : type;
}

/**
 * A Data's declared type (dish<Product>, stores<Store[]>) held to its source:
 * the import's select and type, or why it can't be. A tenant read is its own
 * type, or, for a page of them, a list of them (its data); another API's
 * answer is any of the API's types, or Json.
 */
export function declaredType(
  item: Pick<PageDataImport, "source" | "resource" | "select">,
  declared: string,
  known: (type: string) => boolean,
): { select?: string; type?: string; problem?: string } {
  const element = declared.endsWith("[]") ? declared.slice(0, -2) : declared;
  if (declared === "Json") return {};
  if (!known(element.replace(/^Page<(.+)>$/, "$1")))
    return { problem: `There's no type ${declared}: the API's are Store, Product, Category, Menu, Order, Address, Me… or Json for any shape.` };
  if (item.source === "client" && item.resource && Object.hasOwn(CLIENT_RESOURCES, item.resource)) {
    const own = CLIENT_RESOURCES[item.resource as ClientResource].type;
    return declared === own ? {} : { problem: `Client.${item.resource}() is ${own}: declare <${own}>.` };
  }
  if (item.source !== "tenant" || !item.resource || item.select) return { type: declared };
  const own = RESOURCE_TYPES[item.resource as TenantResource];
  if (declared === own || declaredResourceType(item.resource as TenantResource) === declared) return {};
  const page = /^Page<(.+)>$/.exec(own);
  if (page && declared === page[1] + "[]") return { select: "data", type: declared };
  const said = declaredResourceType(item.resource as TenantResource);
  return {
    problem: `Tenant.${item.resource}() is ${page ? `a list of ${page[1]}: declare <${page[1]}[]> (or <${said}>, with next_cursor)` : `${said}: declare <${said}>`}.`,
  };
}

/**
 * A page's imports as names its Flux may read, each with its type: a tenant
 * read's own, or "json" (any field) for an external API or a selection.
 */
export function importScope(imports: PageDataImport[] | undefined): Record<string, string> {
  return Object.fromEntries(
    (imports ?? []).map((item) => [
      item.name,
      item.type ??
        (item.source === "client" && item.resource && Object.hasOwn(CLIENT_RESOURCES, item.resource)
          ? CLIENT_RESOURCES[item.resource as ClientResource].type
          : item.source === "tenant" && item.resource && !item.select
            ? RESOURCE_TYPES[item.resource as TenantResource]
            : "json"),
    ]),
  );
}
