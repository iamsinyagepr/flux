// Synced from Upskale Studio (upskaleapp/src/lib/studio/catalog.ts). Edit it there, then npm run sync.
import type { StudioExample, StudioPage } from "./types";
import { STORE_PAGE_PATHS, withStorefrontData } from "./storefrontPageData";
import { templateWithImports } from "./migrateImports";
import { storeTemplatePages, type StoreCopy, type StorePageBuild, type StorePageId } from "./storeTemplatePages";
import { kitLayout, kitTemplate, type KitBrand } from "./storeTemplateKit";
import { kitSpecs, voiced, type KitSpec } from "./storeKitTemplates";

/**
 * Upskale's catalogue: whole store templates, which New project and a
 * business's storefront start from (storeTemplateCatalog), and ready-made
 * components (buttons, text, cards, navigation, forms, commerce controls,
 * marketing sections) kept as the compilers' test corpus (componentCorpus):
 * the app doesn't offer them. Every source is ordinary Flux — interactive
 * ones use states and actions — and each one is checked by the language
 * service, the Dart compiler and `flutter analyze` (all of it is part of the
 * Dart corpus), so a template works in the preview and in Flutter.
 */
export type CatalogCategory =
  | "Buttons"
  | "Text"
  | "Cards"
  | "Navigation"
  | "Forms"
  | "Commerce"
  | "Marketing"
  | "Store templates";

/**
 * What a component is for: the storefront's own steps first (the customer's
 * location and store, the menu, a product's options, the cart and so on),
 * then general UI.
 */
export const catalogFeatures = [
  "Location & stores",
  "Menu",
  "Product & options",
  "Cart",
  "Fulfilment",
  "Checkout",
  "Orders",
  "Account",
  "Navigation",
  "Buttons",
  "Text",
  "Cards",
  "Forms",
  "Marketing",
] as const;
export type CatalogFeature = (typeof catalogFeatures)[number];

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  category: CatalogCategory;
  /** Store templates only: on Enterprise storefronts (the business's plan). */
  premium?: boolean;
  tags: string[];
  /** Components only: what it's for (the storefront's steps, then general UI). */
  feature?: CatalogFeature;
  example: StudioExample;
}

interface Part {
  options?: string;
  states?: string;
  build: string;
}

const component = (slug: string, name: string, description: string, part: Part, kind = "section"): StudioExample => ({
  id: "market:" + slug,
  name,
  description,
  type: "component",
  kind: kind as StudioExample["kind"],
  variants: ["default"],
  tags: [],
  source: `Component(
  dsl: 1, id: "market/${slug}", name: ${JSON.stringify(name)}, kind: Kind.${kind},
  description: ${JSON.stringify(description)},${part.options ? `\n  options: [${part.options}],` : ""}${part.states ? `\n  states: [${part.states}],` : ""}
  variants: [Variant(id: "default", label: "Default", build:
    ${part.build}
  )],
)
`,
});

const item = (
  category: CatalogCategory,
  slug: string,
  title: string,
  description: string,
  part: Part,
  tags: string[],
  kind?: string,
): CatalogItem => {
  const example = component(slug, title, description, part, kind);
  return { id: example.id, title, description, category, tags, example: { ...example, tags } };
};

// ---------------------------------------------------------------------------- Buttons
const buttons: CatalogItem[] = [
  item("Buttons", "primary-button", "Primary button", "A full-width call to action.", {
    options: `StringOption(name: "label", label: "Label", maxLength: 32, default: "Order now")`,
    build: `Button(label: options.label, style: ButtonStyle.primary, size: Size.lg, fullWidth: true, onTap: Navigate(to: Route.menu))`,
  }, ["button", "cta"]),
  item("Buttons", "button-set", "Button set", "Primary, secondary and ghost buttons side by side.", {
    build: `Row(gap: Space.sm, children: [
      Button(label: "Continue", style: ButtonStyle.primary, onTap: Navigate(to: Route.checkout)),
      Button(label: "Save for later", style: ButtonStyle.secondary, onTap: ShowMessage(message: "Saved")),
      Button(label: "Cancel", style: ButtonStyle.ghost, onTap: Navigate(to: Route.cart))
    ])`,
  }, ["button", "group"]),
  item("Buttons", "icon-buttons", "Icon buttons", "Round icon buttons for search, favourites and the cart.", {
    build: `Row(gap: Space.sm, children: [
      Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.surface, border: Border(width: 1), onTap: Navigate(to: Route.menu), ariaLabel: "Search", child: Icon(name: Icons.search, size: Size.md)),
      Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.surface, border: Border(width: 1), onTap: ShowMessage(message: "Added to favourites"), ariaLabel: "Favourite", child: Icon(name: Icons.heart, size: Size.md, color: Color.danger)),
      Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.primary, onTap: Navigate(to: Route.cart), ariaLabel: "Cart", child: Icon(name: Icons.cart, size: Size.md, color: Color.primaryInk))
    ])`,
  }, ["button", "icon"]),
  item("Buttons", "quantity-stepper", "Quantity stepper", "Minus and plus buttons around a count that never goes below one.", {
    states: `NumberState(name: "quantity", default: 1)`,
    build: `Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 40, height: 40, alignment: Anchor.center, border: Border(width: 1), onTap: SetState(state: "quantity", value: state.quantity > 1 ? state.quantity - 1 : 1), ariaLabel: "Fewer", child: Icon(name: Icons.minus, size: Size.sm)),
      Text(child: state.quantity, size: FontSize.lg, weight: FontWeight.bold),
      Box(shape: BoxShape.circle, width: 40, height: 40, alignment: Anchor.center, background: Color.primary, onTap: SetState(state: "quantity", value: state.quantity + 1), ariaLabel: "More", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primaryInk))
    ])`,
  }, ["quantity", "stepper", "cart"]),
  item("Buttons", "add-to-cart-quantity", "Add to cart with quantity", "Pick how many, then add this product to the cart in one tap.", {
    states: `NumberState(name: "quantity", default: 1)`,
    build: `Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(radius: Radius.full, border: Border(width: 1), padding: Insets(x: 6, y: 4), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, onTap: SetState(state: "quantity", value: state.quantity > 1 ? state.quantity - 1 : 1), ariaLabel: "Fewer", child: Icon(name: Icons.minus, size: Size.sm)),
        Text(child: state.quantity, weight: FontWeight.bold),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, onTap: SetState(state: "quantity", value: state.quantity + 1), ariaLabel: "More", child: Icon(name: Icons.plus, size: Size.sm))
      ])),
      Expanded(child: Button(label: "Add to cart", fullWidth: true, onTap: AddConfiguredProduct(quantity: state.quantity)))
    ])`,
  }, ["quantity", "cart", "product"]),
  item("Buttons", "fulfilment-toggle", "Fulfilment method", "Delivery or collection, chosen with two large buttons.", {
    states: `StringState(name: "method", default: "delivery")`,
    build: `Column(gap: Space.sm, children: [
      Row(gap: Space.sm, children: [
        Expanded(child: Box(padding: Space.md, radius: Radius.md, alignment: Anchor.center, background: state.method == "delivery" ? Color.primary : Color.surface, border: Border(width: 1, color: state.method == "delivery" ? Color.primary : Color.border), onTap: SetState(state: "method", value: "delivery"), ariaLabel: "Delivery", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.location, color: state.method == "delivery" ? Color.primaryInk : Color.text), Text(child: "Delivery", weight: FontWeight.semibold, color: state.method == "delivery" ? Color.primaryInk : Color.text)]))),
        Expanded(child: Box(padding: Space.md, radius: Radius.md, alignment: Anchor.center, background: state.method == "collection" ? Color.primary : Color.surface, border: Border(width: 1, color: state.method == "collection" ? Color.primary : Color.border), onTap: SetState(state: "method", value: "collection"), ariaLabel: "Collection", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.home, color: state.method == "collection" ? Color.primaryInk : Color.text), Text(child: "Collection", weight: FontWeight.semibold, color: state.method == "collection" ? Color.primaryInk : Color.text)])))
      ]),
      Text(child: state.method == "delivery" ? "We'll bring it to your door in about 35 minutes." : "Ready to collect from the store in about 15 minutes.", size: FontSize.sm, color: Color.textMuted)
    ])`,
  }, ["fulfilment", "delivery", "collection", "checkout"]),
  item("Buttons", "favourite-toggle", "Favourite toggle", "A heart that fills when tapped.", {
    states: `BoolState(name: "liked", default: false)`,
    build: `Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: state.liked ? Color.danger : Color.surface, border: Border(width: 1, color: state.liked ? Color.danger : Color.border), onTap: Toggle(state: "liked"), ariaLabel: "Favourite", child: Icon(name: Icons.heart, color: state.liked ? Color.primaryInk : Color.textMuted))`,
  }, ["favourite", "toggle", "heart"]),
  item("Buttons", "segmented-control", "Segmented control", "Three options where one is always selected.", {
    states: `StringState(name: "choice", default: "small")`,
    build: `Box(padding: Space.xs, radius: Radius.full, background: Color.surfaceAlt, child: Row(gap: Space.xs, children: [
      Expanded(child: Box(padding: Insets(y: 8), radius: Radius.full, alignment: Anchor.center, background: state.choice == "small" ? Color.surface : Color.surfaceAlt, shadow: state.choice == "small" ? Shadow.sm : Shadow.none, onTap: SetState(state: "choice", value: "small"), ariaLabel: "Small", child: Text(child: "Small", weight: FontWeight.semibold))),
      Expanded(child: Box(padding: Insets(y: 8), radius: Radius.full, alignment: Anchor.center, background: state.choice == "regular" ? Color.surface : Color.surfaceAlt, shadow: state.choice == "regular" ? Shadow.sm : Shadow.none, onTap: SetState(state: "choice", value: "regular"), ariaLabel: "Regular", child: Text(child: "Regular", weight: FontWeight.semibold))),
      Expanded(child: Box(padding: Insets(y: 8), radius: Radius.full, alignment: Anchor.center, background: state.choice == "large" ? Color.surface : Color.surfaceAlt, shadow: state.choice == "large" ? Shadow.sm : Shadow.none, onTap: SetState(state: "choice", value: "large"), ariaLabel: "Large", child: Text(child: "Large", weight: FontWeight.semibold)))
    ]))`,
  }, ["segmented", "size", "choice"]),
  item("Buttons", "pill-toggle", "Pill toggle", "An on/off pill, for filters such as vegetarian only.", {
    states: `BoolState(name: "on", default: false)`,
    build: `Box(padding: Insets(x: 14, y: 8), radius: Radius.full, background: state.on ? Color.primary : Color.surface, border: Border(width: 1, color: state.on ? Color.primary : Color.border), onTap: Toggle(state: "on"), ariaLabel: "Vegetarian only", child: Row(gap: Space.xs, mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: state.on ? Icons.check : Icons.plus, size: Size.sm, color: state.on ? Color.primaryInk : Color.text), Text(child: "Vegetarian only", weight: FontWeight.medium, color: state.on ? Color.primaryInk : Color.text)]))`,
  }, ["filter", "toggle", "pill"]),
  item("Buttons", "floating-cart-button", "Floating cart button", "A raised cart button with a count badge.", {
    options: `NumberOption(name: "count", label: "Items", min: 0, max: 99, default: 3)`,
    build: `Stack(width: 64, height: 64, children: [
      Positioned(top: 4, left: 4, child: Box(shape: BoxShape.circle, width: 56, height: 56, alignment: Anchor.center, background: Color.primary, shadow: Shadow.lg, onTap: Navigate(to: Route.cart), ariaLabel: "Open cart", child: Icon(name: Icons.cart, color: Color.primaryInk))),
      Positioned(top: 0, right: 0, child: Box(shape: BoxShape.circle, width: 22, height: 22, alignment: Anchor.center, background: Color.danger, child: Text(child: options.count, size: FontSize.xs, weight: FontWeight.bold, color: Color.primaryInk)))
    ])`,
  }, ["cart", "floating", "badge"]),
];

// ---------------------------------------------------------------------------- Text
const text: CatalogItem[] = [
  item("Text", "section-heading", "Section heading", "An eyebrow, a heading and a short line under it.", {
    options: `StringOption(name: "eyebrow", label: "Eyebrow", maxLength: 24, default: "Fresh today"), StringOption(name: "title", label: "Heading", maxLength: 60, default: "Made by hand, every morning"), StringOption(name: "subtitle", label: "Subtitle", maxLength: 120, default: "Small batches, local flour and nothing you can't pronounce.")`,
    build: `Column(gap: Space.xs, children: [
      Text(child: options.eyebrow, size: FontSize.xs, weight: FontWeight.bold, color: Color.primary, letterSpacing: 1.2),
      Text(child: options.title, role: TextRole.heading, level: 2, size: FontSize.xl, weight: FontWeight.bold, lineHeight: 1.2),
      Text(child: options.subtitle, color: Color.textMuted, lineHeight: 1.5)
    ])`,
  }, ["heading", "title"]),
  item("Text", "price-tag", "Price tag", "A price with the old price struck through and a saving badge.", {
    options: `NumberOption(name: "price", label: "Price (cents)", min: 0, max: 10000000, default: 8900), NumberOption(name: "was", label: "Old price (cents)", min: 0, max: 10000000, default: 11900)`,
    build: `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Text(child: formatMoney(options.price), size: FontSize.xl, weight: FontWeight.bold),
      Text(child: formatMoney(options.was), color: Color.textMuted, decoration: TextDecoration.lineThrough),
      Badge(label: "Save", tone: Tone.success)
    ])`,
  }, ["price", "sale"]),
  item("Text", "status-badges", "Status badges", "Badges for new, popular, spicy and sold out.", {
    build: `Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [Badge(label: "New", tone: Tone.primary), Badge(label: "Popular", tone: Tone.success), Badge(label: "Spicy", tone: Tone.warning), Badge(label: "Sold out", tone: Tone.danger), Badge(label: "Vegan", tone: Tone.neutral)])`,
  }, ["badge", "label"]),
  item("Text", "quote", "Quote", "A customer quote with who said it.", {
    options: `StringOption(name: "quote", label: "Quote", maxLength: 200, default: "The best flat white in town, and they remember my name."), StringOption(name: "author", label: "Author", maxLength: 40, default: "Thandi, regular since 2021")`,
    build: `Box(padding: Insets(left: 16, y: 4), border: Border(width: 1, color: Color.primary), radius: Radius.sm, child: Column(gap: Space.sm, children: [
      Text(child: options.quote, size: FontSize.lg, fontStyle: FontStyle.italic, lineHeight: 1.4),
      Text(child: options.author, size: FontSize.sm, color: Color.textMuted, weight: FontWeight.medium)
    ]))`,
  }, ["quote", "testimonial"]),
  item("Text", "announcement-bar", "Announcement bar", "A slim bar for news, which customers can dismiss.", {
    options: `StringOption(name: "message", label: "Message", maxLength: 80, default: "Free delivery on orders over R250 this weekend")`,
    states: `BoolState(name: "hidden", default: false)`,
    build: `Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [If(condition: !state.hidden, then: Box(padding: Insets(x: 16, y: 10), background: Color.primary, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Expanded(child: Text(child: options.message, size: FontSize.sm, weight: FontWeight.semibold, color: Color.primaryInk, align: TextAlign.center)),
      Box(width: 28, height: 28, alignment: Anchor.center, onTap: Toggle(state: "hidden"), ariaLabel: "Dismiss", child: Icon(name: Icons.close, size: Size.sm, color: Color.primaryInk))
    ])))])`,
  }, ["announcement", "banner", "news"]),
  item("Text", "label-value-list", "Label and value list", "Rows of a label and its value, such as opening hours.", {
    build: `Column(gap: Space.sm, children: [
      Row(children: [Expanded(child: Text(child: "Monday to Friday", color: Color.textMuted)), Text(child: "07:00 – 18:00", weight: FontWeight.semibold)]),
      Divider(),
      Row(children: [Expanded(child: Text(child: "Saturday", color: Color.textMuted)), Text(child: "08:00 – 16:00", weight: FontWeight.semibold)]),
      Divider(),
      Row(children: [Expanded(child: Text(child: "Sunday", color: Color.textMuted)), Text(child: "Closed", weight: FontWeight.semibold, color: Color.danger)])
    ])`,
  }, ["hours", "list", "details"]),
  item("Text", "gradient-headline", "Gradient headline", "A big headline on a soft gradient panel.", {
    options: `StringOption(name: "title", label: "Headline", maxLength: 60, default: "Taste the season")`,
    build: `Box(padding: Space.xl, radius: Radius.lg, gradient: Gradient(from: Color.primary, to: Color.surface, begin: Anchor.topLeft, end: Anchor.bottomRight), child: Text(child: options.title, role: TextRole.heading, level: 1, size: FontSize.display, weight: FontWeight.bold, color: Color.primaryInk, lineHeight: 1.05, shadow: Shadow.sm))`,
  }, ["headline", "hero", "gradient"]),
];

