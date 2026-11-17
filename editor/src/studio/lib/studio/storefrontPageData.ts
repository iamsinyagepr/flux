// Synced from Upskale Studio (upskaleapp/src/lib/studio/storefrontPageData.ts). Edit it there, then npm run sync.
import type { PageDataImport, PageSeo } from "./pageData";

/**
 * What each storefront template page fetches before it's drawn (its Data
 * settings) and its head from that data (SEO). Every store template shares
 * the same pages, so they share these: the website fetches them on its
 * server (the page and its SEO in the HTML), the Flutter app as each page
 * opens, instead of loading the menu once for the whole app.
 *
 * An imported menu brings its store, categories and online products by the
 * built-ins' names (the runtimes' importedBindings), so the pages read
 * products and categories as before. What belongs to the visitor (cart,
 * checkout, orders, addresses, the stores near them) stays with the
 * storefront in the browser or on the device.
 */
/**
 * Where a store's pages are: the store in the address ($storeId), so each is
 * rendered on the server with its store (its name, its currency) and a
 * reload or a shared link opens the same store. The paths they had before
 * (OLD_STORE_PAGE_PATHS) move here as a project opens (migrateStoreRoutes).
 */
export const STORE_PAGE_PATHS = {
  menu: "/stores/$storeId",
  product: "/stores/$storeId/products/$productId",
  cart: "/stores/$storeId/cart",
  checkout: "/stores/$storeId/checkout",
} as const;

export const OLD_STORE_PAGE_PATHS: Record<keyof typeof STORE_PAGE_PATHS, string> = {
  menu: "/",
  product: "/product/$productId",
  cart: "/cart",
  checkout: "/checkout",
};

/** The store a page's address names, read on the server. */
const routeStore: PageDataImport = {
  name: "store",
  source: "tenant",
  resource: "store",
  params: [{ name: "store", from: "route", value: "storeId" }],
};

export const storefrontPageData: Record<string, { data: PageDataImport[]; seo?: PageSeo }> = {
  // The cities a visitor can pick when their location isn't shared.
  location: {
    data: [{ name: "cities", source: "tenant", resource: "cities", select: "data" }],
  },
  // The menu of the store the address names.
  menu: {
    data: [{ name: "menu", source: "tenant", resource: "menu", params: [{ name: "store", from: "route", value: "storeId" }] }],
    seo: {
      title: "menu.store.name",
      description: "menu.store.description",
      image: "menu.store.banner_url",
      schema: "Restaurant",
      subject: "store",
    },
  },
  // The product the address names, with its options, and the store it's from.
  product: {
    data: [
      { name: "product", source: "tenant", resource: "product", params: [{ name: "id", from: "route", value: "productId" }] },
      routeStore,
    ],
    seo: {
      title: '"${product.name} | ${store.name}"',
      description: "product.description",
      image: "product.image_url",
      schema: "Product",
      subject: "product",
    },
  },
  // The cart and the checkout of the store the address names: its name and
  // its currency on the server's render, not after the browser asks.
  cart: { data: [routeStore] },
  checkout: { data: [routeStore] },
};

/** A storefront page with its Data and SEO settings, when it has any. */
export function withStorefrontData<T extends { id: string }>(page: T): T & { data?: PageDataImport[]; seo?: PageSeo } {
  const settings = storefrontPageData[page.id];
  return settings ? { ...page, data: JSON.parse(JSON.stringify(settings.data)) as PageDataImport[], ...(settings.seo && { seo: { ...settings.seo } }) } : page;
}
