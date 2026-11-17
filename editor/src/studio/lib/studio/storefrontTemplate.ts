// Synced from Upskale Studio (upskaleapp/src/lib/studio/storefrontTemplate.ts). Edit it there, then npm run sync.
import type { StudioExample, StudioPage } from "./types";
import { storefrontStarter } from "./catalog";

/**
 * The storefront app: eleven pages, location and store selection, menu,
 * product options, cart, checkout, orders, tracking, account, addresses and
 * password reset. Made by the store kit (catalog.ts's storefrontStarter),
 * from Flux's own widgets: every page imports what it reads (its usingClient
 * and usingServer), and nothing on it is a black box.
 */
export const storefrontTemplate: StudioExample = { ...storefrontStarter, id: "storefront-app" };
const pages = storefrontTemplate.pages!;

export function ensureStorefrontFlow<
  T extends { exampleId: string; pages?: StudioPage[] },
>(project: T): T {
  if (project.exampleId !== "storefront-app" || !project.pages) return project;
  const missing = pages.filter(
    (page) =>
      ["location", "stores"].includes(page.id) &&
      !project.pages!.some((item) => item.id === page.id),
  );
  return missing.length
    ? { ...project, pages: [...structuredClone(missing), ...project.pages] }
    : project;
}