// ---------------------------------------------------------------------------- Cards
const cards: CatalogItem[] = [
  item("Cards", "product-card", "Product card", "A photo, name, price and an add button.", {
    options: `StringOption(name: "name", label: "Name", maxLength: 40, default: "Sourdough loaf"), NumberOption(name: "price", label: "Price (cents)", min: 0, max: 10000000, default: 6500)`,
    build: `Box(radius: Radius.lg, background: Color.surface, border: Border(width: 1), clip: true, shadow: Shadow.sm, child: Column(children: [
      Image(src: null, alt: options.name, aspectRatio: 1.33, fit: Fit.cover),
      Column(padding: Space.md, gap: Space.xs, children: [
        Text(child: options.name, weight: FontWeight.semibold, maxLines: 1, overflow: TextOverflow.ellipsis),
        Row(crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: formatMoney(options.price), weight: FontWeight.bold)), Button(label: "Add", size: Size.sm, onTap: ShowMessage(message: "Added to cart"))])
      ])
    ]))`,
  }, ["product", "card"], "productCard"),
  item("Cards", "product-row", "Product row", "A compact horizontal product with a thumbnail.", {
    options: `StringOption(name: "name", label: "Name", maxLength: 40, default: "Iced latte"), StringOption(name: "detail", label: "Detail", maxLength: 60, default: "Oat milk · 350 ml"), NumberOption(name: "price", label: "Price (cents)", min: 0, max: 10000000, default: 4200)`,
    build: `Box(padding: Space.sm, radius: Radius.md, background: Color.surface, border: Border(width: 1), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Image(src: null, alt: options.name, width: 64, height: 64, radius: Radius.md, fit: Fit.cover),
      Expanded(child: Column(gap: Space.xs, children: [Text(child: options.name, weight: FontWeight.semibold), Text(child: options.detail, size: FontSize.sm, color: Color.textMuted)])),
      Text(child: formatMoney(options.price), weight: FontWeight.bold)
    ]))`,
  }, ["product", "row", "list"], "productCard"),
  item("Cards", "feature-card", "Feature card", "An icon, a title and a sentence about what makes you different.", {
    options: `StringOption(name: "title", label: "Title", maxLength: 40, default: "Delivered warm"), StringOption(name: "body", label: "Text", maxLength: 140, default: "Insulated bags and short routes mean your order arrives the way it left the kitchen.")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.sm, children: [
      Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.surfaceAlt, child: Icon(name: Icons.clock, color: Color.primary)),
      Text(child: options.title, size: FontSize.lg, weight: FontWeight.bold),
      Text(child: options.body, color: Color.textMuted, lineHeight: 1.5)
    ]))`,
  }, ["feature", "benefit"]),
  item("Cards", "stat-card", "Stat card", "A big number with a label, for proof points.", {
    options: `StringOption(name: "value", label: "Number", maxLength: 12, default: "12 000+"), StringOption(name: "label", label: "Label", maxLength: 40, default: "orders delivered")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surfaceAlt, child: Column(gap: Space.xs, align: Align.center, children: [Text(child: options.value, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primary), Text(child: options.label, color: Color.textMuted)]))`,
  }, ["stat", "number", "proof"]),
  item("Cards", "pricing-card", "Pricing card", "A plan with its price, what's included and a button.", {
    options: `StringOption(name: "plan", label: "Plan", maxLength: 24, default: "Coffee club"), NumberOption(name: "price", label: "Price (cents)", min: 0, max: 10000000, default: 29900), StringOption(name: "period", label: "After the price", maxLength: 16, default: " / month"), StringOption(name: "first", label: "First feature", maxLength: 40, default: "One coffee a day"), StringOption(name: "second", label: "Second feature", maxLength: 40, default: "10% off pastries"), StringOption(name: "third", label: "Third feature", maxLength: 40, default: "Skip the queue"), StringOption(name: "action", label: "Button", maxLength: 24, default: "Join the club")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1, color: Color.primary), shadow: Shadow.md, child: Column(gap: Space.md, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: options.plan, size: FontSize.lg, weight: FontWeight.bold)), Badge(label: "Popular", tone: Tone.primary)]),
      Text(child: formatMoney(options.price) + options.period, size: FontSize.xl, weight: FontWeight.bold),
      Column(gap: Space.xs, children: [
        Row(gap: Space.sm, children: [Icon(name: Icons.check, size: Size.sm, color: Color.success), Text(child: options.first)]),
        Row(gap: Space.sm, children: [Icon(name: Icons.check, size: Size.sm, color: Color.success), Text(child: options.second)]),
        Row(gap: Space.sm, children: [Icon(name: Icons.check, size: Size.sm, color: Color.success), Text(child: options.third)])
      ]),
      Button(label: options.action, fullWidth: true, onTap: Navigate(to: Route.menu))
    ]))`,
  }, ["pricing", "plan", "subscription"]),
  item("Cards", "promo-card", "Promo card", "A gradient promotion with a code and a button.", {
    options: `StringOption(name: "title", label: "Title", maxLength: 40, default: "20% off your first order"), StringOption(name: "code", label: "Code", maxLength: 16, default: "HELLO20")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, gradient: Gradient(from: Color.primary, to: Color.surfaceAlt, begin: Anchor.left, end: Anchor.right), shadow: Shadow.md, child: Column(gap: Space.sm, children: [
      Text(child: options.title, size: FontSize.xl, weight: FontWeight.bold, color: Color.primaryInk),
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(padding: Insets(x: 10, y: 6), radius: Radius.sm, background: Color.surface, child: Text(child: options.code, weight: FontWeight.bold, letterSpacing: 1.5)), Text(child: "at checkout", color: Color.primaryInk)]),
      Button(label: "Order now", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu))
    ]))`,
  }, ["promo", "discount", "coupon"]),
  item("Cards", "store-info-card", "Store info card", "Address, hours and a directions button.", {
    options: `StringOption(name: "name", label: "Store", maxLength: 40, default: "Bree Street"), StringOption(name: "address", label: "Address", maxLength: 80, default: "112 Bree St, Cape Town")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.sm, children: [
      Text(child: options.name, size: FontSize.lg, weight: FontWeight.bold),
      Row(gap: Space.sm, children: [Icon(name: Icons.location, size: Size.sm, color: Color.primary), Expanded(child: Text(child: options.address, color: Color.textMuted))]),
      Row(gap: Space.sm, children: [Icon(name: Icons.clock, size: Size.sm, color: Color.primary), Text(child: "Open today until 18:00", color: Color.success, weight: FontWeight.medium)]),
      Button(label: "Choose this store", style: ButtonStyle.secondary, fullWidth: true, onTap: Navigate(to: Route.menu))
    ]))`,
  }, ["store", "location", "hours"], "storeInfo"),
  item("Cards", "order-summary", "Order summary", "Subtotal, delivery, discount and the total.", {
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.sm, children: [
      Text(child: "Order summary", weight: FontWeight.bold),
      Row(children: [Expanded(child: Text(child: "Subtotal", color: Color.textMuted)), Text(child: formatMoney(18500))]),
      Row(children: [Expanded(child: Text(child: "Delivery", color: Color.textMuted)), Text(child: formatMoney(2500))]),
      Row(children: [Expanded(child: Text(child: "Discount", color: Color.textMuted)), Text(child: "– " + formatMoney(3000), color: Color.success)]),
      Divider(),
      Row(children: [Expanded(child: Text(child: "Total", weight: FontWeight.bold)), Text(child: formatMoney(18000), size: FontSize.lg, weight: FontWeight.bold)]),
      Button(label: "Go to checkout", fullWidth: true, onTap: Navigate(to: Route.checkout))
    ]))`,
  }, ["summary", "total", "checkout"]),
  item("Cards", "testimonial-card", "Testimonial card", "Five stars, a review and the customer's name.", {
    options: `StringOption(name: "review", label: "Review", maxLength: 200, default: "Ordered at 7, at my desk by 7:25. Still hot. Unreal."), StringOption(name: "name", label: "Name", maxLength: 40, default: "Sipho M.")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, shadow: Shadow.sm, child: Column(gap: Space.sm, children: [
      Row(gap: Space.xs, children: [Icon(name: Icons.star, size: Size.sm, color: Color.warning), Icon(name: Icons.star, size: Size.sm, color: Color.warning), Icon(name: Icons.star, size: Size.sm, color: Color.warning), Icon(name: Icons.star, size: Size.sm, color: Color.warning), Icon(name: Icons.star, size: Size.sm, color: Color.warning)]),
      Text(child: options.review, lineHeight: 1.5),
      Text(child: options.name, size: FontSize.sm, weight: FontWeight.semibold, color: Color.textMuted)
    ]))`,
  }, ["review", "testimonial", "stars"]),
  item("Cards", "profile-card", "Profile card", "A person's initials, name, role and a contact button.", {
    options: `StringOption(name: "name", label: "Name", maxLength: 40, default: "Lerato Dube"), StringOption(name: "role", label: "Role", maxLength: 40, default: "Head baker")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 52, height: 52, alignment: Anchor.center, background: Color.primary, child: Icon(name: Icons.user, color: Color.primaryInk)),
      Expanded(child: Column(gap: Space.xs, children: [Text(child: options.name, weight: FontWeight.bold), Text(child: options.role, size: FontSize.sm, color: Color.textMuted)])),
      Box(shape: BoxShape.circle, width: 40, height: 40, alignment: Anchor.center, border: Border(width: 1), onTap: ShowMessage(message: "Message sent"), ariaLabel: "Message", child: Icon(name: Icons.email, size: Size.sm))
    ]))`,
  }, ["profile", "team", "person"]),
  item("Cards", "empty-state", "Empty state", "What to show when a list or the cart is empty.", {
    options: `StringOption(name: "title", label: "Title", maxLength: 40, default: "Your cart is empty"), StringOption(name: "body", label: "Text", maxLength: 120, default: "Pick something from the menu and it will show up here.")`,
    build: `Box(padding: Space.xl, radius: Radius.lg, background: Color.surfaceAlt, alignment: Anchor.center, child: Column(gap: Space.sm, align: Align.center, children: [
      Box(shape: BoxShape.circle, width: 64, height: 64, alignment: Anchor.center, background: Color.surface, child: Icon(name: Icons.cart, size: Size.lg, color: Color.textMuted)),
      Text(child: options.title, size: FontSize.lg, weight: FontWeight.bold, align: TextAlign.center),
      Text(child: options.body, color: Color.textMuted, align: TextAlign.center),
      Button(label: "Browse the menu", onTap: Navigate(to: Route.menu))
    ]))`,
  }, ["empty", "placeholder"]),
];

// ---------------------------------------------------------------------------- Navigation
const navigation: CatalogItem[] = [
  item("Navigation", "bottom-tab-bar", "Bottom tab bar", "Home, menu, orders and account, with the current one highlighted.", {
    states: `StringState(name: "tab", default: "home")`,
    build: `Box(padding: Insets(x: 8, y: 6), background: Color.surface, border: Border(width: 1), child: Row(children: [
      Expanded(child: Box(padding: Space.xs, alignment: Anchor.center, onTap: Actions(actions: [SetState(state: "tab", value: "home"), Navigate(to: Route.home)]), ariaLabel: "Home", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.home, color: state.tab == "home" ? Color.primary : Color.textMuted), Text(child: "Home", size: FontSize.xs, color: state.tab == "home" ? Color.primary : Color.textMuted)]))),
      Expanded(child: Box(padding: Space.xs, alignment: Anchor.center, onTap: Actions(actions: [SetState(state: "tab", value: "menu"), Navigate(to: Route.menu)]), ariaLabel: "Menu", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.menu, color: state.tab == "menu" ? Color.primary : Color.textMuted), Text(child: "Menu", size: FontSize.xs, color: state.tab == "menu" ? Color.primary : Color.textMuted)]))),
      Expanded(child: Box(padding: Space.xs, alignment: Anchor.center, onTap: Actions(actions: [SetState(state: "tab", value: "orders"), Navigate(to: Route.orders)]), ariaLabel: "Orders", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.orders, color: state.tab == "orders" ? Color.primary : Color.textMuted), Text(child: "Orders", size: FontSize.xs, color: state.tab == "orders" ? Color.primary : Color.textMuted)]))),
      Expanded(child: Box(padding: Space.xs, alignment: Anchor.center, onTap: Actions(actions: [SetState(state: "tab", value: "account"), Navigate(to: Route.account)]), ariaLabel: "Account", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.user, color: state.tab == "account" ? Color.primary : Color.textMuted), Text(child: "Account", size: FontSize.xs, color: state.tab == "account" ? Color.primary : Color.textMuted)])))
    ]))`,
  }, ["tabs", "bottom bar", "navigation"], "navigation"),
  item("Navigation", "top-app-bar", "Top app bar", "Back, a title and the cart.", {
    options: `StringOption(name: "title", label: "Title", maxLength: 32, default: "Menu")`,
    build: `Box(padding: Insets(x: 12, y: 10), background: Color.surface, border: Border(width: 1), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, onTap: Navigate(to: Route.home), ariaLabel: "Back", child: Icon(name: Icons.chevronLeft)),
      Expanded(child: Text(child: options.title, size: FontSize.lg, weight: FontWeight.bold, align: TextAlign.center)),
      Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, onTap: Navigate(to: Route.cart), ariaLabel: "Cart", child: Icon(name: Icons.cart))
    ]))`,
  }, ["app bar", "header"], "navigation"),
  item("Navigation", "category-chips", "Category chips", "A scrolling row of categories; one is selected.", {
    options: `StringOption(name: "first", label: "First", maxLength: 20, default: "Coffee"), StringOption(name: "second", label: "Second", maxLength: 20, default: "Bakery"), StringOption(name: "third", label: "Third", maxLength: 20, default: "Lunch"), StringOption(name: "fourth", label: "Fourth", maxLength: 20, default: "Drinks")`,
    states: `StringState(name: "category", default: "all")`,
    build: `ScrollView(direction: Axis.horizontal, label: "Categories", child: Row(gap: Space.sm, children: [
      Box(padding: Insets(x: 14, y: 8), radius: Radius.full, background: state.category == "all" ? Color.primary : Color.surface, border: Border(width: 1, color: state.category == "all" ? Color.primary : Color.border), onTap: SetState(state: "category", value: "all"), ariaLabel: "All", child: Text(child: "All", weight: FontWeight.medium, color: state.category == "all" ? Color.primaryInk : Color.text)),
      Box(padding: Insets(x: 14, y: 8), radius: Radius.full, background: state.category == options.first ? Color.primary : Color.surface, border: Border(width: 1, color: state.category == options.first ? Color.primary : Color.border), onTap: SetState(state: "category", value: options.first), ariaLabel: options.first, child: Text(child: options.first, weight: FontWeight.medium, color: state.category == options.first ? Color.primaryInk : Color.text)),
      Box(padding: Insets(x: 14, y: 8), radius: Radius.full, background: state.category == options.second ? Color.primary : Color.surface, border: Border(width: 1, color: state.category == options.second ? Color.primary : Color.border), onTap: SetState(state: "category", value: options.second), ariaLabel: options.second, child: Text(child: options.second, weight: FontWeight.medium, color: state.category == options.second ? Color.primaryInk : Color.text)),
      Box(padding: Insets(x: 14, y: 8), radius: Radius.full, background: state.category == options.third ? Color.primary : Color.surface, border: Border(width: 1, color: state.category == options.third ? Color.primary : Color.border), onTap: SetState(state: "category", value: options.third), ariaLabel: options.third, child: Text(child: options.third, weight: FontWeight.medium, color: state.category == options.third ? Color.primaryInk : Color.text)),
      Box(padding: Insets(x: 14, y: 8), radius: Radius.full, background: state.category == options.fourth ? Color.primary : Color.surface, border: Border(width: 1, color: state.category == options.fourth ? Color.primary : Color.border), onTap: SetState(state: "category", value: options.fourth), ariaLabel: options.fourth, child: Text(child: options.fourth, weight: FontWeight.medium, color: state.category == options.fourth ? Color.primaryInk : Color.text))
    ]))`,
  }, ["categories", "chips", "filter"], "categoryNav"),
  item("Navigation", "side-menu", "Side menu", "A menu button that opens a drawer of links.", {
    build: `Drawer(side: Side.left, trigger: TriggerButton(icon: Icons.menu, ariaLabel: "Open menu", style: ButtonStyle.ghost), child: Column(padding: Space.lg, gap: Space.md, children: [
      Text(child: "Explore", size: FontSize.lg, weight: FontWeight.bold),
      Button(label: "Menu", icon: Icons.menu, style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu)),
      Button(label: "My orders", icon: Icons.orders, style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders)),
      Button(label: "Account", icon: Icons.user, style: ButtonStyle.ghost, onTap: Navigate(to: Route.account)),
      Button(label: "Stores", icon: Icons.location, style: ButtonStyle.ghost, onTap: Navigate(to: Route.stores))
    ]))`,
  }, ["drawer", "menu", "links"], "navigation"),
  item("Navigation", "content-tabs", "Content tabs", "Tabs that switch between menu, reviews and info.", {
    build: `Tabs(tabStyle: TabsStyle.pill, tabs: [
      Tab(label: "Menu", child: Text(child: "Our full menu, updated daily.")),
      Tab(label: "Reviews", child: Text(child: "4.8 stars from 1 200 customers.")),
      Tab(label: "Info", child: Text(child: "Open 07:00 – 18:00, seven days a week."))
    ])`,
  }, ["tabs", "sections"], "navigation"),
  item("Navigation", "breadcrumbs", "Breadcrumbs", "Where the customer is, with the way back.", {
    build: `Row(gap: Space.xs, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Button(label: "Home", style: ButtonStyle.ghost, size: Size.sm, onTap: Navigate(to: Route.home)),
      Icon(name: Icons.chevronRight, size: Size.sm, color: Color.textMuted),
      Button(label: "Menu", style: ButtonStyle.ghost, size: Size.sm, onTap: Navigate(to: Route.menu)),
      Icon(name: Icons.chevronRight, size: Size.sm, color: Color.textMuted),
      Text(child: "Pastries", size: FontSize.sm, color: Color.textMuted)
    ])`,
  }, ["breadcrumbs", "path"], "navigation"),
  item("Navigation", "footer", "Footer", "Links, contact details and the small print.", {
    options: `StringOption(name: "brand", label: "Business", maxLength: 40, default: "Sunday Kitchen")`,
    build: `Box(padding: Space.lg, background: Color.surfaceAlt, child: Column(gap: Space.md, children: [
      Text(child: options.brand, size: FontSize.lg, weight: FontWeight.bold),
      Wrap(spacing: Space.md, runSpacing: Space.sm, children: [
        Button(label: "Menu", style: ButtonStyle.ghost, size: Size.sm, onTap: Navigate(to: Route.menu)),
        Button(label: "Orders", style: ButtonStyle.ghost, size: Size.sm, onTap: Navigate(to: Route.orders)),
        Button(label: "Account", style: ButtonStyle.ghost, size: Size.sm, onTap: Navigate(to: Route.account)),
        Button(label: "Stores", style: ButtonStyle.ghost, size: Size.sm, onTap: Navigate(to: Route.stores))
      ]),
      Divider(),
      Text(child: "© Sunday Kitchen. Prices include VAT.", size: FontSize.xs, color: Color.textMuted)
    ]))`,
  }, ["footer", "links"], "footer"),
];

// ---------------------------------------------------------------------------- Forms
const forms: CatalogItem[] = [
  item("Forms", "newsletter-signup", "Newsletter sign-up", "An email field and a button, with a thank-you message.", {
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surfaceAlt, child: Form(id: "newsletter", onSubmit: ShowMessage(message: "Thanks! Check your inbox."), child: Column(gap: Space.sm, children: [
      Text(child: "Get first dibs on new bakes", size: FontSize.lg, weight: FontWeight.bold),
      TextField(name: "email", label: "Email", type: InputType.email, placeholder: "you@example.com", required: true),
      SubmitButton(label: "Subscribe", fullWidth: true)
    ])))`,
  }, ["newsletter", "email", "signup"]),
  item("Forms", "contact-form", "Contact form", "Name, email and a message.", {
    build: `Form(id: "contact", onSubmit: ShowMessage(message: "Message sent. We'll reply within a day."), child: Column(gap: Space.md, children: [
      TextField(name: "name", label: "Name", required: true),
      TextField(name: "email", label: "Email", type: InputType.email, required: true),
      TextField(name: "message", label: "Message", rows: 4, required: true, maxLength: 500),
      SubmitButton(label: "Send message", fullWidth: true)
    ]))`,
  }, ["contact", "form", "message"]),
  item("Forms", "search-bar", "Search bar", "A rounded search field that remembers what was typed.", {
    states: `StringState(name: "query", default: "")`,
    build: `Column(gap: Space.xs, children: [
      SearchField(state: "query", ariaLabel: "Search the menu", placeholder: "Search the menu", radius: Radius.full, background: Color.surface),
      If(condition: state.query != "", then: Text(child: "Showing results for \${state.query}", size: FontSize.sm, color: Color.textMuted))
    ])`,
  }, ["search", "field"]),
  item("Forms", "promo-code", "Promo code", "A code field with an apply button.", {
    states: `StringState(name: "code", default: "")`,
    build: `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.end, children: [
      Expanded(child: TextField(state: "code", label: "Promo code", placeholder: "HELLO20")),
      Button(label: "Apply", style: ButtonStyle.secondary, onTap: ShowMessage(message: "Code applied"))
    ])`,
  }, ["promo", "coupon", "discount"]),
  item("Forms", "order-notes", "Order notes", "Instructions for the driver and a contact-free option, sent with the order.", {
    states: `StringState(name: "notes", default: ""), BoolState(name: "leaveAtDoor", default: false)`,
    build: `Column(gap: Space.sm, children: [
      TextField(state: "notes", label: "Notes for the driver", placeholder: "Gate code, landmarks", rows: 3, maxLength: 200, onChanged: SetCheckout(field: "delivery_instructions", value: input.value)),
      Checkbox(state: "leaveAtDoor", label: "Leave it at the door", onChanged: SetCheckout(field: "notes", value: input.checked ? "Please leave it at the door." : ""))
    ])`,
  }, ["notes", "delivery", "checkout"]),
  item("Forms", "fulfilment-select", "Order type select", "Delivery, collection or dine-in, from a dropdown.", {
    states: `StringState(name: "orderType", default: "delivery")`,
    build: `SelectField(state: "orderType", label: "Order type", options: [SelectOption(value: "delivery", label: "Delivery"), SelectOption(value: "collection", label: "Collection"), SelectOption(value: "dine-in", label: "Dine in")])`,
  }, ["fulfilment", "select", "order type"]),
];

