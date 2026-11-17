// Synced from Upskale Studio (upskaleapp/src/lib/studio/storeKitTemplates.ts). Edit it there, then npm run sync.
/**
 * Twenty more free store templates from the kit (storeTemplateKit.ts): each
 * its own brand, palette, voice and style, with its own mix of the kit's
 * layouts (kitLayout), on the same full storefront flow as the hand-made
 * five in catalog.ts.
 */
import type { StoreCopy } from "./storeTemplatePages";
import type { KitBrand, KitStyle } from "./storeTemplateKit";

export interface KitVoice {
  /** What a store is called ("bakery", "kitchen"…), and its plural. */
  place: string;
  places: string;
  /** What the cart is called. */
  basket: string;
  /** "Where should we …?" */
  verb: string;
  product: [title: string, button: string];
  track: string;
  hello: string;
  cta: string;
  empty: string;
}

export interface KitSpec {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  brand: KitBrand;
  style: KitStyle;
  colors: Record<string, string>;
  voice: KitVoice;
}

/** A template's words, from its voice. */
export const voiced = (v: KitVoice): StoreCopy => ({
  location: [`Where should we ${v.verb}?`, `Search your address or use your location to find the nearest ${v.place}.`, `Find ${v.places}`],
  stores: [`Choose your ${v.place}`, `The ${v.places} closest to you.`, "Order here"],
  product: v.product,
  cart: [`Your ${v.basket}`, `Your ${v.basket} is empty.`, "Checkout"],
  checkout: ["Checkout", v.cta],
  orders: ["Your orders", v.empty],
  tracking: v.track,
  account: [v.hello, "Save your details for next time."],
});

const palette = (
  primary: string,
  primaryInk: string,
  background: string,
  surface: string,
  surfaceAlt: string,
  text: string,
  textMuted: string,
  border: string,
  warning: string,
) => ({ primary, primaryInk, background, surface, surfaceAlt, text, textMuted, border, warning });

