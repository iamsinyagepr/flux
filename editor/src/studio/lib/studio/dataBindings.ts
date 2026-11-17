// Synced from Upskale Studio (upskaleapp/src/lib/studio/dataBindings.ts). Edit it there, then npm run sync.
import type { ReferenceEntry } from "./registry";
import { sdkSchemas, sdkAliases } from "./sdkBindingSchema";
import { literalValue, parseSource, type Expr } from "./parser";
import { importScope, type PageDataImport } from "./pageData";
export interface BindingField {
  type: string;
  optional: boolean;
  description: string;
}
/**
 * What each name in scope is: a type ("Store"), a list of fields it has
 * (no types known), or a map of its fields to their types (a component's
 * options: options.product is a Product when it's a DataOption).
 */
export type BindingScope = Record<string, string | string[] | Record<string, string>>;
const schemas: Record<string, { fields: Record<string, BindingField> }> = {
  ...sdkSchemas,
  ProductConfiguration: {
    fields: {
      valid: {
        type: "boolean",
        optional: false,
        description: "Whether all required product options have been chosen.",
      },
      addon_price_cents: {
        type: "number",
        optional: false,
        description: "Selected product option price in cents.",
      },
    },
  },
  FormPreview: {
    fields: {
      values: {
        type: "Record<string, unknown>",
        optional: false,
        description: "Current local field values.",
      },
      errors: {
        type: "Record<string, string>",
        optional: false,
        description: "Errors after validation.",
      },
      valid: {
        type: "boolean",
        optional: false,
        description: "Whether enabled fields pass validation.",
      },
      submitted: {
        type: "boolean",
        optional: false,
        description: "Whether the latest submit succeeded.",
      },
    },
  },
  InputEvent: {
    fields: Object.fromEntries(
      ["value", "name", "checked"].map((name) => [
        name,
        {
          type:
            name === "checked"
              ? "boolean"
              : name === "name"
                ? "string"
                : "unknown",
          optional: false,
          description: "Input callback data.",
        },
      ]),
    ),
  },
  // Checkout, quote and reviews, as package:upskale_storefront's bindings
  // name them (StorefrontCheckout, OrderQuote, OrderReview).
  Checkout: {
    fields: Object.fromEntries(
      (
        [
          ["fulfilment", "'delivery' | 'pickup'", "Delivery or pickup."],
          ["payment_method", "string | null", "cash, card, mobile_money or wallet."],
          ["tip_cents", "number", "The tip the customer chose, in cents."],
          ["notes", "string | null", "Notes for the whole order."],
          ["delivery_instructions", "string | null", "Directions for the driver."],
          ["delivery_preset_id", "string | null", "A store delivery preset, instead of distance pricing."],
          ["delivery_latitude", "number | null", "The delivery point, once confirmed on the map."],
          ["delivery_longitude", "number | null", "The delivery point, once confirmed on the map."],
          ["delivery_point_confirmed", "boolean", "The customer confirmed the delivery point (ConfirmDeliveryPoint)."],
        ] as const
      ).map(([name, type, description]) => [
        name,
        { type, optional: false, description },
      ]),
    ),
  },
  CheckoutQuote: {
    fields: Object.fromEntries(
      (
        [
          ["currency", "string", "ISO currency of every amount."],
          ["items_subtotal_cents", "number", "The cart alone."],
          ["charges", "QuotedCharge[]", "The store's own charges that apply."],
          ["delivery_fee_cents", "number", "Delivery, or 0 for a pickup."],
          ["tip_cents", "number", "The checkout's tip."],
          ["total_cents", "number", "What placing the order charges."],
        ] as const
      ).map(([name, type, description]) => [
        name,
        { type, optional: false, description },
      ]),
    ),
  },
  QuotedCharge: {
    fields: {
      name: { type: "string", optional: false, description: "The charge's name." },
      amount_cents: { type: "number", optional: false, description: "Its amount." },
    },
  },
  OrderReview: {
    fields: Object.fromEntries(
      (
        [
          ["id", "string", false],
          ["order_id", "string", false],
          ["store_id", "string", false],
          ["customer_name", "string", true],
          ["food_rating", "number", true],
          ["food_comment", "string", true],
          ["delivery_rating", "number", true],
          ["delivery_comment", "string", true],
          ["created_at", "string", false],
        ] as const
      ).map(([name, type, optional]) => [
        name,
        { type, optional, description: "Order review field; ratings are 1 to 5." },
      ]),
    ),
  },
  // Finding a store and choosing options from a page's own layout, as
  // package:upskale_storefront's bindings name them.
  OptionGroupView: {
    fields: Object.fromEntries(
      (
        [
          ["id", "string", "The group's id, for ToggleOption."],
          ["label", "string", "The group's name."],
          ["min", "number", "How many choices it needs."],
          ["max", "number", "How many it allows."],
          ["single", "boolean", "Exactly one choice (a radio group)."],
          ["required", "boolean", "At least one choice is needed."],
          ["depth", "number", "0 for the product's own groups, 1 for a chosen option's, and so on."],
          ["selected_count", "number", "How many are chosen."],
          ["choices", "OptionChoiceView[]", "The group's choices."],
        ] as const
      ).map(([name, type, description]) => [name, { type, optional: false, description }]),
    ),
  },
  OptionChoiceView: {
    fields: Object.fromEntries(
      (
        [
          ["id", "string", "The choice's id, for ToggleOption."],
          ["label", "string", "The choice's name."],
          ["price_cents", "number", "What it adds to one, in cents (0 when included)."],
          ["selected", "boolean", "Chosen."],
          ["disabled", "boolean", "The group is full: unchoose another first."],
        ] as const
      ).map(([name, type, description]) => [name, { type, optional: false, description }]),
    ),
  },
  PlaceSuggestion: {
    fields: Object.fromEntries(
      (
        [
          ["place_id", "string", "For ChoosePlace."],
          ["main_text", "string", "The street or place."],
          ["secondary_text", "string", "The suburb and city."],
          ["label", "string", "Both, as one line."],
        ] as const
      ).map(([name, type, description]) => [name, { type, optional: false, description }]),
    ),
  },
  StoreCity: {
    fields: Object.fromEntries(
      (
        [
          ["name", "string", "The city's name."],
          ["label", "string", "The same, for ChooseCity."],
          ["latitude", "number", "Where it is."],
          ["longitude", "number", "Where it is."],
        ] as const
      ).map(([name, type, description]) => [name, { type, optional: false, description }]),
    ),
  },
  CustomerLocation: {
    fields: Object.fromEntries(
      (
        [
          ["label", "string", "The place's name, e.g. Rosebank, Johannesburg."],
          ["latitude", "number", "Where it is."],
          ["longitude", "number", "Where it is."],
        ] as const
      ).map(([name, type, description]) => [name, { type, optional: false, description }]),
    ),
  },
  // ---- What a page imports from the client (pageData's CLIENT_RESOURCES).
  Cart: {
    fields: {
      lines: { type: "CartLine[]", optional: false, description: "What's in the cart, a line per product and its options." },
      count: { type: "number", optional: false, description: "How many items: every line's quantity, added up." },
      total_cents: { type: "number", optional: false, description: "The cart's total, in cents." },
    },
  },
  StoreSearch: {
    fields: {
      results: { type: "Store[]", optional: false, description: "The stores found for the customer (SearchStores, or near where they are)." },
      loading: { type: "boolean", optional: false, description: "Still looking." },
    },
  },
  ClientLocation: {
    fields: {
      set: { type: "boolean", optional: false, description: "The customer has said where they are." },
      label: { type: "string", optional: false, description: "The place's name, e.g. Rosebank, Johannesburg; empty until set." },
      latitude: { type: "number | null", optional: false, description: "Where it is." },
      longitude: { type: "number | null", optional: false, description: "Where it is." },
      locating: { type: "boolean", optional: false, description: "Finding the device's location (UseMyLocation)." },
      error: { type: "string | null", optional: false, description: "Why the last attempt to find it failed." },
      places: { type: "PlaceSuggestion[]", optional: false, description: "What SearchPlaces found, for ChoosePlace." },
      cities: { type: "StoreCity[]", optional: false, description: "Cities with stores, for ChooseCity." },
    },
  },
  ClientCheckout: {
    fields: {
      ...Object.fromEntries(
        (
          [
            ["fulfilment", "'delivery' | 'pickup'", "Delivery or pickup."],
            ["payment_method", "string | null", "cash, card, mobile_money or wallet."],
            ["tip_cents", "number", "The tip the customer chose, in cents."],
            ["notes", "string | null", "Notes for the whole order."],
            ["delivery_instructions", "string | null", "Directions for the driver."],
            ["delivery_preset_id", "string | null", "A store delivery preset, instead of distance pricing."],
            ["delivery_latitude", "number | null", "The delivery point, once confirmed on the map."],
            ["delivery_longitude", "number | null", "The delivery point, once confirmed on the map."],
            ["delivery_point_confirmed", "boolean", "The customer confirmed the delivery point (ConfirmDeliveryPoint)."],
          ] as const
        ).map(([name, type, description]) => [name, { type, optional: false, description }]),
      ),
      quote: { type: "CheckoutQuote", optional: false, description: "What the order comes to, as the store prices it." },
    },
  },
  ProductChoices: {
    fields: {
      groups: {
        type: "OptionGroupView[]",
        optional: false,
        description: "The open product's option groups, a chosen option's own groups right after it. Choose with ToggleOption.",
      },
      valid: { type: "boolean", optional: false, description: "Every required option is chosen." },
      addon_price_cents: { type: "number", optional: false, description: "What the chosen options add to one, in cents." },
    },
  },
  Session: {
    fields: {
      signed_in: { type: "boolean", optional: false, description: "A customer is signed in." },
      signing_in: { type: "boolean", optional: false, description: "SignIn or SignUp is working." },
      error: { type: "string | null", optional: false, description: "Why the last SignIn or SignUp didn't take." },
    },
  },
  // A cart line, as package:upskale_storefront's CartLine.toJson names it.
  CartLine: {
    fields: Object.fromEntries(
      (
        [
          ["id", "string", "The line's id."],
          ["product_id", "string", "The product's id."],
          ["name", "string", "The product's name."],
          ["quantity", "number", "How many."],
          ["unit_cents", "number", "One, with its options, in cents."],
          ["line_total_cents", "number", "The line's total in cents."],
          ["choices", "string[]", "The options chosen, as labels."],
          ["notes", "string | null", "The customer's note for this line."],
        ] as const
      ).map(([name, type, description]) => [name, { type, optional: false, description }]),
    ),
  },
  PreviewProduct: {
    fields: {
      ...sdkSchemas.MenuProduct.fields,
      needs_selection: {
        type: "boolean",
        optional: false,
        description: "Computed from required add-on groups.",
      },
    },
  },
  NavigationItem: {
    fields: Object.fromEntries(
      ["label", "route", "icon", "active"].map((name) => [
        name,
        {
          type: name === "active" ? "boolean" : "string",
          optional: false,
          description: "Preview navigation item.",
        },
      ]),
    ),
  },
};
export const responseBindings: Record<
  string,
  { type: string; description: string }
