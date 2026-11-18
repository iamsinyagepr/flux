// Lists of a business's data, added to a page from the editor's menu: the
// page's import of the data (from the Upskale provider's Tenant API) and a
// ForEach showing it, inserted together. Each list reads what its type has
// (bindings.json's Product, Category, Order and Store), so it checks as it is.
import { parseSource } from "../studio/lib/studio/parser";
import { readPageFields } from "../studio/lib/studio/pageSource";
import { routeParams } from "../studio/lib/studio/pageData";

export interface DataList {
  id: string;
  label: string;
  /** What it lists, for the menu's hint. */
  hint: string;
  /** The import's name, which the list reads. */
  name: string;
  /** Fetched by the browser: the signed-in customer's own. */
  client: boolean;
  /** The import, given where the page's store comes from. */
  entry(store: string): string;
  /** The list. */
  widget: string;
}

export const DATA_LISTS: DataList[] = [
  {
    id: "products",
    label: "Products",
    hint: "a store's products",
    name: "products",
    client: false,
    entry: (store) => `products<Product[]>(src: Tenant.products(store: ${store}))`,
    widget: `ForEach(items: products, as: "product", child: Row(gap: Space.md, align: Align.center, children: [
  Image(src: product.image_url, alt: product.name, width: 64, height: 64, radius: Radius.md),
  Column(gap: Space.xs, children: [
    Text(child: product.name, weight: FontWeight.semibold),
    Text(child: formatMoney(product.display_price_cents), color: Color.textMuted),
  ]),
]), empty: Text(child: "No products yet."))`,
  },
  {
    id: "categories",
    label: "Categories",
    hint: "a store's categories",
    name: "categories",
    client: false,
    entry: (store) => `categories<Category[]>(src: Tenant.categories(store: ${store}))`,
    widget: `ForEach(items: categories, as: "category", child: Text(child: category.name, weight: FontWeight.semibold), empty: Text(child: "No categories yet."))`,
  },
  {
    id: "orders",
    label: "Orders",
    hint: "the signed-in customer's",
    name: "orders",
    client: true,
    entry: () => `orders<Order[]>(src: Tenant.history())`,
    widget: `ForEach(items: orders, as: "order", child: Row(justify: Justify.between, children: [
  Column(gap: Space.xs, children: [
    Text(child: "Order \${order.order_number}", weight: FontWeight.semibold),
    Text(child: order.store_name, color: Color.textMuted),
  ]),
  Text(child: formatMoney(order.total_cents)),
]), empty: Text(child: "No orders yet."))`,
  },
  {
    id: "stores",
    label: "Stores",
    hint: "the business's stores",
    name: "stores",
    client: false,
    entry: () => `stores<Store[]>(src: Tenant.stores())`,
    widget: `ForEach(items: stores, as: "store", child: Column(gap: Space.xs, children: [
  Text(child: store.name, weight: FontWeight.semibold),
  Text(child: store.city, color: Color.textMuted),
]), empty: Text(child: "No stores yet."))`,
  },
];

/**
 * Where a page's store comes from for a store's data: its address's
 * $storeId when it has one, else the site's store (flux.json's
 * providers.upskale.store).
 */
export function storeFor(source: string): string {
  const root = parseSource(source).root;
  const path = root ? readPageFields(source, root).path ?? "" : "";
  return routeParams(path).includes("storeId") ? "route.storeId" : "site.store";
}

/** Whether a page already imports a name. */
export function imports(source: string, name: string): boolean {
  const root = parseSource(source).root;
  if (!root || root.args.data?.type !== "list") return false;
  return root.args.data.items.some((item) => item.type === "call" && item.args.name?.type === "literal" && item.args.name.value === name);
}