// ---------------------------------------------------------------------------- Commerce
const commerce: CatalogItem[] = [
  item("Commerce", "tip-selector", "Tip selector", "No tip, 10%, 15% or 20% of the cart, added to the order's total.", {
    build: `Column(gap: Space.sm, children: [
      Text(child: "Add a tip for the team", weight: FontWeight.semibold),
      Row(gap: Space.sm, children: [
        Expanded(child: Box(padding: Insets(y: 10), radius: Radius.md, alignment: Anchor.center, background: checkout.tip_cents == round(cartTotal * 0 / 100) ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetTip(percent: 0), ariaLabel: "No tip", child: Text(child: "None", weight: FontWeight.semibold, color: checkout.tip_cents == round(cartTotal * 0 / 100) ? Color.primaryInk : Color.text))),
        Expanded(child: Box(padding: Insets(y: 10), radius: Radius.md, alignment: Anchor.center, background: checkout.tip_cents == round(cartTotal * 10 / 100) ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetTip(percent: 10), ariaLabel: "Ten percent", child: Text(child: "10%", weight: FontWeight.semibold, color: checkout.tip_cents == round(cartTotal * 10 / 100) ? Color.primaryInk : Color.text))),
        Expanded(child: Box(padding: Insets(y: 10), radius: Radius.md, alignment: Anchor.center, background: checkout.tip_cents == round(cartTotal * 15 / 100) ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetTip(percent: 15), ariaLabel: "Fifteen percent", child: Text(child: "15%", weight: FontWeight.semibold, color: checkout.tip_cents == round(cartTotal * 15 / 100) ? Color.primaryInk : Color.text))),
        Expanded(child: Box(padding: Insets(y: 10), radius: Radius.md, alignment: Anchor.center, background: checkout.tip_cents == round(cartTotal * 20 / 100) ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetTip(percent: 20), ariaLabel: "Twenty percent", child: Text(child: "20%", weight: FontWeight.semibold, color: checkout.tip_cents == round(cartTotal * 20 / 100) ? Color.primaryInk : Color.text)))
      ]),
      Text(child: "Tip: \${formatMoney(checkout.tip_cents)}", size: FontSize.sm, color: Color.textMuted)
    ])`,
  }, ["tip", "checkout", "driver"]),
  item("Commerce", "rating-input", "Star rating", "Tap a star and send it as the order's review, once it is delivered.", {
    states: `NumberState(name: "rating", default: 0)`,
    build: `Column(gap: Space.sm, align: Align.center, children: [
      Text(child: state.rating == 0 ? "How was your order?" : "You rated it \${state.rating} out of 5", weight: FontWeight.semibold),
      Row(gap: Space.sm, mainAxisSize: MainAxisSize.min, children: [
        Box(width: 44, height: 44, alignment: Anchor.center, onTap: SetState(state: "rating", value: 1), ariaLabel: "One star", child: Icon(name: Icons.star, size: Size.lg, color: state.rating >= 1 ? Color.warning : Color.border)),
        Box(width: 44, height: 44, alignment: Anchor.center, onTap: SetState(state: "rating", value: 2), ariaLabel: "Two stars", child: Icon(name: Icons.star, size: Size.lg, color: state.rating >= 2 ? Color.warning : Color.border)),
        Box(width: 44, height: 44, alignment: Anchor.center, onTap: SetState(state: "rating", value: 3), ariaLabel: "Three stars", child: Icon(name: Icons.star, size: Size.lg, color: state.rating >= 3 ? Color.warning : Color.border)),
        Box(width: 44, height: 44, alignment: Anchor.center, onTap: SetState(state: "rating", value: 4), ariaLabel: "Four stars", child: Icon(name: Icons.star, size: Size.lg, color: state.rating >= 4 ? Color.warning : Color.border)),
        Box(width: 44, height: 44, alignment: Anchor.center, onTap: SetState(state: "rating", value: 5), ariaLabel: "Five stars", child: Icon(name: Icons.star, size: Size.lg, color: state.rating >= 5 ? Color.warning : Color.border))
      ]),
      If(condition: review != null, then: Text(child: "Thanks for your review.", color: Color.textMuted), else: Button(label: "Send review", disabled: state.rating == 0, onTap: SubmitReview(foodRating: state.rating)))
    ])`,
  }, ["rating", "review", "stars"]),
  item("Commerce", "time-slots", "Time slot picker", "Choose when to collect or receive the order.", {
    states: `StringState(name: "slot", default: "asap")`,
    build: `Column(gap: Space.sm, children: [
      Text(child: "When?", weight: FontWeight.semibold),
      Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [
        Box(width: 76, alignment: Anchor.center, padding: Insets(y: 8), radius: Radius.md, background: state.slot == "asap" ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetState(state: "slot", value: "asap"), ariaLabel: "As soon as possible", child: Text(child: "ASAP", weight: FontWeight.medium, color: state.slot == "asap" ? Color.primaryInk : Color.text)),
        Box(width: 76, alignment: Anchor.center, padding: Insets(y: 8), radius: Radius.md, background: state.slot == "12:00" ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetState(state: "slot", value: "12:00"), ariaLabel: "12:00", child: Text(child: "12:00", weight: FontWeight.medium, color: state.slot == "12:00" ? Color.primaryInk : Color.text)),
        Box(width: 76, alignment: Anchor.center, padding: Insets(y: 8), radius: Radius.md, background: state.slot == "12:30" ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetState(state: "slot", value: "12:30"), ariaLabel: "12:30", child: Text(child: "12:30", weight: FontWeight.medium, color: state.slot == "12:30" ? Color.primaryInk : Color.text)),
        Box(width: 76, alignment: Anchor.center, padding: Insets(y: 8), radius: Radius.md, background: state.slot == "13:00" ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetState(state: "slot", value: "13:00"), ariaLabel: "13:00", child: Text(child: "13:00", weight: FontWeight.medium, color: state.slot == "13:00" ? Color.primaryInk : Color.text)),
        Box(width: 76, alignment: Anchor.center, padding: Insets(y: 8), radius: Radius.md, background: state.slot == "13:30" ? Color.primary : Color.surface, border: Border(width: 1), onTap: SetState(state: "slot", value: "13:30"), ariaLabel: "13:30", child: Text(child: "13:30", weight: FontWeight.medium, color: state.slot == "13:30" ? Color.primaryInk : Color.text))
      ])
    ])`,
  }, ["time", "slot", "schedule"]),
  item("Commerce", "order-progress", "Order progress", "Received, preparing, on the way, delivered.", {
    options: `NumberOption(name: "step", label: "Current step (1–4)", min: 1, max: 4, default: 2)`,
    build: `Column(gap: Space.sm, children: [
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.check, color: options.step >= 1 ? Color.success : Color.border), Text(child: "Order received", weight: options.step == 1 ? FontWeight.bold : FontWeight.regular)]),
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.clock, color: options.step >= 2 ? Color.success : Color.border), Text(child: "Preparing", weight: options.step == 2 ? FontWeight.bold : FontWeight.regular)]),
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.location, color: options.step >= 3 ? Color.success : Color.border), Text(child: "On the way", weight: options.step == 3 ? FontWeight.bold : FontWeight.regular)]),
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.home, color: options.step >= 4 ? Color.success : Color.border), Text(child: "Delivered", weight: options.step == 4 ? FontWeight.bold : FontWeight.regular)])
    ])`,
  }, ["tracking", "progress", "status"]),
  item("Commerce", "cart-bar", "Cart bar", "A sticky bar with the item count, total and a checkout button.", {
    options: `NumberOption(name: "count", label: "Items", min: 0, max: 99, default: 2), NumberOption(name: "total", label: "Total (cents)", min: 0, max: 10000000, default: 15400)`,
    build: `Box(padding: Insets(x: 16, y: 12), radius: Radius.lg, background: Color.text, shadow: Shadow.lg, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 28, height: 28, alignment: Anchor.center, background: Color.primary, child: Text(child: options.count, size: FontSize.sm, weight: FontWeight.bold, color: Color.primaryInk)),
      Expanded(child: Text(child: "View cart", weight: FontWeight.semibold, color: Color.background)),
      Text(child: formatMoney(options.total), weight: FontWeight.bold, color: Color.background),
      Box(width: 32, height: 32, alignment: Anchor.center, onTap: Navigate(to: Route.cart), ariaLabel: "View cart", child: Icon(name: Icons.chevronRight, color: Color.background))
    ]))`,
  }, ["cart", "checkout", "sticky"]),
  item("Commerce", "size-picker", "Size picker", "Small, medium or large, each with its price.", {
    states: `StringState(name: "size", default: "medium")`,
    build: `Column(gap: Space.sm, children: [
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Text(child: "Size", weight: FontWeight.semibold), Badge(label: "Required", tone: Tone.warning)]),
      Box(padding: Space.md, radius: Radius.md, border: Border(width: state.size == "small" ? 2 : 1, color: state.size == "small" ? Color.primary : Color.border), onTap: SetState(state: "size", value: "small"), ariaLabel: "Small", child: Row(children: [Expanded(child: Text(child: "Small")), Text(child: "Included", color: Color.textMuted)])),
      Box(padding: Space.md, radius: Radius.md, border: Border(width: state.size == "medium" ? 2 : 1, color: state.size == "medium" ? Color.primary : Color.border), onTap: SetState(state: "size", value: "medium"), ariaLabel: "Medium", child: Row(children: [Expanded(child: Text(child: "Medium")), Text(child: "+ " + formatMoney(1000), color: Color.textMuted)])),
      Box(padding: Space.md, radius: Radius.md, border: Border(width: state.size == "large" ? 2 : 1, color: state.size == "large" ? Color.primary : Color.border), onTap: SetState(state: "size", value: "large"), ariaLabel: "Large", child: Row(children: [Expanded(child: Text(child: "Large")), Text(child: "+ " + formatMoney(2000), color: Color.textMuted)]))
    ])`,
  }, ["size", "options", "product"]),
  item("Commerce", "loyalty-card", "Loyalty stamps", "Eight stamps; the ninth coffee is free.", {
    options: `NumberOption(name: "stamps", label: "Stamps collected", min: 0, max: 8, default: 5)`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.md, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: "Coffee card", weight: FontWeight.bold)), Text(child: "\${options.stamps} / 8", color: Color.textMuted)]),
      Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: options.stamps >= 1 ? Color.primary : Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: options.stamps >= 1 ? Color.primaryInk : Color.border)),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: options.stamps >= 2 ? Color.primary : Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: options.stamps >= 2 ? Color.primaryInk : Color.border)),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: options.stamps >= 3 ? Color.primary : Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: options.stamps >= 3 ? Color.primaryInk : Color.border)),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: options.stamps >= 4 ? Color.primary : Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: options.stamps >= 4 ? Color.primaryInk : Color.border)),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: options.stamps >= 5 ? Color.primary : Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: options.stamps >= 5 ? Color.primaryInk : Color.border)),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: options.stamps >= 6 ? Color.primary : Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: options.stamps >= 6 ? Color.primaryInk : Color.border)),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: options.stamps >= 7 ? Color.primary : Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: options.stamps >= 7 ? Color.primaryInk : Color.border)),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: options.stamps >= 8 ? Color.primary : Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: options.stamps >= 8 ? Color.primaryInk : Color.border))
      ]),
      Text(child: options.stamps >= 8 ? "Your next coffee is on us." : "\${8 - options.stamps} more for a free coffee", size: FontSize.sm, color: Color.textMuted)
    ]))`,
  }, ["loyalty", "rewards", "stamps"]),
];

// ---------------------------------------------------------------------------- Marketing
const marketing: CatalogItem[] = [
  item("Marketing", "hero-banner", "Hero banner", "A gradient hero with a headline, a line of copy and two buttons.", {
    options: `StringOption(name: "title", label: "Headline", maxLength: 60, default: "Fresh, fast and made for you"), StringOption(name: "subtitle", label: "Text", maxLength: 140, default: "Order ahead and skip the queue, or have it delivered in under 40 minutes.")`,
    build: `Box(padding: Space.xl, radius: Radius.lg, gradient: Gradient(from: Color.primary, to: Color.surfaceAlt, begin: Anchor.topLeft, end: Anchor.bottomRight), child: Column(gap: Space.md, children: [
      Text(child: options.title, role: TextRole.heading, level: 1, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primaryInk, lineHeight: 1.1),
      Text(child: options.subtitle, color: Color.primaryInk, lineHeight: 1.5),
      Row(gap: Space.sm, children: [Button(label: "Order now", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu)), Button(label: "Find a store", style: ButtonStyle.ghost, onTap: Navigate(to: Route.stores))])
    ]))`,
  }, ["hero", "banner", "landing"], "hero"),
  item("Marketing", "feature-grid", "Feature grid", "Three reasons to order, in a responsive grid.", {
    build: `Grid(cols: Responsive(base: 1, md: 3), gap: Space.md, children: [
      Column(gap: Space.xs, children: [Icon(name: Icons.clock, color: Color.primary), Text(child: "Under 40 minutes", weight: FontWeight.bold), Text(child: "Most orders arrive faster.", color: Color.textMuted)]),
      Column(gap: Space.xs, children: [Icon(name: Icons.heart, color: Color.primary), Text(child: "Made fresh", weight: FontWeight.bold), Text(child: "Cooked when you order.", color: Color.textMuted)]),
      Column(gap: Space.xs, children: [Icon(name: Icons.location, color: Color.primary), Text(child: "Three stores", weight: FontWeight.bold), Text(child: "Collect from the nearest one.", color: Color.textMuted)])
    ])`,
  }, ["features", "grid", "benefits"]),
  item("Marketing", "faq", "FAQ", "Questions that open to show their answers.", {
    states: `BoolState(name: "one", default: true), BoolState(name: "two", default: false), BoolState(name: "three", default: false)`,
    build: `Column(gap: Space.sm, children: [
      Box(padding: Space.md, radius: Radius.md, border: Border(width: 1), onTap: Toggle(state: "one"), ariaLabel: "Do you deliver?", child: Column(gap: Space.sm, children: [Row(children: [Expanded(child: Text(child: "Do you deliver?", weight: FontWeight.semibold)), Icon(name: Icons.chevronDown, size: Size.sm, color: Color.textMuted)]), If(condition: state.one, then: Text(child: "Yes, within 8 km of each store, every day from 08:00.", color: Color.textMuted))])),
      Box(padding: Space.md, radius: Radius.md, border: Border(width: 1), onTap: Toggle(state: "two"), ariaLabel: "Can I order ahead?", child: Column(gap: Space.sm, children: [Row(children: [Expanded(child: Text(child: "Can I order ahead?", weight: FontWeight.semibold)), Icon(name: Icons.chevronDown, size: Size.sm, color: Color.textMuted)]), If(condition: state.two, then: Text(child: "Pick a time slot at checkout, up to seven days ahead.", color: Color.textMuted))])),
      Box(padding: Space.md, radius: Radius.md, border: Border(width: 1), onTap: Toggle(state: "three"), ariaLabel: "Do you cater for allergies?", child: Column(gap: Space.sm, children: [Row(children: [Expanded(child: Text(child: "Do you cater for allergies?", weight: FontWeight.semibold)), Icon(name: Icons.chevronDown, size: Size.sm, color: Color.textMuted)]), If(condition: state.three, then: Text(child: "Every dish lists its allergens. Ask in store about swaps.", color: Color.textMuted))]))
    ])`,
  }, ["faq", "questions", "accordion"]),
  item("Marketing", "cta-strip", "Call-to-action strip", "A strip that asks for one thing.", {
    options: `StringOption(name: "title", label: "Text", maxLength: 60, default: "Hungry? Your usual is one tap away.")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.text, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Expanded(child: Text(child: options.title, size: FontSize.lg, weight: FontWeight.bold, color: Color.background)),
      Button(label: "Reorder", onTap: Navigate(to: Route.orders))
    ]))`,
  }, ["cta", "strip", "reorder"]),
  item("Marketing", "sale-banner", "Sale banner", "A bold limited-time offer with a badge.", {
    options: `StringOption(name: "title", label: "Offer", maxLength: 40, default: "2 for 1 on all pastries"), StringOption(name: "when", label: "When", maxLength: 40, default: "Today only, until 14:00")`,
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.warning, shadow: Shadow.md, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Expanded(child: Column(gap: Space.xs, children: [Badge(label: "Limited time", tone: Tone.danger), Text(child: options.title, size: FontSize.xl, weight: FontWeight.bold), Text(child: options.when, size: FontSize.sm)])),
      Box(rotate: -8, padding: Space.sm, radius: Radius.md, background: Color.surface, child: Text(child: "SALE", weight: FontWeight.bold, letterSpacing: 2, color: Color.danger))
    ]))`,
  }, ["sale", "offer", "banner"]),
  item("Marketing", "app-download", "App download", "Invite customers to order in the app.", {
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surfaceAlt, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(width: 56, height: 56, radius: Radius.md, alignment: Anchor.center, background: Color.primary, child: Icon(name: Icons.star, color: Color.primaryInk)),
      Expanded(child: Column(gap: Space.xs, children: [Text(child: "Order faster in the app", weight: FontWeight.bold), Text(child: "Saved addresses, one-tap reorders and live tracking.", size: FontSize.sm, color: Color.textMuted)])),
      Button(label: "Get it", size: Size.sm, onTap: ShowMessage(message: "Coming soon to your app store"))
    ]))`,
  }, ["app", "download", "promo"]),
];

// ---------------------------------------------------------------------------- Storefront components
/**
 * Components on the storefront SDK's data and widgets: the customer's
 * location and stores, the menu and products, the cart, fulfilment,
 * checkout, orders and the account. Text that mixes in data uses "${…}"
 * (Flutter's + joins only two strings).
 */
const sdk = (
  feature: CatalogFeature,
  slug: string,
  title: string,
  description: string,
  part: Part,
  tags: string[],
  kind?: string,
): CatalogItem => ({
  ...item(feature === "Navigation" ? "Navigation" : "Commerce", slug, title, description, part, tags, kind),
  feature,
});

const productCard = (p: string, button: string) => `Box(radius: Radius.lg, background: Color.surface, border: Border(width: 1), clip: true, child: Column(children: [
        Image(src: ${p}.image_url, alt: ${p}.name, aspectRatio: 1.33, fit: Fit.cover),
        Column(padding: Space.sm, gap: Space.xs, children: [
          Text(child: ${p}.name, weight: FontWeight.semibold, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text(child: formatMoney(${p}.display_price_cents), weight: FontWeight.bold),
          ${button}
        ])
      ]))`;

const storefront: CatalogItem[] = [
  // ---- Location & stores
  sdk("Location & stores", "store-directory", "Store directory", "Every store near the customer with its city and whether it's open.", {
    build: `Column(gap: Space.sm, children: [
      ForEach(items: stores, as: "s", empty: Text(child: "No stores near you yet.", color: Color.textMuted), child: Box(padding: Space.md, radius: Radius.md, background: Color.surface, border: Border(width: 1), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Box(shape: BoxShape.circle, width: 40, height: 40, alignment: Anchor.center, background: Color.surfaceAlt, child: Icon(name: Icons.location, color: Color.primary)),
        Expanded(child: Column(gap: Space.xs, children: [Text(child: s.name, weight: FontWeight.semibold), Text(child: s.city, size: FontSize.sm, color: Color.textMuted)])),
        If(condition: s.is_open, then: Badge(label: "Open", tone: Tone.success), else: Badge(label: "Closed", tone: Tone.neutral))
      ])))
    ])`,
  }, ["stores", "directory", "list"], "storeInfo"),
  sdk("Location & stores", "store-hero", "Store hero", "The chosen store's banner, name and description.", {
    build: `Column(gap: Space.sm, children: [
      Image(src: store.banner_url, alt: store.name, aspectRatio: 2.4, fit: Fit.cover, radius: Radius.lg),
      Text(child: store.name, size: FontSize.xxl, weight: FontWeight.bold),
      If(condition: store.description, then: Text(child: store.description, color: Color.textMuted, lineHeight: 1.5))
    ])`,
  }, ["store", "hero", "banner"], "hero"),
  sdk("Location & stores", "store-open-badge", "Open or closed badge", "Whether the chosen store is taking orders now.", {
    build: `If(condition: store.is_open, then: Badge(label: "Open now", tone: Tone.success), else: Badge(label: "Closed", tone: Tone.danger))`,
  }, ["store", "open", "badge"]),
  sdk("Location & stores", "store-contact", "Store contact", "The store's address, phone and email.", {
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.sm, children: [
      Text(child: store.name, weight: FontWeight.bold),
      Row(gap: Space.sm, children: [Icon(name: Icons.location, size: Size.sm, color: Color.primary), Expanded(child: Text(child: "\${store.address_line1}, \${store.city}", color: Color.textMuted))]),
      If(condition: store.phone, then: Row(gap: Space.sm, children: [Icon(name: Icons.user, size: Size.sm, color: Color.primary), Text(child: store.phone)])),
      If(condition: store.email, then: Row(gap: Space.sm, children: [Icon(name: Icons.email, size: Size.sm, color: Color.primary), Text(child: store.email)]))
    ]))`,
  }, ["store", "contact", "address"], "storeInfo"),
  sdk("Location & stores", "store-brand-bar", "Store brand bar", "The store's logo and name in a slim bar.", {
    build: `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Image(src: store.logo_url, alt: store.name, width: 36, height: 36, radius: Radius.full, fit: Fit.cover, fallback: ImageFallback.initials),
      Expanded(child: Text(child: store.name, weight: FontWeight.bold)),
      If(condition: store.is_open, then: Badge(label: "Open", tone: Tone.success))
    ])`,
  }, ["store", "logo", "header"], "navigation"),

  // ---- Menu
  sdk("Menu", "category-list", "Category list", "Every menu category with its description.", {
    build: `Column(gap: Space.sm, children: [ForEach(items: categories, as: "c", child: Box(padding: Space.md, radius: Radius.md, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.xs, children: [Text(child: c.name, weight: FontWeight.semibold), If(condition: c.description, then: Text(child: c.description, size: FontSize.sm, color: Color.textMuted))])))])`,
  }, ["categories", "list"], "categoryNav"),
  sdk("Menu", "category-sections", "Menu by category", "Each category as a heading with its products under it.", {
    build: `Column(gap: Space.lg, children: [ForEach(items: categories, as: "c", child: Column(gap: Space.sm, children: [
      Text(child: c.name, size: FontSize.lg, weight: FontWeight.bold),
      ForEach(items: c.products, as: "p", child: Box(padding: Space.sm, radius: Radius.md, onTap: OpenProduct(product: p), ariaLabel: p.name, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(child: Column(gap: Space.xs, children: [Text(child: p.name, weight: FontWeight.medium), If(condition: p.description, then: Text(child: p.description, size: FontSize.sm, color: Color.textMuted, maxLines: 2, overflow: TextOverflow.ellipsis))])),
        Text(child: formatMoney(p.display_price_cents), weight: FontWeight.bold)
      ])))
    ]))])`,
  }, ["menu", "categories", "sections"], "productCollection"),
  sdk("Menu", "product-grid", "Product grid", "Every product as a card with an add button.", {
    build: `Grid(cols: Responsive(base: 2, md: 3), gap: Space.md, children: [ForEach(items: products, as: "p", child: ${productCard("p", `Button(label: "Add", size: Size.sm, fullWidth: true, onTap: AddToCart(product: p, quantity: 1))`)})])`,
  }, ["products", "grid", "add to cart"], "productCollection"),
  sdk("Menu", "product-rows", "Product rows", "Products in a list with a thumbnail; tap to see options.", {
    build: `Column(gap: Space.sm, children: [ForEach(items: products, as: "p", child: Box(padding: Space.sm, radius: Radius.md, background: Color.surface, border: Border(width: 1), onTap: OpenProduct(product: p), ariaLabel: p.name, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Image(src: p.image_url, alt: p.name, width: 64, height: 64, radius: Radius.md, fit: Fit.cover),
      Expanded(child: Column(gap: Space.xs, children: [Text(child: p.name, weight: FontWeight.semibold), Text(child: formatMoney(p.display_price_cents), color: Color.textMuted)])),
      Icon(name: Icons.chevronRight, color: Color.textMuted)
    ])))])`,
  }, ["products", "list"], "productCollection"),
  sdk("Menu", "featured-products", "Featured products", "Only the products the business has marked as featured.", {
    build: `Column(gap: Space.sm, children: [
      Text(child: "Featured", size: FontSize.lg, weight: FontWeight.bold),
      Grid(cols: 2, gap: Space.md, children: [ForEach(items: products, as: "p", child: If(condition: p.is_featured, then: ${productCard("p", `Button(label: "Add", size: Size.sm, fullWidth: true, onTap: AddToCart(product: p, quantity: 1))`)}))])
    ])`,
  }, ["featured", "products"], "productCollection"),
  sdk("Menu", "product-carousel", "Product carousel", "Swipe through the first eight products.", {
    build: `Carousel(itemWidth: 180, gap: Space.md, showArrows: true, children: [ForEach(items: products, as: "p", limit: 8, child: ${productCard("p", `Button(label: "View", size: Size.sm, style: ButtonStyle.secondary, fullWidth: true, onTap: OpenProduct(product: p))`)})])`,
  }, ["products", "carousel"], "productCollection"),
  sdk("Menu", "sale-products", "On sale", "Products priced below their usual price, with the saving shown.", {
    build: `Column(gap: Space.sm, children: [ForEach(items: products, as: "p", child: If(condition: p.compare_at_price_cents > p.display_price_cents, then: Box(padding: Space.md, radius: Radius.md, background: Color.surface, border: Border(width: 1), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Expanded(child: Text(child: p.name, weight: FontWeight.semibold)),
      Text(child: formatMoney(p.compare_at_price_cents), color: Color.textMuted, decoration: TextDecoration.lineThrough),
      Text(child: formatMoney(p.display_price_cents), weight: FontWeight.bold, color: Color.danger)
    ]))))])`,
  }, ["sale", "discount", "products"], "productCollection"),
  sdk("Menu", "unavailable-aware-list", "Availability list", "Products with a sold-out label on the ones that are unavailable.", {
    build: `Column(gap: Space.sm, children: [ForEach(items: products, as: "p", child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Expanded(child: Text(child: p.name, color: p.is_available ? Color.text : Color.textMuted)),
      If(condition: p.is_available, then: Text(child: formatMoney(p.display_price_cents), weight: FontWeight.semibold), else: Badge(label: "Sold out", tone: Tone.danger))
    ]))])`,
  }, ["availability", "sold out"], "productCollection"),

  // ---- Product
  sdk("Product & options", "product-hero", "Product hero", "The open product's photo, name, description and price.", {
    build: `Column(gap: Space.sm, children: [
      Image(src: product.image_url, alt: product.name, aspectRatio: 1.33, fit: Fit.cover, radius: Radius.lg),
      Text(child: product.name, size: FontSize.xl, weight: FontWeight.bold),
      If(condition: product.description, then: Text(child: product.description, color: Color.textMuted, lineHeight: 1.5)),
      Text(child: formatMoney(product.display_price_cents), size: FontSize.lg, weight: FontWeight.bold, color: Color.primary)
    ])`,
  }, ["product", "hero"], "productCard"),
  sdk("Product & options", "product-facts", "Product facts", "Calories and preparation time as small chips.", {
    build: `Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [
      If(condition: product.calories, then: Box(padding: Insets(x: 10, y: 6), radius: Radius.full, background: Color.surfaceAlt, child: Text(child: "\${product.calories} kcal", size: FontSize.sm))),
      If(condition: product.prep_time_minutes, then: Box(padding: Insets(x: 10, y: 6), radius: Radius.full, background: Color.surfaceAlt, child: Text(child: "\${product.prep_time_minutes} min", size: FontSize.sm)))
    ])`,
  }, ["calories", "prep time"]),
  sdk("Product & options", "product-tags", "Product tags", "The product's tags as badges.", {
    build: `Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [ForEach(items: product.tags, as: "t", child: Badge(label: t, tone: Tone.neutral))])`,
  }, ["tags", "badges"]),
  sdk("Product & options", "product-price-compare", "Price with saving", "The product's price, its usual price struck through when it's on sale.", {
    build: `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Text(child: formatMoney(product.display_price_cents), size: FontSize.xl, weight: FontWeight.bold),
      If(condition: product.compare_at_price_cents > product.display_price_cents, then: Text(child: formatMoney(product.compare_at_price_cents), color: Color.textMuted, decoration: TextDecoration.lineThrough)),
      If(condition: product.compare_at_price_cents > product.display_price_cents, then: Badge(label: "Sale", tone: Tone.danger))
    ])`,
  }, ["price", "sale"]),
  sdk("Product & options", "add-product-bar", "Add to cart bar", "A full-width add button for the open product, with a quantity.", {
    states: `NumberState(name: "quantity", default: 1)`,
    build: `Box(padding: Space.md, background: Color.surface, border: Border(width: 1), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, border: Border(width: 1), onTap: SetState(state: "quantity", value: state.quantity > 1 ? state.quantity - 1 : 1), ariaLabel: "Fewer", child: Icon(name: Icons.minus, size: Size.sm)),
      Text(child: state.quantity, weight: FontWeight.bold),
      Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, border: Border(width: 1), onTap: SetState(state: "quantity", value: state.quantity + 1), ariaLabel: "More", child: Icon(name: Icons.plus, size: Size.sm)),
      Expanded(child: Button(label: "Add \${state.quantity} to cart", fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity)))
    ]))`,
  }, ["add to cart", "quantity"]),

  // ---- Cart
  sdk("Cart", "cart-icon-badge", "Cart icon with count", "A cart button showing how many items are in it.", {
    build: `Stack(width: 48, height: 48, children: [
      Positioned(top: 4, left: 4, child: Box(shape: BoxShape.circle, width: 40, height: 40, alignment: Anchor.center, background: Color.surface, border: Border(width: 1), onTap: Navigate(to: Route.cart), ariaLabel: "Cart", child: Icon(name: Icons.cart))),
      Positioned(top: 0, right: 0, child: If(condition: cartCount > 0, then: Box(shape: BoxShape.circle, width: 20, height: 20, alignment: Anchor.center, background: Color.primary, child: Text(child: cartCount, size: FontSize.xs, weight: FontWeight.bold, color: Color.primaryInk))))
    ])`,
  }, ["cart", "badge", "count"]),
  sdk("Cart", "live-cart-bar", "Live cart bar", "Appears once something is in the cart: count, total and a way in.", {
    build: `If(condition: cartCount > 0, then: Box(padding: Insets(x: 16, y: 12), radius: Radius.lg, background: Color.primary, shadow: Shadow.lg, onTap: Navigate(to: Route.cart), ariaLabel: "View cart", child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 26, height: 26, alignment: Anchor.center, background: Color.primaryInk, child: Text(child: cartCount, size: FontSize.sm, weight: FontWeight.bold, color: Color.primary)),
      Expanded(child: Text(child: "View cart", weight: FontWeight.semibold, color: Color.primaryInk)),
      Text(child: formatMoney(cartTotal), weight: FontWeight.bold, color: Color.primaryInk)
    ])))`,
  }, ["cart", "sticky", "total"]),
  sdk("Cart", "cart-total-line", "Cart total", "The cart's item count and total in one line.", {
    build: `Row(crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: "\${cartCount} items", color: Color.textMuted)), Text(child: formatMoney(cartTotal), size: FontSize.lg, weight: FontWeight.bold)])`,
  }, ["cart", "total"]),
  sdk("Cart", "empty-cart", "Empty cart", "Shown only while the cart is empty, with a way back to the menu.", {
    build: `If(condition: cartCount == 0, then: Box(padding: Space.xl, radius: Radius.lg, background: Color.surfaceAlt, child: Column(gap: Space.sm, align: Align.center, children: [
      Icon(name: Icons.cart, size: Size.lg, color: Color.textMuted),
      Text(child: "Your cart is empty", size: FontSize.lg, weight: FontWeight.bold),
      Button(label: "Browse the menu", onTap: Navigate(to: Route.menu))
    ])))`,
  }, ["cart", "empty"]),
  sdk("Cart", "checkout-button", "Checkout button", "Goes to checkout; disabled while the cart is empty.", {
    build: `Button(label: cartCount > 0 ? "Checkout · \${formatMoney(cartTotal)}" : "Your cart is empty", fullWidth: true, size: Size.lg, disabled: cartCount == 0, onTap: Navigate(to: Route.checkout))`,
  }, ["checkout", "button"]),

  // ---- Fulfilment
  sdk("Fulfilment", "fulfilment-badges", "Delivery and collection badges", "Which of delivery and collection the chosen store offers.", {
    build: `Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [
      If(condition: store.accepts_delivery, then: Badge(label: "Delivery", tone: Tone.success)),
      If(condition: store.accepts_collect, then: Badge(label: "Collection", tone: Tone.primary))
    ])`,
  }, ["delivery", "collection", "badges"]),
  sdk("Fulfilment", "delivery-terms", "Delivery terms", "The store's delivery fee, minimum order and delivery radius.", {
    build: `Row(gap: Space.sm, children: [
      Expanded(child: Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, child: Column(gap: Space.xs, children: [Text(child: "Delivery", size: FontSize.xs, color: Color.textMuted), Text(child: formatMoney(store.delivery_fee_cents), weight: FontWeight.bold)]))),
      Expanded(child: Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, child: Column(gap: Space.xs, children: [Text(child: "Minimum", size: FontSize.xs, color: Color.textMuted), Text(child: formatMoney(store.min_order_cents), weight: FontWeight.bold)]))),
      Expanded(child: Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, child: Column(gap: Space.xs, children: [Text(child: "Radius", size: FontSize.xs, color: Color.textMuted), Text(child: "\${store.delivery_radius_km} km", weight: FontWeight.bold)])))
    ])`,
  }, ["delivery", "fee", "minimum"]),
  sdk("Fulfilment", "minimum-order-notice", "Minimum order notice", "How much more to add before the store's minimum order is met.", {
    build: `If(condition: cartTotal < store.min_order_cents, then: Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, border: Border(width: 1, color: Color.warning), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Icon(name: Icons.cart, size: Size.sm, color: Color.warning),
      Expanded(child: Text(child: "Add \${formatMoney(store.min_order_cents - cartTotal)} more to reach the \${formatMoney(store.min_order_cents)} minimum.", size: FontSize.sm))
    ])))`,
  }, ["minimum", "cart", "delivery"]),
  sdk("Fulfilment", "delivery-pricing", "Delivery pricing", "How the store prices delivery: a base fee plus per kilometre.", {
    build: `Box(padding: Space.md, radius: Radius.md, border: Border(width: 1), child: Column(gap: Space.xs, children: [
      Text(child: "Delivery pricing", weight: FontWeight.semibold),
      Text(child: "\${formatMoney(store.delivery_base_fee_cents)} plus \${formatMoney(store.delivery_per_km_cents)} per km", color: Color.textMuted),
      Text(child: "Between \${formatMoney(store.delivery_min_fee_cents)} and \${formatMoney(store.delivery_max_fee_cents)}", size: FontSize.sm, color: Color.textMuted)
    ]))`,
  }, ["delivery", "pricing", "fee"]),
  sdk("Fulfilment", "collection-info", "Collection info", "Where to collect, shown only when the store offers collection.", {
    build: `If(condition: store.accepts_collect, then: Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Icon(name: Icons.home, color: Color.primary),
      Expanded(child: Column(gap: Space.xs, children: [Text(child: "Collect it yourself", weight: FontWeight.semibold), Text(child: "\${store.address_line1}, \${store.city}", size: FontSize.sm, color: Color.textMuted)]))
    ])))`,
  }, ["collection", "pickup", "address"]),
  sdk("Fulfilment", "prep-time", "Preparation time", "How long the store takes to prepare an order, when it says.", {
    build: `If(condition: store.prep_time_minutes, then: Row(gap: Space.xs, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.clock, size: Size.sm, color: Color.primary), Text(child: "Ready in about \${store.prep_time_minutes} minutes", size: FontSize.sm)]))`,
  }, ["prep time", "eta"]),

  // ---- Checkout
  sdk("Checkout", "live-order-summary", "Order summary", "The cart's subtotal, the store's delivery fee and the total.", {
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.sm, children: [
      Text(child: "Order summary", weight: FontWeight.bold),
      Row(children: [Expanded(child: Text(child: "Items (\${cartCount})", color: Color.textMuted)), Text(child: formatMoney(cartTotal))]),
      If(condition: store.accepts_delivery, then: Row(children: [Expanded(child: Text(child: "Delivery", color: Color.textMuted)), Text(child: formatMoney(store.delivery_fee_cents))])),
      Divider(),
      Row(children: [Expanded(child: Text(child: "Total", weight: FontWeight.bold)), Text(child: formatMoney(cartTotal + store.delivery_fee_cents), size: FontSize.lg, weight: FontWeight.bold)]),
      Text(child: "The final total is confirmed when you place the order.", size: FontSize.xs, color: Color.textMuted)
    ]))`,
  }, ["summary", "total", "checkout"]),
  sdk("Checkout", "payment-methods", "Payment methods", "How the chosen store takes payment: card, cash or transfer.", {
    build: `Column(gap: Space.xs, children: [
      Text(child: "We accept", size: FontSize.sm, weight: FontWeight.semibold),
      Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [
        If(condition: store.accepts_card, then: Badge(label: "Card", tone: Tone.neutral)),
        If(condition: store.accepts_cash, then: Badge(label: "Cash", tone: Tone.neutral)),
        If(condition: store.accepts_transfer, then: Badge(label: "EFT", tone: Tone.neutral))
      ])
    ])`,
  }, ["payment", "card", "cash"]),

  // ---- Orders
  sdk("Orders", "recent-orders", "Recent orders", "The last three orders with their status and total; tap to track.", {
    build: `Column(gap: Space.sm, children: [
      Text(child: "Recent orders", size: FontSize.lg, weight: FontWeight.bold),
      ForEach(items: orders, as: "o", limit: 3, empty: Text(child: "No orders yet.", color: Color.textMuted), child: Box(padding: Space.md, radius: Radius.md, background: Color.surface, border: Border(width: 1), onTap: Navigate(to: Route.order(id: o.id)), ariaLabel: "Order \${o.order_number}", child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(child: Column(gap: Space.xs, children: [Text(child: "Order \${o.order_number}", weight: FontWeight.semibold), Text(child: o.store_name, size: FontSize.sm, color: Color.textMuted)])),
        Badge(label: o.status, tone: Tone.primary),
        Text(child: formatMoney(o.total_cents), weight: FontWeight.bold)
      ])))
    ])`,
  }, ["orders", "recent", "reorder"]),
  sdk("Orders", "driver-card", "Driver card", "The driver's name and number, once a driver is assigned.", {
    build: `If(condition: order.driver_name, then: Box(padding: Space.md, radius: Radius.md, background: Color.surface, border: Border(width: 1), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.primary, child: Icon(name: Icons.user, color: Color.primaryInk)),
      Expanded(child: Column(gap: Space.xs, children: [Text(child: order.driver_name, weight: FontWeight.semibold), Text(child: "Your driver", size: FontSize.sm, color: Color.textMuted)])),
      If(condition: order.driver_phone, then: Text(child: order.driver_phone, weight: FontWeight.medium))
    ])))`,
  }, ["driver", "delivery", "tracking"]),
  sdk("Orders", "order-receipt", "Order receipt", "The open order's number, fulfilment and totals.", {
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.sm, children: [
      Row(children: [Expanded(child: Text(child: "Order \${order.order_number}", weight: FontWeight.bold)), Badge(label: order.status, tone: Tone.primary)]),
      Text(child: order.fulfilment_type == "delivery" ? "Delivery to \${order.delivery_address_line1}" : "Collection from \${order.store_name}", color: Color.textMuted),
      Divider(),
      Row(children: [Expanded(child: Text(child: "Subtotal", color: Color.textMuted)), Text(child: formatMoney(order.subtotal_cents))]),
      Row(children: [Expanded(child: Text(child: "Delivery", color: Color.textMuted)), Text(child: formatMoney(order.delivery_fee_cents))]),
      Row(children: [Expanded(child: Text(child: "Total", weight: FontWeight.bold)), Text(child: formatMoney(order.total_cents), weight: FontWeight.bold)])
    ]))`,
  }, ["receipt", "order", "totals"]),

  // ---- Account
  sdk("Account", "account-menu", "Account menu", "Links to orders, addresses and password, and signing out.", {
    build: `Box(radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(children: [
      Box(padding: Space.md, onTap: Navigate(to: Route.orders), ariaLabel: "My orders", child: Row(gap: Space.md, children: [Icon(name: Icons.orders, color: Color.primary), Expanded(child: Text(child: "My orders")), Icon(name: Icons.chevronRight, color: Color.textMuted)])),
      Divider(),
      Box(padding: Space.md, onTap: Navigate(to: Route.addresses), ariaLabel: "Saved addresses", child: Row(gap: Space.md, children: [Icon(name: Icons.location, color: Color.primary), Expanded(child: Text(child: "Saved addresses")), Icon(name: Icons.chevronRight, color: Color.textMuted)])),
      Divider(),
      Box(padding: Space.md, onTap: Navigate(to: Route.resetPassword), ariaLabel: "Change password", child: Row(gap: Space.md, children: [Icon(name: Icons.settings, color: Color.primary), Expanded(child: Text(child: "Change password")), Icon(name: Icons.chevronRight, color: Color.textMuted)])),
      Divider(),
      Box(padding: Space.md, onTap: SignOutPreviewCustomer(), ariaLabel: "Sign out", child: Row(gap: Space.md, children: [Icon(name: Icons.close, color: Color.danger), Expanded(child: Text(child: "Sign out", color: Color.danger))]))
    ]))`,
  }, ["account", "menu", "settings"]),
  sdk("Account", "sign-out-button", "Sign out button", "Signs the customer out.", {
    build: `Button(label: "Sign out", style: ButtonStyle.secondary, fullWidth: true, onTap: SignOutPreviewCustomer())`,
  }, ["sign out", "account"]),

  // ---- Checkout, tips and reviews (the storefront API's own features)
  sdk("Checkout", "quote-breakdown", "Quote breakdown", "The store's quote: subtotal, its own charges, delivery, tip and total.", {
    build: `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.sm, children: [
      Row(children: [Expanded(child: Text(child: "Subtotal", color: Color.textMuted)), Text(child: formatMoney(quote.items_subtotal_cents))]),
      ForEach(items: quote.charges, as: "c", child: Row(children: [Expanded(child: Text(child: c.name, color: Color.textMuted)), Text(child: formatMoney(c.amount_cents))])),
      If(condition: quote.delivery_fee_cents > 0, then: Row(children: [Expanded(child: Text(child: "Delivery", color: Color.textMuted)), Text(child: formatMoney(quote.delivery_fee_cents))])),
      If(condition: quote.tip_cents > 0, then: Row(children: [Expanded(child: Text(child: "Tip", color: Color.textMuted)), Text(child: formatMoney(quote.tip_cents))])),
      Divider(),
      Row(children: [Expanded(child: Text(child: "Total", weight: FontWeight.bold)), Text(child: formatMoney(quote.total_cents), size: FontSize.lg, weight: FontWeight.bold)])
    ]))`,
  }, ["quote", "total", "tip"]),
  sdk("Checkout", "payment-method-picker", "Payment method", "Cash or card, as the store accepts them; sent with the order.", {
    build: `Column(gap: Space.sm, children: [
      Text(child: "How will you pay?", weight: FontWeight.semibold),
      Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [
        If(condition: store.accepts_cash, then: Box(width: 130, padding: Insets(y: 12), radius: Radius.md, alignment: Anchor.center, border: Border(width: 1, color: checkout.payment_method != "card" ? Color.primary : Color.border), onTap: SetCheckout(field: "payment_method", value: "cash"), ariaLabel: "Pay with cash", child: Text(child: "Cash", weight: FontWeight.semibold))),
        If(condition: store.accepts_card, then: Box(width: 130, padding: Insets(y: 12), radius: Radius.md, alignment: Anchor.center, border: Border(width: 1, color: checkout.payment_method == "card" ? Color.primary : Color.border), onTap: SetCheckout(field: "payment_method", value: "card"), ariaLabel: "Pay by card", child: Text(child: "Card", weight: FontWeight.semibold)))
      ])
    ])`,
  }, ["payment", "cash", "card"]),
  sdk("Checkout", "place-order-button", "Place order button", "Places the cart as an order with the checkout's choices, then opens tracking.", {
    build: `Button(label: cartCount > 0 ? "Place order · \${formatMoney(quote.total_cents)}" : "Your cart is empty", fullWidth: true, size: Size.lg, disabled: cartCount == 0, onTap: PlaceOrder(fulfilment: checkout.fulfilment))`,
  }, ["place order", "checkout", "button"]),
  sdk("Fulfilment", "fulfilment-switch", "Delivery or pickup", "Switches the checkout between delivery and pickup, as the store offers them.", {
    build: `Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [
      If(condition: store.accepts_delivery, then: Box(width: 130, padding: Insets(y: 10), radius: Radius.full, alignment: Anchor.center, background: checkout.fulfilment == "delivery" ? Color.primary : Color.surfaceAlt, onTap: SetCheckout(field: "fulfilment", value: "delivery"), ariaLabel: "Delivery", child: Text(child: "Delivery", weight: FontWeight.semibold, color: checkout.fulfilment == "delivery" ? Color.primaryInk : Color.text))),
      If(condition: store.accepts_collect, then: Box(width: 130, padding: Insets(y: 10), radius: Radius.full, alignment: Anchor.center, background: checkout.fulfilment == "pickup" ? Color.primary : Color.surfaceAlt, onTap: SetCheckout(field: "fulfilment", value: "pickup"), ariaLabel: "Pickup", child: Text(child: "Pickup", weight: FontWeight.semibold, color: checkout.fulfilment == "pickup" ? Color.primaryInk : Color.text)))
    ])`,
  }, ["delivery", "pickup", "fulfilment"]),
  sdk("Fulfilment", "delivery-instructions", "Delivery instructions", "Directions for the driver, sent with the order.", {
    states: `StringState(name: "instructions", default: "")`,
    build: `If(condition: checkout.fulfilment == "delivery", then: TextField(state: "instructions", label: "Delivery instructions", placeholder: "Gate code, landmarks", maxLength: 200, onChanged: SetCheckout(field: "delivery_instructions", value: input.value)))`,
  }, ["delivery", "instructions", "driver"]),
  sdk("Orders", "cancel-order-button", "Cancel order button", "Cancels the open order while the store hasn't started it.", {
    build: `If(condition: order.status == "pending" || order.status == "confirmed", then: Button(label: "Cancel order", style: ButtonStyle.secondary, fullWidth: true, onTap: CancelOrder()), else: Text(child: "This order can no longer be cancelled.", size: FontSize.sm, color: Color.textMuted))`,
  }, ["cancel", "order"]),
  sdk("Orders", "review-prompt", "Review prompt", "Rates the food and the delivery once the order is delivered.", {
    states: `NumberState(name: "food", default: 0), NumberState(name: "delivery", default: 0)`,
    build: `If(condition: order.status == "delivered", then: Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1), child: If(condition: review != null, then: Text(child: "Thanks for rating your order \${review.food_rating}/5.", weight: FontWeight.semibold), else: Column(gap: Space.sm, children: [
      Text(child: "How was the food?", weight: FontWeight.semibold),
      Row(gap: Space.xs, children: [
        Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "food", value: 1), ariaLabel: "Food one star", child: Icon(name: Icons.star, color: state.food >= 1 ? Color.warning : Color.border)),
        Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "food", value: 2), ariaLabel: "Food two stars", child: Icon(name: Icons.star, color: state.food >= 2 ? Color.warning : Color.border)),
        Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "food", value: 3), ariaLabel: "Food three stars", child: Icon(name: Icons.star, color: state.food >= 3 ? Color.warning : Color.border)),
        Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "food", value: 4), ariaLabel: "Food four stars", child: Icon(name: Icons.star, color: state.food >= 4 ? Color.warning : Color.border)),
        Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "food", value: 5), ariaLabel: "Food five stars", child: Icon(name: Icons.star, color: state.food >= 5 ? Color.warning : Color.border))
      ]),
      If(condition: order.fulfilment_type == "delivery", then: Column(gap: Space.sm, children: [
        Text(child: "How was the delivery?", weight: FontWeight.semibold),
        Row(gap: Space.xs, children: [
          Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "delivery", value: 1), ariaLabel: "Delivery one star", child: Icon(name: Icons.star, color: state.delivery >= 1 ? Color.warning : Color.border)),
          Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "delivery", value: 2), ariaLabel: "Delivery two stars", child: Icon(name: Icons.star, color: state.delivery >= 2 ? Color.warning : Color.border)),
          Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "delivery", value: 3), ariaLabel: "Delivery three stars", child: Icon(name: Icons.star, color: state.delivery >= 3 ? Color.warning : Color.border)),
          Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "delivery", value: 4), ariaLabel: "Delivery four stars", child: Icon(name: Icons.star, color: state.delivery >= 4 ? Color.warning : Color.border)),
          Box(width: 40, height: 40, alignment: Anchor.center, onTap: SetState(state: "delivery", value: 5), ariaLabel: "Delivery five stars", child: Icon(name: Icons.star, color: state.delivery >= 5 ? Color.warning : Color.border))
        ])
      ])),
      Button(label: "Send review", disabled: state.food == 0 && state.delivery == 0, onTap: SubmitReview(foodRating: state.food, deliveryRating: state.delivery))
    ]))))`,
  }, ["review", "rating", "delivered"]),
  sdk("Orders", "store-reviews", "Store reviews", "What customers said about the store, with their ratings.", {
    build: `Column(gap: Space.sm, children: [
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Text(child: "Reviews", size: FontSize.lg, weight: FontWeight.bold),
        If(condition: store.rating_count > 0, then: Badge(label: "\${store.rating} · \${store.rating_count} ratings", tone: Tone.neutral))
      ]),
      ForEach(items: reviews, as: "r", limit: 5, empty: Text(child: "No reviews yet.", color: Color.textMuted), child: Box(padding: Space.md, radius: Radius.md, background: Color.surface, border: Border(width: 1), child: Column(gap: Space.xs, children: [
        Row(children: [Expanded(child: Text(child: r.customer_name, weight: FontWeight.semibold)), If(condition: r.food_rating, then: Text(child: "\${r.food_rating}/5", weight: FontWeight.bold, color: Color.primary))]),
        If(condition: r.food_comment, then: Text(child: r.food_comment, color: Color.textMuted))
      ])))
    ])`,
  }, ["reviews", "ratings", "store"]),

  // ---- Navigation
  sdk("Navigation", "shop-tab-bar", "Shop tab bar", "Menu, orders, account and the cart with its live count.", {
    build: `Box(padding: Insets(x: 8, y: 6), background: Color.surface, border: Border(width: 1), child: Row(children: [
      Expanded(child: Box(padding: Space.xs, alignment: Anchor.center, onTap: Navigate(to: Route.menu), ariaLabel: "Menu", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.menu), Text(child: "Menu", size: FontSize.xs)]))),
      Expanded(child: Box(padding: Space.xs, alignment: Anchor.center, onTap: Navigate(to: Route.orders), ariaLabel: "Orders", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.orders), Text(child: "Orders", size: FontSize.xs)]))),
      Expanded(child: Box(padding: Space.xs, alignment: Anchor.center, onTap: Navigate(to: Route.account), ariaLabel: "Account", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.user), Text(child: "Account", size: FontSize.xs)]))),
      Expanded(child: Box(padding: Space.xs, alignment: Anchor.center, onTap: Navigate(to: Route.cart), ariaLabel: "Cart", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.cart, color: cartCount > 0 ? Color.primary : Color.text), Text(child: cartCount > 0 ? "Cart (\${cartCount})" : "Cart", size: FontSize.xs, color: cartCount > 0 ? Color.primary : Color.text)])))
    ]))`,
  }, ["tabs", "bottom bar", "cart"], "navigation"),
];