> = {
  configuration: {
    type: "ProductConfiguration",
    description: "Current local product choices and additional price.",
  },
  deliveryFeeCents: {
    type: "number",
    description: "What a delivery costs as the checkout stands: the chosen named place's fee, the distance quote, or the store's flat fee.",
  },
  cartTotal: {
    type: "number",
    description: "Local preview cart subtotal in cents.",
  },
  optionGroups: {
    type: "OptionGroupView[]",
    description: "The open product's option groups, a chosen option's own groups right after it. Choose with ToggleOption.",
  },
  location: {
    type: "CustomerLocation | null",
    description: "Where the customer is ordering to, once chosen.",
  },
  places: {
    type: "PlaceSuggestion[]",
    description: "Address suggestions from SearchPlaces.",
  },
  cities: {
    type: "StoreCity[]",
    description: "The cities the business has stores in, for ChooseCity.",
  },
  signedIn: {
    type: "boolean",
    description: "The customer is signed in to an account (not a guest). SignIn, SignUp and SignOut change it.",
  },
  signingIn: {
    type: "boolean",
    description: "SignIn or SignUp is working.",
  },
  authError: {
    type: "string | null",
    description: "Why the last SignIn or SignUp didn't work.",
  },
  locating: {
    type: "boolean",
    description: "UseMyLocation is finding the device.",
  },
  locationError: {
    type: "string | null",
    description: "Why UseMyLocation couldn't find the device.",
  },
  storesLoading: {
    type: "boolean",
    description: "SearchStores is looking.",
  },
  cart: {
    type: "CartLine[]",
    description: "The cart's lines: name, quantity, price and choices.",
  },
  checkout: {
    type: "Checkout",
    description:
      "The checkout's choices: fulfilment, payment method, tip, notes. Set with SetCheckout and SetTip.",
  },
  quote: {
    type: "CheckoutQuote",
    description:
      "What the cart costs with the checkout's choices: subtotal, charges, delivery, tip and total.",
  },
  review: {
    type: "OrderReview",
    description: "The open order's review, or null until one is left.",
  },
  reviews: {
    type: "OrderReview[]",
    description: "The store's reviews, newest first.",
  },
  reviewsPage: {
    type: "Page<OrderReview>",
    description: "Store reviews response envelope.",
  },
  store: {
    type: "Store",
    description: "Selected store; live menu/directory data when connected.",
  },
  stores: {
    type: "Store[]",
    description: "Live directory results or example stores.",
  },
  menu: {
    type: "Menu",
    description:
      "Whole catalogue response, including nested categories and add-on groups.",
  },
  categories: {
    type: "MenuCategory[]",
    description: "Catalogue categories, including their products.",
  },
  category: {
    type: "MenuCategory",
    description: "First category, or null for an empty catalogue.",
  },
  products: {
    type: "PreviewProduct[]",
    description:
      "Visible catalogue products with SDK fields and computed needs_selection.",
  },
  product: {
    type: "PreviewProduct",
    description: "Selected product or the first available product.",
  },
  addonGroups: {
    type: "AddonGroup[]",
    description: "Selected product's SDK add-on groups.",
  },
  addonGroup: {
    type: "AddonGroup",
    description: "First add-on group, or null.",
  },
  addon: {
    type: "Addon",
    description: "First option in the selected product's first group, or null.",
  },
  cuisines: {
    type: "Cuisine[]",
    description:
      "SDK cuisine list when connected, otherwise an example response.",
  },
  cuisine: { type: "Cuisine", description: "First cuisine, or null." },
  cuisinesPage: {
    type: "Page<Cuisine>",
    description: "Cuisine response envelope with next_cursor.",
  },
  deliveryOptions: {
    type: "DeliveryOptions",
    description:
      "SDK delivery mode and presets when connected; null if this optional read fails.",
  },
  deliveryPresets: {
    type: "DeliveryPreset[]",
    description: "Named delivery fee presets.",
  },
  deliveryPreset: {
    type: "DeliveryPreset",
    description: "First delivery preset, or null.",
  },
  orders: {
    type: "Order[]",
    description:
      "Local preview orders; example response in component-only previews. No live customer order read.",
  },
  order: {
    type: "Order",
    description: "Selected local order, or null when no order exists.",
  },
  ordersPage: {
    type: "Page<Order>",
    description: "Order list response envelope.",
  },
  orderItems: { type: "OrderItem[]", description: "Selected order's items." },
  orderItem: {
    type: "OrderItem",
    description: "First selected order item, or null.",
  },
  orderAddon: {
    type: "OrderItemAddon",
    description: "First selected order item add-on, or null.",
  },
  orderEvents: {
    type: "OrderEvent[]",
    description: "Local/example order status history.",
  },
  orderEvent: {
    type: "OrderEvent",
    description: "Most recent local/example order event.",
  },
  orderHistoryPage: {
    type: "Page<OrderEvent>",
    description: "Order history response envelope.",
  },
  addresses: {
    type: "Address[]",
    description:
      "Local preview addresses; example response in component-only previews.",
  },
  address: {
    type: "Address",
    description: "First saved local address, or null.",
  },
  addressesPage: {
    type: "Page<Address>",
    description: "Address list response envelope.",
  },
  me: {
    type: "Me",
    description:
      "Example/local customer profile; dashboard identity is never reused.",
  },
  session: {
    type: "SessionIssued",
    description:
      "Auth response example. token is null: connection credentials are never exposed to source.",
  },
  error: {
    type: "ErrorBody",
    description:
      "SDK catalogue error when live loading fails; otherwise null in live mode, or an example in fixtures.",
  },
  apiError: {
    type: "ApiError",
    description:
      "SDK catalogue error with HTTP status; otherwise null in live mode, or an example in fixtures.",
  },
  statusEvent: {
    type: "StatusEvent",
    description:
      "Local/example stream status payload; live SSE is not connected.",
  },
  driverLocation: {
    type: "DriverLocationEvent",
    description: "Example stream driver location; live SSE is not connected.",
  },
};
/**
 * What every page and component may read without importing it: the
 * language's own names. Anything else, the cart, the store, the menu, is
 * imported (FLUX.md, Data): usingServer or usingClient, from Tenant.x(),
 * Client.x() or Http(...). Nothing is assumed.
 */
