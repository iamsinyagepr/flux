// Synced from Upskale Studio (upskaleapp/src/lib/studio/storeRoutes.ts). Edit it there, then npm run sync.
import { OLD_STORE_PAGE_PATHS, STORE_PAGE_PATHS } from "./storefrontPageData";
import type { StudioPage } from "./types";

type StorePageId = keyof typeof STORE_PAGE_PATHS;

const SERVER_STORE = "store<Store>(src: Tenant.store(store: route.storeId))";

/**
 * A storefront project's store pages moved to the store in their address
 * (STORE_PAGE_PATHS): the menu, a product, the cart and the checkout, each
 * still at the path the templates gave it before (/, /product/$productId,
 * /cart, /checkout). Each one's source then reads its store on the server,
 * from route.storeId: the store a visitor chose (Client.store()) or the
 * site's (site.store) before. A page someone moved elsewhere, or a project
 * that isn't a storefront (no store list page), is left as it is.
 *
 * Works on sources in the block form (ensurePageFields runs first); a page's
 * settings are read back from its source afterwards.
 */
export function migrateStoreRoutes<T extends { pages?: StudioPage[] }>(project: T): T {
  const pages = project.pages;
  if (!pages?.some((page) => page.id === "stores")) return project;
  let changed = false;
  const next = pages.map((page) => {
    const id = page.id as StorePageId;
    if (!Object.hasOwn(STORE_PAGE_PATHS, id) || page.path !== OLD_STORE_PAGE_PATHS[id]) return page;
    const source = movedSource(page.source, OLD_STORE_PAGE_PATHS[id], STORE_PAGE_PATHS[id]);
    if (source === undefined) return page;
    changed = true;
    return { ...page, path: STORE_PAGE_PATHS[id], source };
  });
  return changed ? { ...project, pages: next } : project;
}

/** A store page's source at its new path, reading its store from it; undefined when it isn't in the form expected. */
export function movedSource(source: string, from: string, to: string): string | undefined {
  const route = `Route(path: ${JSON.stringify(from)})`;
  if (!source.includes(route)) return undefined;
  let next = source.replace(route, `Route(path: ${JSON.stringify(to)})`);
  // The site's store (Tenant.menu(store: site.store)): the address's now.
  next = next.replace(/\bsite\.store\b/g, "route.storeId");
  // The store the visitor chose, read in the browser: the server reads the address's.
  next = next.replace(/^[ \t]*store<Store>\(src: Client\.store\(\)\),?[ \t]*\r?\n/m, "");
  // An import block left empty goes.
  next = next.replace(/\n?usingClient\(\s*\)\n/, "\n");
  // The store on the server, first (what follows can read store.id).
  const existing = /store<Store>\(src: Tenant\.store\(store: [^)]*\)\)/;
  if (existing.test(next)) next = next.replace(existing, SERVER_STORE);
  else if (/^usingServer\(\r?\n/m.test(next)) next = next.replace(/^usingServer\(\r?\n/m, (open) => open + "  " + SERVER_STORE + ",\n");
  else {
    // No server block yet: one right after the Page header (before any
    // usingClient, whose imports may read store.id).
    const close = headerEnd(next);
    if (close === undefined) return undefined;
    next = next.slice(0, close) + "\n\nusingServer(\n  " + SERVER_STORE + ",\n)" + next.slice(close);
  }
  return next;
}

/** Just after the Page(...) header's closing parenthesis (strings skipped). */
function headerEnd(source: string): number | undefined {
  const start = source.indexOf("Page(");
  if (start < 0) return undefined;
  let depth = 0;
  for (let i = start + 4; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      for (i++; i < source.length && source[i] !== '"'; i++) if (source[i] === "\\") i++;
    } else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i + 1;
  }
  return undefined;
}