// ---------------------------------------------------------------------------- Store templates
/**
 * Whole store apps, scoped to what the storefront SDK (upskale_storefront)
 * does: find the customer's address, choose a nearby store, browse its menu,
 * configure a product, a cart, checkout (delivery or collection, as the store
 * allows), orders, live tracking, the account, saved addresses and password
 * reset. Every template has those same eleven pages and routes as the
 * reference storefront; what differs is the brand: the header, the theme,
 * the words and how the menu page presents the chosen store, all from live
 * store data (no invented features or hard-coded products).
 */
interface StoreDesign {
  slug: string;
  title: string;
  description: string;
  premium?: boolean;
  tags: string[];
  /** The app bar: the header component's name and its layout. */
  header: { name: string; build: string };
  /** The bottom navigation on the app's tab pages (menu, cart, orders,
   *  account); none when the header carries the navigation (a drawer). */
  nav?: { name: string; build: string };
  /** The brand's words on its pages. */
  copy: StoreCopy;
  /**
   * Where the brand itself is written (its header's name, mark, tagline),
   * each as the design says it → what [brand] makes it. A business's own
   * name goes in through these (storefrontBrief.ts).
   */
  brandWords: (brand: KitBrand) => Record<string, string>;
  /** Its pages, when not one of the hand-made ones (storeTemplatePages). */
  pages?: Record<StorePageId, StorePageBuild>;
  colors: Record<string, string>;
  radii?: Record<string, number>;
}

