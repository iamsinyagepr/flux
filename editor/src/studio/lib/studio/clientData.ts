// Synced from Upskale Studio (upskaleapp/src/lib/studio/clientData.ts). Edit it there, then npm run sync.
import { literalValue, type CallExpr } from "./parser";
import { CLIENT_RESOURCES, type ClientResource } from "./pageData";

/**
 * What a page or component imports from the client (Client.cart(), …),
 * as the preview reads it: the storefront flow's own state, reshaped into
 * the types CLIENT_RESOURCES names. Read on every draw, so a page shows the
 * cart as it changes. The runtimes do the same: studioClient in Flutter's,
 * client in the website's.
 */

type Json = Record<string, any>;

/** One client resource, from the preview's storefront state (createResponseBindings). */
export function clientValue(resource: ClientResource, state: Json): unknown {
  switch (resource) {
    case "cart": {
      const lines: Json[] = Array.isArray(state.cart) ? state.cart : [];
      return {
        lines,
        count: lines.reduce((count, line) => count + (Number(line.quantity) || 0), 0),
        total_cents:
          typeof state.cartTotal === "number" ? state.cartTotal : lines.reduce((total, line) => total + (Number(line.line_total_cents) || 0), 0),
      };
    }
    case "store":
      return state.store ?? null;
    case "stores":
      return { results: Array.isArray(state.stores) ? state.stores : [], loading: Boolean(state.storesLoading) };
    case "location": {
      const where = state.location;
      return {
        set: Boolean(where),
        label: where?.label ?? "",
        latitude: where?.latitude ?? null,
        longitude: where?.longitude ?? null,
        locating: Boolean(state.locating),
        error: state.locationError ?? null,
        places: Array.isArray(state.places) ? state.places : [],
        cities: Array.isArray(state.cities) ? state.cities : [],
      };
    }
    case "checkout":
      return { ...(state.checkout ?? {}), quote: state.quote ?? null };
    case "session":
      return { signed_in: Boolean(state.signedIn), signing_in: Boolean(state.signingIn), error: state.authError ?? null };
    case "choices":
      return { ...(state.configuration ?? {}), groups: Array.isArray(state.optionGroups) ? state.optionGroups : [] };
    case "review":
      return state.review ?? null;
  }
}

/**
 * A file's client imports by name, from its tree (a page's or a component's
 * usingClient): Data(name: "cart", from: Client.cart()) is cart → "cart".
 */
export function clientImportsOf(root: CallExpr | undefined): Record<string, ClientResource> {
  const out: Record<string, ClientResource> = {};
  const data = root?.args.data;
  if (data?.type !== "list") return out;
  for (const item of data.items) {
    if (item.type !== "call" || item.name !== "Data" || item.args.from?.type !== "call") continue;
    const from = item.args.from.name;
    const name = literalValue(item.args.name);
    const resource = from.startsWith("Client.") ? from.slice(7) : "";
    if (typeof name === "string" && Object.hasOwn(CLIENT_RESOURCES, resource)) out[name] = resource as ClientResource;
  }
  return out;
}

/** A file's client imports with their values, for its scope. */
export function clientBindings(root: CallExpr | undefined, state: Json): Json {
  return Object.fromEntries(Object.entries(clientImportsOf(root)).map(([name, resource]) => [name, clientValue(resource, state)]));
}