export const kitSpecs: KitSpec[] = [
  {
    slug: "sunrise-bakehouse", title: "Sunrise Bakehouse", tags: ["bakery", "breakfast"],
    description: "A soft peach bakery app: rounded cards, a friendly voice and fresh bakes from the nearest bakehouse.",
    brand: { name: "Sunrise Bakehouse", mark: "SB", tagline: "Baked at first light" },
    style: { radius: "lg", surface: "card", weight: "bold", gap: "md" },
    colors: palette("#e8774a", "#ffffff", "#fff8f3", "#ffffff", "#ffe9dc", "#3a2418", "#8a6a58", "#f3dccd", "#f4b860"),
    voice: { place: "bakehouse", places: "bakehouses", basket: "basket", verb: "bake for", product: ["Make it yours", "Add to basket"], track: "Your bakes are on the way", hello: "Good morning", cta: "Place order", empty: "Nothing baked for you yet." },
  },
  {
    slug: "noodle-lab", title: "Noodle Lab", tags: ["ramen", "noodles", "dark"],
    description: "A dark ramen bar app in red and black: capitals, sharp corners and bowls built to order.",
    brand: { name: "Noodle Lab", mark: "NL", tagline: "Slurp responsibly" },
    style: { radius: "none", surface: "outline", upper: true, tracking: 1, weight: "bold", gap: "md" },
    colors: palette("#e63946", "#ffffff", "#121212", "#1c1c1c", "#262626", "#f1f1f1", "#a0a0a0", "#3a3a3a", "#ff9f1c"),
    voice: { place: "lab", places: "labs", basket: "bowl", verb: "send noodles", product: ["Build your bowl", "Add bowl"], track: "Your bowl is cooking", hello: "Your account", cta: "Send it", empty: "No bowls yet." },
  },
  {
    slug: "taco-fiesta", title: "Taco Fiesta", tags: ["mexican", "tacos"],
    description: "A loud, bright taquería app: gradient banners, chunky tiles and tacos to your door.",
    brand: { name: "Taco Fiesta", mark: "TF", tagline: "Tacos, todo el día" },
    style: { radius: "md", surface: "filled", weight: "bold", italic: true, gap: "lg", font: "Trebuchet MS" },
    colors: palette("#ff5a1f", "#ffffff", "#fffaf0", "#ffffff", "#ffefd1", "#2b1b0f", "#7a5c43", "#ffd9a8", "#ffc93c"),
    voice: { place: "taquería", places: "taquerías", basket: "order", verb: "bring the tacos", product: ["Load it up", "Add to order"], track: "Tacos incoming", hello: "¡Hola!", cta: "Fire up my order", empty: "No tacos yet." },
  },
  {
    slug: "verde-salad-co", title: "Verde Salad Co.", tags: ["salads", "healthy"],
    description: "A clean green salad bar app: light surfaces, tidy grids and bowls packed with greens.",
    brand: { name: "Verde Salad", mark: "VS", tagline: "Greens, done properly" },
    style: { radius: "md", surface: "card", weight: "semibold", gap: "md", pad: 20 },
    colors: palette("#2f9e58", "#ffffff", "#f6fbf7", "#ffffff", "#e3f4e8", "#13301d", "#58735f", "#d4e9da", "#a3d977"),
    voice: { place: "salad bar", places: "salad bars", basket: "bowl", verb: "deliver your greens", product: ["Build your bowl", "Add to bowl"], track: "Your greens are on the way", hello: "Hello", cta: "Place order", empty: "No bowls yet." },
  },
  {
    slug: "smoke-and-grill", title: "Smoke & Grill", tags: ["bbq", "grill", "dark"],
    description: "A charcoal barbecue app with ember-orange accents: bold capitals and slow-smoked plates.",
    brand: { name: "Smoke Grill", mark: "SG", tagline: "Low and slow" },
    style: { radius: "sm", surface: "shadow", upper: true, tracking: 2, weight: "bold", gap: "md", font: "Arial Black" },
    colors: palette("#ff7a18", "#1a1a1a", "#1a1a1a", "#242424", "#2e2e2e", "#f5efe6", "#b5a999", "#3b3b3b", "#ffb347"),
    voice: { place: "pit", places: "pits", basket: "tray", verb: "bring the smoke", product: ["Pick your sides", "Add to tray"], track: "Your tray is on the way", hello: "Your account", cta: "Light it up", empty: "Nothing off the grill yet." },
  },
  {
    slug: "petal-tea-room", title: "Petal Tea Room", tags: ["tea", "cafe"],
    description: "A pastel tea room app: serif italics, centred pages and gentle pink tones.",
    brand: { name: "Petal Tea Room", mark: "PT", tagline: "Steeped with care" },
    style: { radius: "full", surface: "filled", italic: true, weight: "regular", center: true, gap: "lg", font: "Georgia" },
    colors: palette("#c8678e", "#ffffff", "#fff7fa", "#ffffff", "#fbe6ee", "#3d2430", "#8c6877", "#f2d6e1", "#e9a6c1"),
    voice: { place: "tea room", places: "tea rooms", basket: "tray", verb: "pour your tea", product: ["Just how you like it", "Add to tray"], track: "Your tea is on its way", hello: "Welcome back", cta: "Place order", empty: "No cups poured yet." },
  },
  {
    slug: "spice-route", title: "Spice Route", tags: ["indian", "curry"],
    description: "A saffron and deep-red curry house app: rich colour, ruled lists and fragrant dishes.",
    brand: { name: "Spice Route", mark: "SR", tagline: "Slow-cooked, well spiced" },
    style: { radius: "sm", surface: "line", weight: "bold", gap: "md", font: "Palatino Linotype" },
    colors: palette("#d1495b", "#ffffff", "#fffaf2", "#ffffff", "#fbead2", "#3b1f1a", "#86625a", "#efd9c2", "#edae49"),
    voice: { place: "kitchen", places: "kitchens", basket: "order", verb: "send the curry", product: ["Your spice, your way", "Add to order"], track: "Your curry is on its way", hello: "Namaste", cta: "Place order", empty: "No orders yet." },
  },
  {
    slug: "harbour-fish", title: "Harbour Fish", tags: ["seafood", "fish"],
    description: "A navy and sea-teal seafood app: crisp outlines, spaced capitals and the day's catch.",
    brand: { name: "Harbour Fish", mark: "HF", tagline: "Fresh off the boat" },
    style: { radius: "md", surface: "outline", upper: true, tracking: 2, weight: "semibold", gap: "md" },
    colors: palette("#1b998b", "#ffffff", "#f3f8fa", "#ffffff", "#e0eef1", "#0f2a3a", "#55707f", "#c9dde3", "#f6c85f"),
    voice: { place: "harbour shop", places: "harbour shops", basket: "catch", verb: "deliver the catch", product: ["How would you like it?", "Add to catch"], track: "Your catch is on its way", hello: "Ahoy", cta: "Place order", empty: "Nothing caught yet." },
  },
  {
    slug: "juice-junction", title: "Juice Junction", tags: ["juice", "smoothies"],
    description: "A zesty juice bar app in lime and grape: pills, bold type and fresh-pressed cups.",
    brand: { name: "Juice Junction", mark: "JJ", tagline: "Pressed this morning" },
    style: { radius: "full", surface: "card", weight: "bold", gap: "md", font: "Verdana" },
    colors: palette("#7b2ff7", "#ffffff", "#fbfff2", "#ffffff", "#efffd0", "#22163b", "#6b5b86", "#e2f5bd", "#b8f400"),
    voice: { place: "juice bar", places: "juice bars", basket: "cup holder", verb: "squeeze for", product: ["Mix it up", "Add cup"], track: "Your juice is on its way", hello: "Hey there", cta: "Squeeze it", empty: "No juices yet." },
  },
  {
    slug: "burger-yard", title: "Burger Yard", tags: ["burgers", "dark"],
    description: "A yellow-on-black burger joint app: loud capitals, heavy blocks and stacked burgers.",
    brand: { name: "Burger Yard", mark: "BY", tagline: "Stacked high" },
    style: { radius: "md", surface: "filled", upper: true, weight: "bold", gap: "lg", font: "Arial Black" },
    colors: palette("#ffcc00", "#111111", "#111111", "#1d1d1d", "#2a2a2a", "#fafafa", "#a6a6a6", "#333333", "#ff6b00"),
    voice: { place: "yard", places: "yards", basket: "bag", verb: "drop the burgers", product: ["Stack it", "Add to bag"], track: "Your burger is on the way", hello: "Your account", cta: "Get it cooking", empty: "No burgers yet." },
  },
  {
    slug: "dumpling-house", title: "Dumpling House", tags: ["chinese", "dumplings"],
    description: "A lantern-red and cream dumpling house app: centred headings, rounded steamers and baskets.",
    brand: { name: "Dumpling House", mark: "DH", tagline: "Folded by hand" },
    style: { radius: "lg", surface: "shadow", weight: "semibold", center: true, gap: "md" },
    colors: palette("#c1121f", "#fff8e7", "#fff8e7", "#ffffff", "#fbe9c9", "#3a1414", "#8a5b4f", "#f0d8b0", "#e9b44c"),
    voice: { place: "dumpling house", places: "dumpling houses", basket: "steamer", verb: "steam for", product: ["Fill your steamer", "Add to steamer"], track: "Your dumplings are on the way", hello: "Welcome", cta: "Place order", empty: "No dumplings yet." },
  },
  {
    slug: "olive-and-vine", title: "Olive & Vine", tags: ["mediterranean", "restaurant"],
    description: "An olive-green Mediterranean app: serif headings, ruled menus and sun-washed tones.",
    brand: { name: "Olive Vine", mark: "OV", tagline: "From the coast, to your table" },
    style: { radius: "none", surface: "line", weight: "regular", gap: "lg", pad: 20, font: "Georgia" },
    colors: palette("#6b7b3a", "#ffffff", "#faf8f1", "#ffffff", "#efecdc", "#2b2a1e", "#77745f", "#e2dcc6", "#d8a144"),
    voice: { place: "taverna", places: "tavernas", basket: "table", verb: "bring the meze", product: ["Your choices", "Add to table"], track: "Your meze is on the way", hello: "Kalimera", cta: "Place order", empty: "Your table is empty." },
  },
  {
    slug: "sweet-scoop", title: "Sweet Scoop", tags: ["ice cream", "dessert"],
    description: "A mint and bubblegum ice-cream parlour app: round everything, playful and sweet.",
    brand: { name: "Sweet Scoop", mark: "SS", tagline: "One more scoop" },
    style: { radius: "full", surface: "filled", weight: "bold", gap: "md", italic: true },
    colors: palette("#ff6f91", "#ffffff", "#f3fffb", "#ffffff", "#d9f7ee", "#2d1f2b", "#7d6a77", "#c9efe3", "#ffc75f"),
    voice: { place: "parlour", places: "parlours", basket: "cone", verb: "scoop for", product: ["Pick your toppings", "Add to cone"], track: "Your scoops are on the way", hello: "Hi sweet tooth", cta: "Scoop it", empty: "No scoops yet." },
  },
  {
    slug: "morning-crate", title: "Morning Crate", tags: ["breakfast", "brunch"],
    description: "A sky-blue breakfast app: open layouts, friendly cards and brunch delivered.",
    brand: { name: "Morning Crate", mark: "MC", tagline: "Breakfast, sorted" },
    style: { radius: "lg", surface: "card", weight: "bold", gap: "lg", pad: 18 },
    colors: palette("#3a86ff", "#ffffff", "#f5f9ff", "#ffffff", "#e3eeff", "#14213d", "#5c6b85", "#d3e2fb", "#ffbe0b"),
    voice: { place: "brunch spot", places: "brunch spots", basket: "crate", verb: "bring breakfast", product: ["Make it yours", "Add to crate"], track: "Breakfast is on the way", hello: "Good morning", cta: "Place order", empty: "Your crate is empty." },
  },
  {
    slug: "bento-box", title: "Bento Box", tags: ["japanese", "minimal"],
    description: "A black-and-white minimal bento app: spaced capitals, thin lines and calm pages.",
    brand: { name: "Bento Box", mark: "BB", tagline: "Everything in its place" },
    style: { radius: "none", surface: "outline", upper: true, tracking: 3, weight: "regular", center: true, gap: "xl", pad: 24 },
    colors: palette("#111111", "#ffffff", "#ffffff", "#ffffff", "#f2f2f2", "#111111", "#6f6f6f", "#dddddd", "#d62828"),
    voice: { place: "kitchen", places: "kitchens", basket: "box", verb: "deliver", product: ["Arrange it", "Add to box"], track: "Your box is on the way", hello: "Account", cta: "Place order", empty: "Your box is empty." },
  },
  {
    slug: "braai-corner", title: "Braai Corner", tags: ["grill", "south african"],
    description: "An earthy, fire-lit braai app: warm browns, rugged type and meat off the coals.",
    brand: { name: "Braai Corner", mark: "BC", tagline: "Off the coals" },
    style: { radius: "sm", surface: "filled", weight: "bold", upper: true, tracking: 1, gap: "md", font: "Trebuchet MS" },
    colors: palette("#bc4b1e", "#fff6ea", "#fbf3e8", "#ffffff", "#f0e0c8", "#2e1d12", "#7d6450", "#e5d1b3", "#e3a82b"),
    voice: { place: "braai spot", places: "braai spots", basket: "plate", verb: "bring the braai", product: ["Choose your sides", "Add to plate"], track: "Your braai is on the way", hello: "Howzit", cta: "Place order", empty: "Nothing on the coals yet." },
  },
  {
    slug: "vegan-garden", title: "Vegan Garden", tags: ["vegan", "plant-based"],
    description: "A sage and clay plant-based kitchen app: soft shadows, centred calm and fresh bowls.",
    brand: { name: "Vegan Garden", mark: "VG", tagline: "Grown, not made" },
    style: { radius: "lg", surface: "shadow", weight: "medium", center: true, gap: "lg", font: "Verdana" },
    colors: palette("#6a994e", "#ffffff", "#f8faf3", "#ffffff", "#e8efdc", "#1f2b16", "#64705a", "#d8e2c8", "#d58f5a"),
    voice: { place: "garden kitchen", places: "garden kitchens", basket: "basket", verb: "deliver your greens", product: ["Make it yours", "Add to basket"], track: "Your order is growing closer", hello: "Hello friend", cta: "Place order", empty: "Nothing planted yet." },
  },
  {
    slug: "corner-deli", title: "Corner Deli", tags: ["deli", "sandwiches"],
    description: "A mustard and brown-paper deli app: typewriter type, ruled lists and stacked sandwiches.",
    brand: { name: "Corner Deli", mark: "CD", tagline: "Sliced to order" },
    style: { radius: "none", surface: "line", weight: "bold", gap: "md", font: "Courier New" },
    colors: palette("#c98b00", "#1d140a", "#fbf6ea", "#fffdf6", "#f3e6c4", "#2a1e10", "#7a6a50", "#e6d6ae", "#d65a31"),
    voice: { place: "deli", places: "delis", basket: "bag", verb: "send the sandwiches", product: ["Build your sandwich", "Add to bag"], track: "Your sandwich is on the way", hello: "Welcome back", cta: "Place order", empty: "Nothing sliced yet." },
  },
  {
    slug: "night-owl-diner", title: "Night Owl Diner", tags: ["diner", "late night", "dark"],
    description: "A retro late-night diner app in teal and cherry on midnight blue: outlined cards and comfort food.",
    brand: { name: "Night Owl Diner", mark: "NO", tagline: "Open late" },
    style: { radius: "md", surface: "outline", weight: "bold", italic: true, gap: "md", font: "Trebuchet MS" },
    colors: palette("#ff4d6d", "#ffffff", "#0f1b2d", "#17263d", "#1f3250", "#eef3fb", "#9fb0c8", "#2c4466", "#2ec4b6"),
    voice: { place: "diner", places: "diners", basket: "tab", verb: "bring the late-night food", product: ["How do you want it?", "Add to tab"], track: "Your food is on the way", hello: "Hey night owl", cta: "Place order", empty: "Your tab is empty." },
  },
  {
    slug: "pantry-grocer", title: "Pantry Grocer", tags: ["grocery", "essentials"],
    description: "A clean blue grocery app: practical tiles, clear prices and the week's essentials.",
    brand: { name: "Pantry Grocer", mark: "PG", tagline: "The week's shop" },
    style: { radius: "md", surface: "card", weight: "semibold", gap: "sm", pad: 14 },
    colors: palette("#1d4ed8", "#ffffff", "#f7f9fc", "#ffffff", "#e6edfb", "#0f172a", "#5b6478", "#d9e1f2", "#f59e0b"),
    voice: { place: "store", places: "stores", basket: "trolley", verb: "deliver your shop", product: ["Choose your options", "Add to trolley"], track: "Your shop is on the way", hello: "Hi there", cta: "Place order", empty: "Your trolley is empty." },
  },
];