/** The pages a bottom navigation leads to, and so shows on. */
const TAB_PAGES = new Set(["menu", "cart", "orders", "account"]);

/**
 * Each store template's words: its page copy and its brand words. Filled in
 * as the templates are made (store()), read by storefrontVoice().
 */
const storeVoices = new Map<string, { copy: StoreCopy; brandWords: StoreDesign["brandWords"] }>();

/** A store template's own words, to put a business's in their place; none for anything else. */
export function storefrontVoice(id: string) {
  return storeVoices.get(id);
}

/**
 * Words a design writes in capitals, said in capitals too. An empty one is a
 * zero-width space: a text can't be saved empty (that means "the design's
 * own"), and a two-part wordmark ("FIRE" "SLICE") with a one-word name has
 * nothing for its second part.
 */
export const shout = (text: string) => text.toUpperCase() || "\u200b";

const store = (design: StoreDesign): CatalogItem => {
  storeVoices.set("market:" + design.slug, { copy: design.copy, brandWords: design.brandWords });
  const header = `${design.header.name}()`;
  // Every page is a screen: the header in the app bar, the page scrolling
  // under it, and the bottom navigation on the tab pages.
  const screen = (id: string, name: string, build: string) =>
    `Scaffold(
      appBar: ${header},
      body: ScrollView(label: ${JSON.stringify(name)}, child: Column(gap: Space.md, padding: Insets(y: 12), children: [${build}])),${
        design.nav && TAB_PAGES.has(id) ? `\n      bottomNavigationBar: ${design.nav.name}(),` : ""
      }
    )`;
  const page = (id: string, name: string, path: string, build: string, states?: string): StudioPage => withStorefrontData({
    id,
    name,
    path,
    source: `Component(
  dsl: 1, id: "${design.slug}/${id}", name: ${JSON.stringify(name)}, kind: Kind.section,
  description: ${JSON.stringify(name + " page")},${states ? `
  states: [${states}],` : ""}
  variants: [Variant(id: "default", label: "Default", build:
    ${screen(id, name, build)}
  )],
)
`,
  });
  // Each template lays out every page its own way (storeTemplatePages).
  const own = design.pages ?? storeTemplatePages[design.slug](design.copy);
  const mine = (id: StorePageId, name: string, path: string) => page(id, name, path, own[id].build, own[id].states);
  const q = JSON.stringify;
  const pages: StudioPage[] = [
    mine("location", "Select location", "/select-location"),
    mine("stores", "Select store", "/select-store"),
    // A store's pages say which store in their address: read on the server,
    // so a reload (or a shared link) never loses the store or its currency.
    mine("menu", "Menu", STORE_PAGE_PATHS.menu),
    mine("product", "Product options", STORE_PAGE_PATHS.product),
    mine("cart", "Cart", STORE_PAGE_PATHS.cart),
    mine("checkout", "Checkout", STORE_PAGE_PATHS.checkout),
    mine("orders", "Order history", "/orders"),
    mine("tracking", "Order tracking", "/orders/$orderId"),
    mine("account", "Account", "/account"),
    mine("addresses", "Addresses", "/addresses"),
    mine("reset-password", "Password reset", "/reset-password"),
  ];
  const headerSource = `Component(
  dsl: 1, id: "${design.slug}/header", name: ${q(design.header.name)}, kind: Kind.navigation,
  description: "The store's header: brand, the chosen store and the cart",
  variants: [Variant(id: "default", label: "Default", build:
    ${design.header.build}
  )],
)
`;
  const example: StudioExample = {
    id: "market:" + design.slug,
    name: design.title,
    description: design.description,
    type: "template",
    kind: "section",
    variants: ["default"],
    tags: design.tags,
    source: pages[0].source,
    pages,
    entryPageId: "location",
    shellSource: "",
    componentSources: {
      [design.header.name]: headerSource,
      ...(design.nav && {
        [design.nav.name]: `Component(
  dsl: 1, id: "${design.slug}/nav", name: ${q(design.nav.name)}, kind: Kind.navigation,
  description: "The app's bottom navigation: menu, cart, orders and account",
  variants: [Variant(id: "default", label: "Default", build:
    ${design.nav.build}
  )],
)
`,
      }),
    },
    config: { colors: design.colors, spacing: {}, radii: design.radii ?? {}, fontSizes: {}, iconSizes: {}, iconLibrary: "material" },
  };
  // Importing what each page reads (migrateImports.ts): worked out the
  // first time the template is opened, not for every template up front.
  let opened: StudioExample | undefined;
  return {
    id: example.id,
    title: design.title,
    description: design.description,
    category: "Store templates",
    premium: design.premium,
    tags: design.tags,
    get example() {
      return (opened ??= templateWithImports(example));
    },
  };
};

