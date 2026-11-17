// Synced from Upskale Studio (upskaleapp/src/lib/studio/previewRoute.ts). Edit it there, then npm run sync.
import type { StudioPage } from "./types";

export interface PreviewRoute {
  pageId: string | null;
  path: string;
  pattern: string;
}

const targets: Record<string, [string, string]> = {
  home: ["menu", "/"],
  menu: ["menu", "/"],
  location: ["location", "/select-location"],
  stores: ["stores", "/select-store"],
  product: ["product", "/product/$productId"],
  cart: ["cart", "/cart"],
  checkout: ["checkout", "/checkout"],
  orders: ["orders", "/orders"],
  tracking: ["tracking", "/orders/$orderId"],
  order: ["tracking", "/orders/$orderId"],
  account: ["account", "/account"],
  addresses: ["addresses", "/addresses"],
  resetPassword: ["reset-password", "/reset-password"],
};

/**
 * The address a page is at in the preview, as a browser shows it: its path
 * with its $params filled in, and the search params a Navigate gave it
 * ("?city" beside the route's params) as ?city=.
 */
export function previewAddress(
  page?: Pick<StudioPage, "id" | "path">,
  params: Record<string, string | undefined> = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (key.startsWith("?") && value) query.set(key.slice(1), value);
  const search = query.toString();
  return previewRoute(page, params).path + (search ? "?" + search : "");
}

export function previewRoute(
  page?: Pick<StudioPage, "id" | "path">,
  params: Record<string, string | undefined> = {},
): PreviewRoute {
  const pattern = page?.path ?? "/";
  return {
    pageId: page?.id ?? null,
    pattern,
    path: pattern.replace(/\$([A-Za-z][A-Za-z0-9_]*)/g, (match, name) =>
      params[name] === undefined ? match : encodeURIComponent(params[name]),
    ),
  };
}

// Component-only previews can inspect a locally selected Navigate target.
export function routeForTarget(target: string): PreviewRoute {
  if (target.startsWith("/"))
    return { pageId: null, path: target, pattern: target };
  const token = target.replace(/^Route\./, "");
  const separator = token.indexOf(":");
  const name = separator < 0 ? token : token.slice(0, separator);
  const definition = Object.hasOwn(targets, name) ? targets[name] : undefined;
  if (!definition) return previewRoute();
  const [id, path] = definition;
  const param = separator < 0 ? undefined : token.slice(separator + 1);
  return previewRoute({ id, path }, { productId: param, orderId: param });
}

export function matchesRoute(route: PreviewRoute, target: unknown): boolean {
  if (typeof target !== "string") return false;
  if (target.startsWith("/"))
    return target === route.path || target === route.pattern;
  if (!target.startsWith("Route.")) return false;
  const token = target.slice(6);
  const separator = token.indexOf(":");
  const name = separator < 0 ? token : token.slice(0, separator);
  if (!Object.hasOwn(targets, name)) return false;
  if (separator >= 0) {
    if (route.pageId !== targets[name][0]) return false;
    const param = route.pattern.match(/\$([A-Za-z][A-Za-z0-9_]*)/)?.[1];
    return (
      !!param &&
      previewRoute(
        { id: route.pageId, path: route.pattern },
        { [param]: token.slice(separator + 1) },
      ).path === route.path
    );
  }
  return (
    targets[name][0] === route.pageId ||
    (route.pageId === null && targets[name][1] === route.pattern)
  );
}

export function resolvePreviewTarget(
  target: string,
  pages: Pick<StudioPage, "id" | "path">[],
): { pageId: string; params: Record<string, string> } | null {
  if (target.startsWith("Route.")) {
    const token = target.slice(6),
      separator = token.indexOf(":");
    const name = separator < 0 ? token : token.slice(0, separator);
    if (!Object.hasOwn(targets, name)) return null;
    const page = pages.find((page) => page.id === targets[name][0]);
    if (!page) return null;
    const params: Record<string, string> = {};
    if (separator >= 0) {
      const parameter = page.path.match(/\$([A-Za-z][A-Za-z0-9_]*)/)?.[1];
      if (!parameter) return null;
      params[parameter] = token.slice(separator + 1);
    }
    return { pageId: page.id, params };
  }
  if (!target.startsWith("/") || /[?#\s]/.test(target)) return null;
  const exact = pages.find((page) => page.path === target);
  if (exact) return { pageId: exact.id, params: {} };
  // Try the most specific pattern first so /offers/special wins over /offers/$id.
  const candidates = [...pages].sort(
    (a, b) =>
      b.path.split("/").filter((part) => !part.startsWith("$")).length -
      a.path.split("/").filter((part) => !part.startsWith("$")).length,
  );
  const input = target.split("/");
  for (const page of candidates) {
    const pattern = page.path.split("/");
    if (pattern.length !== input.length) continue;
    const params: Record<string, string> = {};
    let matches = true;
    for (let index = 0; index < pattern.length; index++) {
      const part = pattern[index];
      if (/^\$[A-Za-z][A-Za-z0-9_]*$/.test(part)) {
        if (!input[index]) {
          matches = false;
          break;
        }
        try {
          params[part.slice(1)] = decodeURIComponent(input[index]);
        } catch {
          matches = false;
          break;
        }
      } else if (part !== input[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return { pageId: page.id, params };
  }
  return null;
}
