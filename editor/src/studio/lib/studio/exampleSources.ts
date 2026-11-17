// Synced from Upskale Studio (upskaleapp/src/lib/studio/exampleSources.ts). Edit it there, then npm run sync.
import { storefrontTemplate } from "./storefrontTemplate";
import type { StudioExample } from "./types";

export const STUDIO_EXAMPLES: StudioExample[] = [
  storefrontTemplate,
  {
    id: "blank",
    name: "Blank component",
    description: "A clean canvas. Make something your own.",
    kind: "section",
    type: "component",
    variants: ["default"],
    tags: ["starter"],
    source:
      "Component(\n  dsl: 1,\n  id: \"studio/new-component\",\n  name: \"New component\",\n  kind: Kind.section,\n  description: \"A fresh start for your next idea.\",\n  aiHints: \"A simple introduction section.\",\n  variants: [\n    Variant(\n      id: \"default\",\n      label: \"Default\",\n      build: Text(child: store.name),\n    ),\n  ], data: [Data(name: \"store\", from: Client.store(), fetch: \"client\", type: Store)],\n)\n",
  },
  {
    id: "product-card",
    name: "Product card",
    description: "A flexible card for the products your customers love.",
    kind: "product-card",
    type: "component",
    variants: ["vertical", "horizontal"],
    tags: ["product-card", "responsive"],
    source:
      "Component(\n  dsl: 1,\n  id: \"acme/product-card-pro\",\n  name: \"Pro product card\",\n  kind: Kind.productCard,\n  description: \"Product tile with image, price, discount badge and add button.\",\n  aiHints: \"Use for product tiles. Variants: vertical (image on top), horizontal (image on the left). Options for corner radius, image shape, calories and button text.\",\n  options: [\n    EnumOption(name: \"radius\", label: \"Corner radius\",\n      values: [Radius.none, Radius.sm, Radius.md, Radius.lg], default: Radius.md),\n    EnumOption(name: \"imageRatio\", label: \"Image shape\",\n      values: [\"1:1\", \"4:3\", \"16:9\"], default: \"4:3\"),\n    BoolOption(name: \"showCalories\", label: \"Show calories\", default: false),\n    StringOption(name: \"ctaLabel\", label: \"Button text\", maxLength: 24, default: \"Add\"),\n  DataOption(name: \"product\", type: Product, required: true)],\n  parts: [\n    Part(\n      name: \"priceRow\",\n      build: Row(\n        gap: Space.sm,\n        align: Align.center,\n        children: [\n          Text(child: formatMoney(options.product.display_price_cents),\n               weight: FontWeight.bold, size: FontSize.lg),\n          If(\n            condition: discountPercent(options.product.display_price_cents, options.product.compare_at_price_cents) > 0,\n            then: Text(child: formatMoney(options.product.compare_at_price_cents),\n                       strike: true, color: Color.textMuted, size: FontSize.sm),\n          ),\n        ],\n      ),\n    ),\n    Part(\n      name: \"addButton\",\n      build: Button(\n        label: options.ctaLabel,\n        style: ButtonStyle.primary,\n        size: Size.sm,\n        fullWidth: true,\n        disabled: !options.product.is_available,\n        onTap: AddToCart(product: options.product),\n      ),\n    ),\n  ],\n  variants: [\n    Variant(\n      id: \"vertical\",\n      label: \"Vertical\",\n      build: Box(\n        radius: options.radius,\n        background: Color.surface,\n        border: Border(width: 1, color: Color.border),\n        shadow: Shadow.sm,\n        clip: true,\n        child: Column(\n          children: [\n            Layers(\n              child: Box(\n                onTap: OpenProduct(product: options.product),\n                ariaLabel: options.product.name,\n                child: Image(\n                  src: options.product.image_url,\n                  alt: options.product.name,\n                  aspectRatio: ratio(options.imageRatio),\n                  fit: Fit.cover,\n                ),\n              ),\n              layers: [\n                Layer(\n                  anchor: Anchor.topLeft,\n                  inset: Space.sm,\n                  child: If(\n                    condition: discountPercent(options.product.display_price_cents, options.product.compare_at_price_cents) > 0,\n                    then: Badge(\n                      label: \"-${discountPercent(options.product.display_price_cents, options.product.compare_at_price_cents)}%\",\n                      tone: Tone.danger,\n                    ),\n                  ),\n                ),\n              ],\n            ),\n            Column(\n              gap: Space.sm,\n              padding: Space.md,\n              children: [\n                Text(child: options.product.name, role: TextRole.heading, level: 3,\n                     weight: FontWeight.semibold, maxLines: 2),\n                Text(child: truncate(options.product.description, 80),\n                     color: Color.textMuted, size: FontSize.sm, maxLines: 2),\n                If(\n                  condition: options.showCalories && options.product.calories != null,\n                  then: Text(child: \"${options.product.calories} kcal\", size: FontSize.xs, color: Color.textMuted),\n                ),\n                Use(part: \"priceRow\"),\n                Use(part: \"addButton\"),\n              ],\n            ),\n          ],\n        ),\n      ),\n    ),\n    Variant(\n      id: \"horizontal\",\n      label: \"Horizontal\",\n      build: Box(\n        radius: options.radius,\n        background: Color.surface,\n        border: Border(width: 1, color: Color.border),\n        clip: true,\n        child: Row(\n          children: [\n            Box(\n              width: 120,\n              onTap: OpenProduct(product: options.product),\n              ariaLabel: options.product.name,\n              child: Image(src: options.product.image_url, alt: options.product.name, fit: Fit.cover, aspectRatio: 1),\n            ),\n            Expanded(\n              child: Column(\n                gap: Space.xs,\n                padding: Space.md,\n                children: [\n                  Text(child: options.product.name, role: TextRole.heading, level: 3, weight: FontWeight.semibold),\n                  Use(part: \"priceRow\"),\n                  Use(part: \"addButton\"),\n                ],\n              ),\n            ),\n          ],\n        ),\n      ),\n    ),\n  ],\n)\n",
  },
  {
    id: "product-collection",
    name: "Product collection",
    description: "Bring a menu together as a grid or a carousel.",
    kind: "product-collection",
    type: "component",
    variants: ["grid", "carousel"],
    tags: ["product-collection", "responsive"],
    source:
      "Component(\n  dsl: 1,\n  id: \"acme/collection-flex\",\n  name: \"Flexible product collection\",\n  kind: Kind.productCollection,\n  description: \"Shows a list of products as a grid or a swipeable carousel.\",\n  aiHints: \"Use when the owner wants to show a category or featured products as a grid or carousel. Options: columns, how many to show, card style.\",\n  options: [\n    ComponentOption(name: \"card\", label: \"Card style\", kind: Kind.productCard,\n      default: \"core/product-card\", defaultVariant: \"vertical\"),\n    NumberOption(name: \"columns\", label: \"Columns (mobile)\", min: 1, max: 4, default: 2),\n    NumberOption(name: \"limit\", label: \"How many to show\", min: 1, max: 48, default: 12),\n    BoolOption(name: \"showTitle\", label: \"Show title\", default: true),\n  DataOption(name: \"products\", type: Product, list: true, required: true)],\n  parts: [\n    Part(\n      name: \"header\",\n      build: If(\n        condition: options.showTitle && title != null,\n        then: Text(child: title, role: TextRole.heading, level: 2,\n                   size: FontSize.xl, weight: FontWeight.bold),\n      ),\n    ),\n  ],\n  variants: [\n    Variant(\n      id: \"grid\",\n      label: \"Grid\",\n      build: Column(\n        gap: Space.md,\n        children: [\n          Use(part: \"header\"),\n          Grid(\n            cols: Responsive(base: options.columns, md: options.columns + 1, lg: options.columns + 2),\n            gap: Space.md,\n            children: [\n              ForEach(\n                items: take(options.products, options.limit),\n                as: \"p\",\n                child: Embed(ref: options.card, product: p),\n              ),\n            ],\n          ),\n        ],\n      ),\n    ),\n    Variant(\n      id: \"carousel\",\n      label: \"Carousel\",\n      build: Column(\n        gap: Space.md,\n        children: [\n          Use(part: \"header\"),\n          Carousel(\n            itemWidth: 220,\n            gap: Space.md,\n            snap: true,\n            children: [\n              ForEach(\n                items: take(options.products, options.limit),\n                as: \"p\",\n                child: Embed(ref: options.card, product: p),\n              ),\n            ],\n          ),\n        ],\n      ),\n    ),\n  ],\n)\n",
  },
  {
    id: "navigation",
    name: "Drawer navigation",
    description: "Give every storefront a clear way to get around.",
    kind: "navigation",
    type: "component",
    variants: ["drawer"],
    tags: ["navigation", "responsive"],
    source:
      "Component(\n  dsl: 1,\n  id: \"acme/nav-drawer\",\n  name: \"Drawer navigation\",\n  kind: Kind.navigation,\n  description: \"Header with a hamburger button that opens a side drawer of links.\",\n  aiHints: \"Use when the owner asks for a drawer, hamburger or slide-out menu navigation.\",\n  options: [\n    EnumOption(name: \"side\", label: \"Drawer side\", values: [Side.left, Side.right], default: Side.left),\n    BoolOption(name: \"showLogo\", label: \"Show logo\", default: true),\n  ],\n  variants: [\n    Variant(\n      id: \"drawer\",\n      label: \"Drawer\",\n      build: Row(\n        justify: Justify.between,\n        align: Align.center,\n        padding: Space.md,\n        children: [\n          Drawer(\n            side: options.side,\n            trigger: TriggerButton(icon: Icons.menu, ariaLabel: \"Open menu\", style: ButtonStyle.ghost),\n            child: Column(\n              gap: Space.sm,\n              padding: Space.lg,\n              children: [\n                ForEach(\n                  items: items,\n                  as: \"item\",\n                  child: Button(\n                    label: item.label,\n                    icon: item.icon,\n                    style: ButtonStyle.ghost,\n                    fullWidth: true,\n                    onTap: Navigate(to: item.route),\n                  ),\n                ),\n              ],\n            ),\n          ),\n          If(\n            condition: options.showLogo,\n            then: Image(src: store.logo_url, alt: store.name, height: 32, fit: Fit.contain),\n          ),\n          Button(label: \"Cart (${cart.count})\", icon: Icons.cart, onTap: Navigate(to: Route.cart)),\n        ],\n      ),\n    ),\n  ], data: [Data(name: \"store\", from: Client.store(), fetch: \"client\", type: Store), Data(name: \"cart\", from: Client.cart(), fetch: \"client\", type: Cart)],\n)\n",
  },
  {
    id: "classic-food",
    name: "Classic Food",
    description: "A welcoming hero, category chips and a product grid.",
    kind: "section",
    type: "template",
    variants: ["classic"],
    tags: ["template", "food", "responsive"],
    source:
      "Component(\n  dsl: 1,\n  id: \"studio/classic-food\",\n  name: \"Classic Food\",\n  kind: Kind.section,\n  description: \"A welcoming hero, category chips and a product grid.\",\n  aiHints: \"A simple introduction section.\",\n  variants: [\n    Variant(\n      id: \"classic\",\n      label: \"Classic Food\",\n      build: Text(child: store.name),\n    ),\n  ], data: [Data(name: \"store\", from: Client.store(), fetch: \"client\", type: Store)],\n)\n",
  },
  {
    id: "app-like",
    name: "App-like",
    description: "Compact cards and bottom tabs for a familiar mobile feel.",
    kind: "section",
    type: "template",
    variants: ["compact"],
    tags: ["template", "food", "responsive"],
    source:
      "Component(\n  dsl: 1,\n  id: \"studio/app-like\",\n  name: \"App-like\",\n  kind: Kind.section,\n  description: \"Compact cards and bottom tabs for a familiar mobile feel.\",\n  aiHints: \"A simple introduction section.\",\n  variants: [\n    Variant(\n      id: \"compact\",\n      label: \"App-like\",\n      build: Text(child: store.name),\n    ),\n  ], data: [Data(name: \"store\", from: Client.store(), fetch: \"client\", type: Store)],\n)\n",
  },
  {
    id: "minimal-menu",
    name: "Minimal Menu",
    description: "A quiet, text-forward menu with drawer navigation.",
    kind: "section",
    type: "template",
    variants: ["minimal"],
    tags: ["template", "food", "responsive"],
    source:
      "Component(\n  dsl: 1,\n  id: \"studio/minimal-menu\",\n  name: \"Minimal Menu\",\n  kind: Kind.section,\n  description: \"A quiet, text-forward menu with drawer navigation.\",\n  aiHints: \"A simple introduction section.\",\n  variants: [\n    Variant(\n      id: \"minimal\",\n      label: \"Minimal Menu\",\n      build: Text(child: store.name),\n    ),\n  ], data: [Data(name: \"store\", from: Client.store(), fetch: \"client\", type: Store)],\n)\n",
  },
];
export function getExample(id: string): StudioExample {
  return (
    STUDIO_EXAMPLES.find((example) => example.id === id) ??
    STUDIO_EXAMPLES.find((example) => example.id === "blank")!
  );
}