export const rootBindingTypes: BindingScope = {
  viewport: ["width", "height"],
  route: ["path", "pattern", "pageId"],
  items: "NavigationItem[]",
  title: "string",
  form: "FormPreview",
  input: "InputEvent",
  // What an action is sent: a value (a component's ActionOption, a field), or
  // a GoogleMap marker that was tapped (id, title, latitude, longitude).
  event: ["value", "id", "title", "latitude", "longitude"],
};

/**
 * The names pages could once read without importing them, and what to
 * import instead: the import's name and entry, how the old name reads now
 * (cartTotal is cart.total_cents; a bare location, cart.set), and whether it
 * reads the chosen store (store.id) or a $param of the page's route. The
 * checker says it (notImported); the migration does it (migrateImports.ts).
 */
export interface FormerBinding {
  name: string;
  entry: string;
  read: string;
  /** How the name alone (no field) reads, when not read. */
  bare?: string;
  /** Tenant.x(store: store.id): the chosen store is imported before it. */
  store?: boolean;
  /** Tenant.x(id: route.productId): the page's route has this $param. */
  route?: string;
  /** Client.x(): a component may import it too. */
  client?: boolean;
}
const clientEntry = (name: string, type: string, resource: string) => `${name}<${type}>(src: Client.${resource}())`;
export const FORMER_BINDINGS: Record<string, FormerBinding> = Object.fromEntries(
  (
    [
      ["cart", "cart", clientEntry("cart", "Cart", "cart"), "cart.lines", undefined, true],
      ["cartTotal", "cart", clientEntry("cart", "Cart", "cart"), "cart.total_cents", undefined, true],
      ["cartCount", "cart", clientEntry("cart", "Cart", "cart"), "cart.count", undefined, true],
      ["store", "store", clientEntry("store", "Store", "store"), "store", undefined, true],
      ["stores", "stores", clientEntry("stores", "StoreSearch", "stores"), "stores.results", undefined, true],
      ["storesLoading", "stores", clientEntry("stores", "StoreSearch", "stores"), "stores.loading", undefined, true],
      ["location", "location", clientEntry("location", "ClientLocation", "location"), "location", "location.set", true],
      ["places", "location", clientEntry("location", "ClientLocation", "location"), "location.places", undefined, true],
      ["cities", "location", clientEntry("location", "ClientLocation", "location"), "location.cities", undefined, true],
      ["locating", "location", clientEntry("location", "ClientLocation", "location"), "location.locating", undefined, true],
      ["locationError", "location", clientEntry("location", "ClientLocation", "location"), "location.error", undefined, true],
      ["checkout", "checkout", clientEntry("checkout", "ClientCheckout", "checkout"), "checkout", undefined, true],
      ["quote", "checkout", clientEntry("checkout", "ClientCheckout", "checkout"), "checkout.quote", undefined, true],
      ["deliveryFeeCents", "checkout", clientEntry("checkout", "ClientCheckout", "checkout"), "checkout.quote.delivery_fee_cents", undefined, true],
      ["signedIn", "session", clientEntry("session", "Session", "session"), "session.signed_in", undefined, true],
      ["signingIn", "session", clientEntry("session", "Session", "session"), "session.signing_in", undefined, true],
      ["authError", "session", clientEntry("session", "Session", "session"), "session.error", undefined, true],
      ["optionGroups", "choices", clientEntry("choices", "ProductChoices", "choices"), "choices.groups", undefined, true],
      ["configuration", "choices", clientEntry("choices", "ProductChoices", "choices"), "choices", undefined, true],
      ["review", "review", clientEntry("review", "OrderReview", "review"), "review", undefined, true],
    ] as const
  ).map(([old, name, entry, read, bare, client]) => [old, { name, entry, read, ...(bare && { bare }), client }]),
);
for (const [old, entry, extra] of [
  ["menu", "menu<Menu>(src: Tenant.menu(store: store.id))", { store: true }],
  ["products", "products<Product[]>(src: Tenant.products(store: store.id))", { store: true }],
  // The menu's categories, each with its products (MenuCategory), as pages read them.
  ["categories", "menu<Menu>(src: Tenant.menu(store: store.id))", { store: true, name: "menu", read: "menu.categories" }],
  ["reviews", "reviews<OrderReview[]>(src: Tenant.reviews(store: store.id))", { store: true }],
  ["deliveryOptions", "deliveryOptions<DeliveryOptions>(src: Tenant.deliveryOptions(store: store.id))", { store: true }],
  ["deliveryPresets", "deliveryOptions<DeliveryOptions>(src: Tenant.deliveryOptions(store: store.id))", { store: true, name: "deliveryOptions", read: "deliveryOptions.presets" }],
  ["orderItems", "order<Order>(src: Tenant.order(id: route.orderId))", { route: "orderId", name: "order", read: "order.items" }],
  ["cuisines", "cuisines<Cuisine[]>(src: Tenant.cuisines())", {}],
  ["orders", "orders<Order[]>(src: Tenant.history())", {}],
  ["addresses", "addresses<Address[]>(src: Tenant.addresses())", {}],
  ["me", "me<Me>(src: Tenant.me())", {}],
  ["product", "product<Product>(src: Tenant.product(id: route.productId))", { route: "productId" }],
  ["order", "order<Order>(src: Tenant.order(id: route.orderId))", { route: "orderId" }],
] as const)
  FORMER_BINDINGS[old] = { name: old, entry, read: old, ...(extra as Partial<FormerBinding>) };