/** A round icon button that goes somewhere. */
const iconLink = (icon: string, label: string, route: string, color = "Color.text") =>
  `Box(shape: BoxShape.circle, width: 40, height: 40, alignment: Anchor.center, onTap: Navigate(to: Route.${route}), ariaLabel: ${JSON.stringify(label)}, child: Icon(name: Icons.${icon}, color: ${color}))`;

/** The cart icon with the live item count on it. */
const cartLink = (iconColor: string, badge: string, badgeInk: string) =>
  `Stack(width: 44, height: 44, children: [
        Positioned(top: 2, left: 2, child: ${iconLink("cart", "Cart", "cart", iconColor)}),
        Positioned(top: 0, right: 0, child: If(condition: cartCount > 0, then: Box(shape: BoxShape.circle, width: 18, height: 18, alignment: Anchor.center, background: ${badge}, child: Text(child: cartCount, size: FontSize.xs, weight: FontWeight.bold, color: ${badgeInk}))))
      ])`;

const templates: CatalogItem[] = [
  // A neighbourhood café: friendly, warm, rounded.
  store({
    slug: "bean-and-bloom",
    brandWords: (b) => ({ "Bean & Bloom": b.name, "Choose a café near you": b.tagline }),
    title: "Bean & Bloom café",
    description: "A warm café app on the full storefront flow: find the nearest branch, order from its menu, delivery or collection as the branch allows, and follow the order live.",
    tags: ["cafe", "coffee", "full app"],
    colors: { primary: "#8a5a3c", primaryInk: "#ffffff", background: "#fbf6f1", surface: "#ffffff", surfaceAlt: "#f1e6dc", text: "#2b1d14", textMuted: "#7a6556", border: "#e6d8cb" },
    radii: { md: 14, lg: 22 },
    header: {
      name: "CafeHeader",
      build: `Box(padding: Insets(x: 16, y: 10), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, background: Color.primary, child: Icon(name: Icons.heart, size: Size.sm, color: Color.primaryInk)),
      Expanded(child: Column(children: [
        Text(child: "Bean & Bloom", weight: FontWeight.bold, size: FontSize.lg, fontStyle: FontStyle.italic),
        If(condition: store.name, then: Text(child: store.name, size: FontSize.xs, color: Color.textMuted), else: Text(child: "Choose a café near you", size: FontSize.xs, color: Color.textMuted))
      ])),
      ${cartLink("Color.primary", "Color.primary", "Color.primaryInk")}
    ]))`,
    },
    nav: {
      name: "CafeTabs",
      // Soft pills: the current tab's icon sits in a cream capsule.
      build: `Box(padding: Insets(x: 8, y: 8), background: Color.surface, border: Border(width: 1, color: Color.border), child: Row(children: [
      ${[["menu", "home", "Menu"], ["cart", "cart", "Order"], ["orders", "orders", "History"], ["account", "user", "You"]]
        .map(([route, icon, label]) => `Expanded(child: Box(padding: Insets(y: 4), alignment: Anchor.center, onTap: Navigate(to: Route.${route}), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [
        Box(padding: Insets(x: 18, y: 4), radius: Radius.full, background: isCurrentRoute(Route.${route}) ? Color.surfaceAlt : Color.surface, child: Icon(name: Icons.${icon}, color: isCurrentRoute(Route.${route}) ? Color.primary : Color.textMuted)),
        Text(child: "${label}", size: FontSize.xs, fontStyle: FontStyle.italic, color: isCurrentRoute(Route.${route}) ? Color.primary : Color.textMuted)
      ])))`)
        .join(",\n      ")}
    ]))`,
    },
    copy: {
      location: ["Where's your coffee going?", "Search your address, or use where you are.", "Find cafés"],
      stores: ["Pick your café", "The nearest Bean & Bloom branches.", "See the menu"],
      product: ["Make it yours", "Add to order"],
      cart: ["Your order", "Nothing brewing yet.", "Go to checkout"],
      checkout: ["Almost there", "Place order"],
      orders: ["Your orders", "Your first coffee is waiting."],
      tracking: "Your coffee's on its way",
      account: ["Your account", "Save your details for next time."],
    },
  }),

  // An artisan bakery: elegant, serif, sharp corners.
  store({
    slug: "maison-crumb",
    brandWords: (b) => ({ "MAISON CRUMB": shout(b.name), "Boulangerie · since 1998": b.tagline }),
    title: "Maison Crumb bakery",
    description: "An elegant bakery app: a serif identity on the full storefront flow, with the shop's address and hours on its menu page and collection or delivery as each shop offers.",
    premium: true,
    tags: ["bakery", "collection", "full app"],
    colors: { primary: "#6b4e2e", primaryInk: "#fffaf2", background: "#fffaf2", surface: "#ffffff", surfaceAlt: "#f4ead9", text: "#2a2118", textMuted: "#857463", border: "#e8dcc6" },
    radii: { sm: 0, md: 2, lg: 4 },
    header: {
      name: "BakeryHeader",
      build: `Column(gap: Space.sm, align: Align.center, padding: Insets(y: 16), children: [
      Text(child: "MAISON CRUMB", size: FontSize.xl, weight: FontWeight.bold, letterSpacing: 6, fontFamily: "Georgia", align: TextAlign.center),
      Text(child: "Boulangerie · since 1998", size: FontSize.xs, fontStyle: FontStyle.italic, color: Color.textMuted, fontFamily: "Georgia"),
      Divider()
    ])`,
    },
    nav: {
      name: "BakeryTabs",
      // Words, not icons: letter-spaced serif labels over a hairline rule.
      build: `Column(children: [Divider(), Box(padding: Insets(x: 12, y: 14), background: Color.background, child: Row(children: [
      ${[["menu", "SHOP"], ["cart", "BASKET"], ["orders", "ORDERS"], ["account", "ACCOUNT"]]
        .map(([route, label]) => `Expanded(child: Box(padding: Insets(y: 4), alignment: Anchor.center, onTap: Navigate(to: Route.${route}), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [
        Text(child: ${route === "cart" ? `cartCount > 0 ? "BASKET \${cartCount}" : "BASKET"` : `"${label}"`}, size: FontSize.xs, letterSpacing: 2, fontFamily: "Georgia", color: isCurrentRoute(Route.${route}) ? Color.text : Color.textMuted),
        Box(width: 20, height: 1, background: isCurrentRoute(Route.${route}) ? Color.primary : Color.background)
      ])))`)
        .join(",\n      ")}
    ]))])`,
    },
    copy: {
      location: ["Where shall we bake for?", "Search your address to find the nearest shop.", "Find shops"],
      stores: ["Choose your boulangerie", "Each shop bakes its own.", "Visit the shop"],
      product: ["Your selection", "Add to basket"],
      cart: ["Your basket", "Your basket is empty.", "Continue"],
      checkout: ["Checkout", "Confirm order"],
      orders: ["Your orders", "No orders yet."],
      tracking: "Your order",
      account: ["Account", "Order as a guest or keep your details."],
    },
  }),

  // A late-night pizzeria: dark, loud, delivery-first.
  store({
    slug: "fire-slice",
    brandWords: (b) => {
      const [first, ...rest] = b.name.split(" ");
      return { FIRE: shout(first), SLICE: shout(rest.join(" ")) };
    },
    title: "Fire Slice pizza",
    description: "A bold dark pizzeria app built for delivery: the store's delivery fee, minimum order and prep time up front, and a cart bar that follows the customer.",
    premium: true,
    tags: ["pizza", "delivery", "dark", "full app"],
    colors: { primary: "#ff4d1f", primaryInk: "#ffffff", background: "#141414", surface: "#1f1f1f", surfaceAlt: "#2a2a2a", text: "#f5f5f5", textMuted: "#a3a3a3", border: "#333333", warning: "#ffc21a" },
    radii: { md: 12, lg: 20 },
    header: {
      name: "PizzaHeader",
      build: `Box(padding: Insets(x: 16, y: 12), background: Color.background, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Text(child: "FIRE", size: FontSize.xl, weight: FontWeight.bold, color: Color.primary, letterSpacing: 2),
      Expanded(child: Text(child: "SLICE", size: FontSize.xl, weight: FontWeight.bold, letterSpacing: 2)),
      ${cartLink("Color.text", "Color.primary", "Color.primaryInk")}
    ]))`,
    },
    nav: {
      name: "PizzaTabs",
      // A dark dock: the current tab lights up as an orange pill with its label.
      build: `Box(padding: Insets(x: 12, y: 10), background: Color.surface, child: Row(gap: Space.xs, children: [
      ${[["menu", "home", "MENU"], ["cart", "cart", "CART"], ["orders", "orders", "ORDERS"], ["account", "user", "ME"]]
        .map(([route, icon, label]) => `Expanded(child: Box(padding: Insets(y: 10), radius: Radius.full, alignment: Anchor.center, background: isCurrentRoute(Route.${route}) ? Color.primary : Color.surface, onTap: Navigate(to: Route.${route}), ariaLabel: "${label}", child: Row(gap: Space.xs, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Icon(name: Icons.${icon}, size: Size.sm, color: isCurrentRoute(Route.${route}) ? Color.primaryInk : Color.textMuted),
        If(condition: isCurrentRoute(Route.${route}), then: Text(child: "${label}", size: FontSize.xs, weight: FontWeight.bold, letterSpacing: 1, color: Color.primaryInk))
      ])))`)
        .join(",\n      ")}
    ]))`,
    },
    copy: {
      location: ["Where are we delivering?", "Hot pizza needs an address.", "Find a kitchen"],
      stores: ["Pick a kitchen", "The closest ovens to you.", "Start ordering"],
      product: ["Build it", "Add to cart"],
      cart: ["Your cart", "Your cart's cold. Add a pizza.", "Checkout"],
      checkout: ["Checkout", "Fire it up"],
      orders: ["Your orders", "No pizzas yet."],
      tracking: "Your pizza's on the way",
      account: ["Your account", "Save your address for one-tap reorders."],
    },
  }),

  // A grocer: practical, bright, three to a row.
  store({
    slug: "green-basket",
    brandWords: (b) => ({ GB: b.mark, "Green Basket": b.name, "Choose a store": b.tagline }),
    title: "Green Basket grocer",
    description: "A bright grocery app: the chosen store's city, hours and delivery options up top, and produce three to a row.",
    premium: true,
    tags: ["grocery", "produce", "full app"],
    colors: { primary: "#2f7d32", primaryInk: "#ffffff", background: "#ffffff", surface: "#ffffff", surfaceAlt: "#eef7ee", text: "#16301a", textMuted: "#5d7461", border: "#dbe8dc" },
    radii: { md: 16, lg: 24 },
    header: {
      name: "GrocerHeader",
      build: `Box(padding: Insets(x: 16, y: 10), background: Color.surface, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, background: Color.primary, child: Text(child: "GB", size: FontSize.xs, weight: FontWeight.bold, color: Color.primaryInk)),
      Expanded(child: Column(children: [
        Text(child: "Green Basket", weight: FontWeight.bold, color: Color.primary),
        If(condition: store.name, then: Text(child: "\${store.name}, \${store.city}", size: FontSize.xs, color: Color.textMuted), else: Text(child: "Choose a store", size: FontSize.xs, color: Color.textMuted))
      ])),
      ${cartLink("Color.primary", "Color.primary", "Color.primaryInk")}
    ]))`,
    },
    nav: {
      name: "GrocerTabs",
      // Icons over labels, the basket carrying its count, the current tab green.
      build: `Box(padding: Insets(x: 8, y: 8), background: Color.surface, border: Border(width: 1, color: Color.border), child: Row(children: [
      ${[["menu", "home", "Shop"], ["cart", "cart", "Basket"], ["orders", "orders", "Orders"], ["account", "user", "Account"]]
        .map(([route, icon, label]) => `Expanded(child: Box(padding: Insets(y: 6), alignment: Anchor.center, onTap: Navigate(to: Route.${route}), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [
        ${route === "cart"
          ? `Row(gap: Space.xs, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.cart, color: isCurrentRoute(Route.cart) ? Color.primary : Color.textMuted), If(condition: cartCount > 0, then: Badge(label: cartCount, tone: Tone.primary))])`
          : `Icon(name: Icons.${icon}, color: isCurrentRoute(Route.${route}) ? Color.primary : Color.textMuted)`},
        Text(child: "${label}", size: FontSize.xs, weight: isCurrentRoute(Route.${route}) ? FontWeight.bold : FontWeight.regular, color: isCurrentRoute(Route.${route}) ? Color.primary : Color.textMuted)
      ])))`)
        .join(",\n      ")}
    ]))`,
    },
    copy: {
      location: ["Where should we deliver?", "Search your address for same-day delivery.", "Find stores"],
      stores: ["Choose your store", "Stores that deliver to you.", "Start shopping"],
      product: ["Choose your options", "Add to basket"],
      cart: ["Your basket", "Your basket is empty.", "Checkout"],
      checkout: ["Checkout", "Place order"],
      orders: ["Your orders", "No orders yet."],
      tracking: "Your delivery",
      account: ["Your account", "Save your details and addresses."],
    },
  }),

  // A sushi bar: dark navy, quiet, premium.
  store({
    slug: "kiri-sushi",
    brandWords: (b) => ({ KIRI: shout(b.name) }),
    title: "Kiri sushi bar",
    description: "A calm, premium sushi app in deep navy with a slide-out menu: the restaurant's rating and hours up front on the full storefront flow.",
    premium: true,
    tags: ["sushi", "restaurant", "dark", "full app"],
    colors: { primary: "#e8c27a", primaryInk: "#0f1a26", background: "#0f1a26", surface: "#16263a", surfaceAlt: "#1d3049", text: "#eef2f6", textMuted: "#93a4b8", border: "#2a3f5a" },
    radii: { md: 10, lg: 18 },
    header: {
      name: "SushiHeader",
      build: `Box(padding: Insets(x: 12, y: 10), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Drawer(side: Side.left, trigger: TriggerButton(icon: Icons.menu, ariaLabel: "Open menu", style: ButtonStyle.ghost), child: Column(padding: Space.lg, gap: Space.md, children: [
        Text(child: "KIRI", size: FontSize.xl, weight: FontWeight.bold, letterSpacing: 8, color: Color.primary),
        Button(label: "Menu", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu)),
        Button(label: "Restaurants", style: ButtonStyle.ghost, onTap: Navigate(to: Route.stores)),
        Button(label: "Orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders)),
        Button(label: "Account", style: ButtonStyle.ghost, onTap: Navigate(to: Route.account))
      ])),
      Expanded(child: Text(child: "KIRI", size: FontSize.xl, weight: FontWeight.bold, letterSpacing: 8, color: Color.primary, align: TextAlign.center)),
      ${cartLink("Color.primary", "Color.primary", "Color.primaryInk")}
    ]))`,
    },
    copy: {
      location: ["Where shall we deliver?", "Your address, and we'll find the nearest Kiri.", "Find restaurants"],
      stores: ["Choose a restaurant", "Every Kiri rolls to order.", "View the menu"],
      product: ["Your order", "Add"],
      cart: ["Your order", "Nothing here yet.", "Checkout"],
      checkout: ["Checkout", "Place order"],
      orders: ["Your orders", "Your first order awaits."],
      tracking: "Your order",
      account: ["Account", "Save your details for next time."],
    },
  }),
];