/** What the checker says of a name read but not imported (the Go checker says the same: export-studio-compiler.mjs). */
export function notImportedMessage(name: string, component: boolean): string | undefined {
  const former = FORMER_BINDINGS[name];
  if (!former) return undefined;
  if (component && !former.client) return `${name} isn't imported: a component gets it from the page, as an option.`;
  const reads = former.read !== name ? `, and read it as ${former.read}` : "";
  const store = former.store ? ` (after store<Store>(src: Client.store()))` : "";
  return `${name} isn't imported: add ${former.entry}${store} to usingClient${reads}.`;
}
function nonNull(type: string): string {
  return type.replace(/\s*\|\s*(?:null|undefined)/g, "").trim();
}
export function bindingFields(type: string): Record<string, BindingField> {
  type = nonNull(type);
  const page = /^Page<(.+)>$/.exec(type);
  if (page)
    return Object.fromEntries(
      Object.entries(sdkSchemas.Page.fields).map(([key, field]) => [
        key,
        { ...field, type: field.type.replace(/\bT\b/g, page[1]) },
      ]),
    );
  return schemas[type]?.fields ?? {};
}
export function elementType(type?: string | string[]): string | undefined {
  if (typeof type !== "string") return undefined;
  type = nonNull(type);
  // An external API's answer: its items are as open as it is.
  if (type === "json") return "json";
  return type.endsWith("[]") ? type.slice(0, -2) : undefined;
}
export function referenceType(
  name: string,
  scope: BindingScope,
): string | undefined {
  const [root, ...rest] = name.split(".");
  let fields = rest;
  const entry = scope[root];
  if (!entry) return undefined;
  if (Array.isArray(entry))
    return !fields.length
      ? "unknown"
      : fields.length === 1 && entry.includes(fields[0])
        ? "unknown"
        : undefined;
  let type: string;
  if (typeof entry === "object") {
    // Typed fields: the first one picks its type, the rest go on from there.
    if (!fields.length) return "unknown";
    if (!Object.hasOwn(entry, fields[0])) return undefined;
    type = entry[fields[0]];
    fields = fields.slice(1);
    if (type === "unknown") return fields.length ? undefined : "unknown";
  } else type = entry;
  for (const field of fields) {
    type = nonNull(type);
    // An external API's answer: any field, of any shape.
    if (type === "json") return "json";
    if (type.endsWith("[]") && field === "length") {
      type = "number";
      continue;
    }
    const record = /^Record<string,\s*(.+)>$/.exec(type);
    if (record) {
      type = record[1];
      continue;
    }
    const definition = bindingFields(type)[field];
    if (!definition) return undefined;
    type = definition.type;
  }
  return type;
}
export function expressionType(
  expr: Expr | undefined,
  scope: BindingScope,
): string | undefined {
  if (!expr) return undefined;
  if (expr.type === "ref") return referenceType(expr.name, scope);
  if (expr.type === "index")
    return elementType(expressionType(expr.target, scope));
  if (expr.type === "conditional")
    return expressionType(expr.yes, scope) ?? expressionType(expr.no, scope);
  if (expr.type === "call" && ["take", "search", "filter"].includes(expr.name))
    return expressionType(expr.positional[0], scope);
  if (expr.type === "call" && expr.name === "first")
    return elementType(expressionType(expr.positional[0], scope));
  if (expr.type === "list") {
    const type = expressionType(expr.items[0], scope);
    return type ? type + "[]" : undefined;
  }
  return undefined;
}
// Tolerant ForEach scope scan works while the expression under the cursor is incomplete.
export function bindingScopeAt(source: string, position: number): BindingScope {
  const prefix = source.slice(0, position),
    stack: { name?: string; from: number }[] = [];
  let previous = "";
  for (const match of prefix.matchAll(
    /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*(?:"|$)|[A-Za-z_][A-Za-z0-9_.]*|[^\s]/g,
  )) {
    const token = match[0];
    if (token.startsWith("//") || token.startsWith("/*")) continue;
    if (token === "(" || token === "[")
      stack.push({
        name: token === "(" ? previous : undefined,
        from: match.index! + 1,
      });
    else if (token === ")" || token === "]") stack.pop();
    previous = token;
  }
  // The language's own names, and what the file imports (its usingServer
  // and usingClient): nothing else is in scope (FLUX.md, Data).
  const scope: BindingScope = { ...rootBindingTypes, ...fileImports(source) };
  const names = [];
  for (const match of source.matchAll(
    /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*(?:"|$)|\b(?:BoolState|StringState|NumberState)\s*\(\s*name\s*:\s*"([A-Za-z_][A-Za-z0-9_]*)"/g,
  ))
    if (match[1]) names.push(match[1]);
  scope.state = names;
  scope.options = [
    ...source.matchAll(
      /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*(?:"|$)|\b[A-Za-z]+Option\s*\(\s*name\s*:\s*"([A-Za-z_][A-Za-z0-9_]*)"/g,
    ),
  ].flatMap((match) => (match[1] ? [match[1]] : []));
  for (const frame of stack.filter((frame) => frame.name === "ForEach")) {
    const text = prefix.slice(frame.from);
    const alias = /\bas\s*:\s*"([A-Za-z_][A-Za-z0-9_]*)"/.exec(text)?.[1];
    const index = /\bindexAs\s*:\s*"([A-Za-z_][A-Za-z0-9_]*)"/.exec(text)?.[1];
    const start = /\bitems\s*:\s*/.exec(text);
    if (!alias || !start) continue;
    const from = start.index + start[0].length;
    let depth = 0,
      end = from;
    for (; end < text.length; end++) {
      if ("([".includes(text[end])) depth++;
      if (")]".includes(text[end])) depth--;
      if (text[end] === "," && depth === 0) break;
    }
    const expr = parseSource("Component(value: " + text.slice(from, end) + ")")
      .root?.args.value;
    scope[alias] = elementType(expressionType(expr, scope)) ?? "PreviewProduct";
    if (index) scope[index] = "number";
  }
  return scope;
}
export function bindingCompletions(
  source: string,
  position: number,
  prefix = "",
) {
  const scope = bindingScopeAt(source, position);
  const dot = prefix.lastIndexOf(".");
  if (dot >= 0) {
    const parent = prefix.slice(0, dot),
      type = referenceType(parent, scope);
    if (!type) return [];
    if (Array.isArray(scope[parent]))
      return (scope[parent] as string[]).map((name) => ({
        label: parent + "." + name,
        type: "variable",
        detail:
          parent === "options"
            ? "Component prop"
            : parent === "state"
              ? "Local state"
              : "Value",
        info:
          parent === "options"
            ? "Declared component option or callback"
            : parent === "state"
              ? "Ephemeral preview state"
              : "Available field",
      }));
    if (parent === "form.values" || parent === "form.errors")
      return [
        ...new Set(
          [
            ...source.matchAll(
              /\b(?:name|state)\s*:\s*"([A-Za-z_][A-Za-z0-9_]*)"/g,
            ),
          ].map((match) => match[1]),
        ),
      ].map((name) => ({
        label: parent + "." + name,
        type: "property",
        detail: "Local form field",
        info: "Current value or validation error",
      }));
    return Object.entries(bindingFields(type)).map(([name, field]) => ({
      label: parent + "." + name,
      type: "property",
      detail: field.type + (field.optional ? " (optional)" : ""),
      info: field.description,
    }));
  }
  return Object.entries(scope).flatMap(([root, type]) => [
    {
      label: root,
      type: "variable",
      detail: typeof type === "string" ? type : "Preview binding",
      info: responseBindings[root]?.description ?? "Preview binding",
    },
    ...(typeof type === "string"
      ? Object.entries(bindingFields(type)).map(([name, field]) => ({
          label: root + "." + name,
          type: "property",
          detail: field.type + (field.optional ? " (optional)" : ""),
          info: field.description,
        }))
      : Array.isArray(type)
        ? type.map((name) => ({
            label: root + "." + name,
            type: "property",
            detail: "Preview binding",
            info: "Preview binding",
          }))
        : // Typed fields (a component's DataOptions): each, then its own fields.
          Object.entries(type).flatMap(([name, fieldType]) => [
            { label: root + "." + name, type: "property", detail: fieldType, info: "Option" },
            ...Object.entries(bindingFields(fieldType)).map(([field, definition]) => ({
              label: root + "." + name + "." + field,
              type: "property",
              detail: definition.type + (definition.optional ? " (optional)" : ""),
              info: definition.description,
            })),
          ])),
  ]);
}

export function responseFixture(type: string, seen: string[] = []): unknown {
  type = nonNull(type);
  if (type.endsWith("[]")) {
    const element = elementType(type)!;
    return seen.includes(element) ? [] : [responseFixture(element, seen)];
  }
  if (seen.length > 9 || seen.includes(type)) return null;
  const fields = bindingFields(type);
  if (Object.keys(fields).length)
    return Object.fromEntries(
      Object.entries(fields).map(([name, field]) => {
        let value = responseFixture(field.type, [...seen, type]);
        if (name === "token") value = null;
        else if (name === "next_cursor") value = null;
        else if (/(?:_at|^at)$/.test(name)) value = "2026-01-01T12:00:00Z";
        else if (name === "id") value = "example-" + type.toLowerCase();
        else if (name === "name" || name === "display_name")
          value = "Example " + type;
        else if (name === "email" || name === "customer_email")
          value = "customer@example.test";
        else if (name.includes("phone")) value = "+27 10 555 0100";
        return [name, value];
      }),
    );
  if (sdkAliases[type]) return responseFixture(sdkAliases[type], seen);
  if (type === "number") return 1;
  if (type === "boolean") return true;
  if (type === "string") return "Example";
  if (type.startsWith("Record<string,"))
    return { email: "Enter a valid email address." };
  const literal = /^['"]([^'"]+)['"]/.exec(type);
  return literal ? literal[1] : null;
}

// Preserve only declared response fields. Bounds protect the preview from deep/large payloads.
export function pickResponse(
  type: string,
  input: unknown,
  budget = { nodes: 0 },
  depth = 0,
): unknown {
  if (
    ++budget.nodes > 10000 ||
    depth > 12 ||
    input === null ||
    input === undefined
  )
    return null;
  type = nonNull(type);
  if (type.endsWith("[]"))
    return Array.isArray(input)
      ? input
          .slice(0, 200)
          .map((item) =>
            pickResponse(elementType(type)!, item, budget, depth + 1),
          )
      : [];
  const fields = bindingFields(type);
  if (Object.keys(fields).length) {
    if (typeof input !== "object" || Array.isArray(input)) return null;
    const record = input as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(fields)
        .filter(([name]) => Object.hasOwn(record, name) && name !== "token")
        .map(([name, field]) => [
          name,
          name.endsWith("_url")
            ? publicImageUrl(record[name])
            : pickResponse(field.type, record[name], budget, depth + 1),
        ]),
    );
  }
  if (sdkAliases[type])
    return pickResponse(sdkAliases[type], input, budget, depth);
  if (type === "string" || type.startsWith("'"))
    return typeof input === "string" ? input.slice(0, 8000) : null;
  if (type === "number")
    return typeof input === "number" && Number.isFinite(input) ? input : null;
  if (type === "boolean") return typeof input === "boolean" ? input : null;
  if (type.startsWith("Record<string,"))
    return typeof input === "object" && !Array.isArray(input)
      ? Object.fromEntries(
          Object.entries(input)
            .filter(
              ([key, value]) =>
                !["__proto__", "constructor", "prototype"].includes(key) &&
                typeof value === "string",
            )
            .slice(0, 100),
        )
      : {};
  return null;
}

function publicImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export const sdkResponseReferences: ReferenceEntry[] = Object.entries(
  sdkSchemas,
).map(([name, schema]) => {
  const aliases: Record<string, string> = {
    Product: "product",
    MenuProduct: "product",
    Category: "category",
    Page: "ordersPage",
    DriverLocationEvent: "driverLocation",
    OrderItemAddon: "orderAddon",
  };
  const binding =
    aliases[name] ??
    Object.entries(responseBindings).find(
      ([, entry]) => entry.type === name,
    )?.[0] ??
    name.toLowerCase();
  const field = Object.keys(schema.fields)[0];
  return {
    name,
    group: "SDK responses",
    description:
      "Installed storefront-sdk response shape. " +
      (responseBindings[binding]?.description ??
        "Available through nested response bindings."),
    parameters: Object.fromEntries(
      Object.entries(schema.fields).map(([key, field]) => [
        key,
        field.type +
          (field.optional ? " (optional)" : "") +
          (field.description ? " ? " + field.description : ""),
      ]),
    ),
    required: Object.entries(schema.fields)
      .filter(([, field]) => !field.optional)
      .map(([key]) => key),
    usage:
      name === "Page"
        ? 'ForEach(items: ordersPage.data, as: "o", child: Text(child: o.order_number))'
        : `Text(child: ${binding}.${field} ?? "")`,
  };
});

export interface DataSuggestion {
  /** The expression inserted, e.g. cart.length or formatMoney(cartTotal). */
  insert: string;
  /** What it is, in a few words. */
  detail: string;
}

/**
 * Data to offer while typing text: what matches [word] among the bindings in
 * scope at [position] (including ForEach aliases). A list offers itself and
 * its length (its items' fields come through a ForEach alias: Flux reads no
 * field off an index or a call); a record its fields; an amount in cents is
 * offered formatted too. Typing a whole path ("cart.length") ranks
 * it first.
 */
export function dataSuggestions(source: string, position: number, word: string, limit = 8): DataSuggestion[] {
  const query = word.trim().toLowerCase();
  if (query.length < 2) return [];
  const scope = bindingScopeAt(source, position);
  const money = (name: string, type: string) => type === "number" && /(?:_cents|cents|Total)$/.test(name);
  const candidates: DataSuggestion[] = [];
  const fieldsOf = (path: string, type: string, depth: number) => {
    for (const [name, field] of Object.entries(bindingFields(type))) {
      const fieldType = nonNull(field.type);
      const full = path + "." + name;
      if (money(name, fieldType)) candidates.push({ insert: `formatMoney(${full})`, detail: field.description || "amount" });
      candidates.push({ insert: full, detail: fieldType });
      if (fieldType.endsWith("[]")) candidates.push({ insert: full + ".length", detail: "number of " + name });
      else if (depth < 1 && Object.keys(bindingFields(fieldType)).length) fieldsOf(full, fieldType, depth + 1);
    }
  };
  for (const [root, type] of Object.entries(scope)) {
    if (Array.isArray(type)) {
      for (const name of type) candidates.push({ insert: root + "." + name, detail: root === "state" ? "state" : root === "options" ? "option" : "value" });
      continue;
    }
    if (typeof type === "object") {
      // Typed fields (a component's options): a typed one's own fields too.
      for (const [name, fieldType] of Object.entries(type)) {
        if (fieldType !== "unknown" && Object.keys(bindingFields(fieldType)).length) fieldsOf(root + "." + name, fieldType, 0);
        else candidates.push({ insert: root + "." + name, detail: root === "options" ? "option" : fieldType });
      }
      continue;
    }
    const clean = nonNull(type);
    if (elementType(clean)) {
      candidates.push({ insert: root + ".length", detail: "number of items" });
      candidates.push({ insert: root, detail: clean });
    } else if (Object.keys(bindingFields(clean)).length) fieldsOf(root, clean, 0);
    else {
      if (money(root, clean)) candidates.push({ insert: `formatMoney(${root})`, detail: responseBindings[root]?.description ?? "amount" });
      candidates.push({ insert: root, detail: clean });
    }
  }
  // Words, split at dots and brackets: "first(cart).name" has "cart", "name".
  const words = (text: string) => text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
  const rank = (item: DataSuggestion) => {
    const score = baseRank(item);
    // A whole list reads as nothing in text: its length comes first.
    return score >= 0 && item.detail.endsWith("[]") ? score + 2.5 : score;
  };
  const baseRank = (item: DataSuggestion) => {
    const text = item.insert.toLowerCase();
    const bare = text.replace(/^formatmoney\((.*)\)$/, "$1");
    if (bare === query || text === query) return 0;
    // "cart" is cart.length's root, and only a prefix of cartTotal.
    if (bare.split(".")[0] === query) return 0.5;
    if (bare.startsWith(query)) return 1 + (text !== bare ? 0.5 : 0);
    if (query.includes(".") ? bare.includes(query) : words(text).some((part) => part.startsWith(query))) return 3;
    return -1;
  };
  const seen = new Set<string>();
  return candidates
    .map((item) => ({ item, score: rank(item) }))
    .filter(({ item, score }) => score >= 0 && !seen.has(item.insert) && seen.add(item.insert))
    .sort((a, b) => a.score - b.score || a.item.insert.length - b.item.insert.length)
    .slice(0, limit)
    .map(({ item }) => item);
}

/**
 * Where to put a suggestion in text being typed: inside an open ${…} the
 * expression so far is replaced; otherwise the word at the caret becomes
 * ${…}. Returns the word to match and how to apply a chosen expression.
 */
export function dataWordAt(text: string, caret: number): { word: string; apply: (insert: string) => { text: string; caret: number } } | undefined {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf("${");
  if (open >= 0 && before.indexOf("}", open) < 0) {
    const start = open + 2;
    const close = text.indexOf("}", caret);
    return {
      word: before.slice(start),
      apply: (insert) => {
        const rest = close >= 0 ? text.slice(close) : "}" + text.slice(caret);
        return { text: text.slice(0, start) + insert + rest, caret: start + insert.length + 1 };
      },
    };
  }
  const match = /[A-Za-z_][A-Za-z0-9_.]*$/.exec(before);
  if (!match) return undefined;
  const start = caret - match[0].length;
  return {
    word: match[0],
    apply: (insert) => {
      const piece = "${" + insert + "}";
      return { text: text.slice(0, start) + piece + text.slice(caret), caret: start + piece.length };
    },
  };
}

/** A file's imports by name, with their types (pageData's importScope), read from its tree; none while it doesn't parse. */
function fileImports(source: string): BindingScope {
  const root = parseSource(source).root;
  // While it's being typed it doesn't parse: its block-form imports still say their types.
  if (!root) {
    const typed: Record<string, string> = {};
    for (const match of source.matchAll(/\b([a-z]\w*)<(\w+(?:<\w+>)?)(\[\])?>\(\s*src:/g)) typed[match[1]] = match[2] + (match[3] ?? "");
    return typed;
  }
  const data = root.args.data;
  if (data?.type !== "list") return {};
  const imports: PageDataImport[] = [];
  for (const item of data.items) {
    const from = item.type === "call" ? item.args.from : undefined;
    const name = item.type === "call" ? literalValue(item.args.name) : undefined;
    if (typeof name !== "string" || from?.type !== "call") continue;
    const [family, resource] = from.name.split(".");
    const typeArg = item.type === "call" ? item.args.type : undefined;
    const list = item.type === "call" && literalValue(item.args.list) === true;
    imports.push({
      name,
      source: family === "Client" ? "client" : family === "Tenant" ? "tenant" : "external",
      resource: resource as PageDataImport["resource"],
      ...(typeArg?.type === "ref" && family !== "Client" && { type: typeArg.name + (list ? "[]" : "") }),
    });
  }
  return importScope(imports);
}