/** A kit template (storeKitTemplates.ts): free, with the [index]th mix of layouts. */
/** A kit template's brand, wherever its header and pages write it. */
const kitBrandWords = (own: KitBrand) => (b: KitBrand) => {
  const [first, ...rest] = own.name.split(" ");
  const [newFirst, ...newRest] = b.name.split(" ");
  return {
    [own.name]: b.name,
    [own.name.toUpperCase()]: shout(b.name),
    [first.toUpperCase()]: shout(newFirst),
    [rest.join(" ").toUpperCase()]: shout(newRest.join(" ")),
    [own.mark]: b.mark,
    [own.tagline]: b.tagline,
  };
};

const kitStore = (spec: KitSpec, index: number): CatalogItem => {
  const copy = voiced(spec.voice);
  const made = kitTemplate(spec.style, kitLayout(index), copy, spec.brand);
  const component = spec.slug.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  return store({
    slug: spec.slug,
    title: spec.title,
    description: spec.description,
    tags: [...spec.tags, "full app"],
    colors: spec.colors,
    header: { name: component + "Header", build: made.header },
    nav: { name: component + "Tabs", build: made.nav },
    copy,
    brandWords: kitBrandWords(spec.brand),
    pages: made.pages,
  });
};

/**
 * A catalogue item importing what it reads (migrateImports.ts): worked out
 * the first time it's opened, not for every item up front.
 */
function withLazyImports(item: CatalogItem): CatalogItem {
  const { example, ...rest } = item;
  let opened: StudioExample | undefined;
  return {
    ...rest,
    get example() {
      return (opened ??= templateWithImports(example));
    },
  };
}

/** The store templates: New project's starting points, and a storefront's designs. */
export const storeTemplateCatalog: CatalogItem[] = [...templates, ...kitSpecs.map(kitStore)];

/**
 * The components: not offered anywhere in the app, kept because they are a
 * large, varied corpus every compiler change is checked against
 * (scripts/studio-dart-modules.mjs).
 */
export const componentCorpus: CatalogItem[] = [...storefront, ...buttons, ...commerce, ...cards, ...navigation, ...text, ...forms, ...marketing].map(
  withLazyImports,
);

/** All of it, for the compiler checks. */
export const catalog: CatalogItem[] = [...storeTemplateCatalog, ...componentCorpus];

/**
 * The storefront app every new storefront project starts from
 * (storefrontTemplate.ts): the kit's eleven pages in a plain look and plain
 * words, built from Flux's own widgets, each page importing what it reads.
 */
export const storefrontStarter: StudioExample = (() => {
  const copy = voiced({
    place: "store",
    places: "stores",
    basket: "cart",
    verb: "deliver",
    product: ["Make it yours", "Add to cart"],
    track: "Follow your order",
    hello: "Your account",
    cta: "Place order",
    empty: "Your first order starts here.",
  });
  const brand: KitBrand = { name: "Storefront", mark: "SF", tagline: "Fresh, near you" };
  const made = kitTemplate({ radius: "md", surface: "card", weight: "bold", gap: "md" }, kitLayout(0), copy, brand);
  return store({
    slug: "storefront",
    title: "Storefront app",
    description: "An eleven-page app: location and store selection, menu, product options, cart, checkout, orders, tracking, account, addresses and password reset.",
    tags: ["full app", "11 pages", "storefront", "food"],
    colors: {},
    header: { name: "SharedHeader", build: made.header },
    nav: { name: "StoreTabs", build: made.nav },
    copy,
    brandWords: kitBrandWords(brand),
    pages: made.pages,
  }).example;
})();
