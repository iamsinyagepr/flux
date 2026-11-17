// Synced from Upskale Studio (upskaleapp/src/lib/studio/storeTemplateKit.ts). Edit it there, then npm run sync.
/**
 * A kit for store templates: five layouts for every page of the storefront
 * flow (and for the header and the bottom navigation), each drawn in a
 * template's own style — its type, casing, corners, surfaces, alignment and
 * spacing. A template is a style plus one layout per page; two templates
 * never pair the same style with the same layouts, so each reads as its own
 * app while running the same storefront: the same data (places, cities,
 * stores, products, optionGroups, cart, orders, addresses) and actions
 * (UseMyLocation, ChoosePlace, ChooseStore, ToggleOption, PlaceOrder, ...)
 * as the hand-made templates in storeTemplatePages.ts.
 */
import {
  CHECKOUT_STATES,
  CHOICE_PRICE,
  FULFILMENT_BADGES,
  GROUP_RULE,
  LOCATE_LABEL,
  LOCATION_PROBLEM,
  MENU_STATES,
  QUANTITY,
  SHOWN,
  STOPPED,
  TOTAL,
  TRACKING_ACTIONS,
  categoryChips,
  deliveryDetails,
  spotTile,
  fields,
  fulfilment,
  menuSearch,
  placeSearch,
  progress,
  status,
  storeSearch,
  storesLoading,
  summary,
  tips,
  type StoreCopy,
  type StorePageBuild,
  type StorePageId,
} from "./storeTemplatePages";

/** How a template draws everything. */
export interface KitStyle {
  /** A font family for its text (falls back to the app font where missing). */
  font?: string;
  /** Headings and labels in capitals. */
  upper?: boolean;
  italic?: boolean;
  weight?: "regular" | "medium" | "semibold" | "bold";
  /** Letter spacing of headings and labels. */
  tracking?: number;
  /** Corner shape of cards and controls. */
  radius: "none" | "sm" | "md" | "lg" | "full";
  /** How a card is set off: a bordered surface, a tinted fill, an outline, a shadow or rules. */
  surface: "card" | "filled" | "outline" | "shadow" | "line";
  /** Centred pages and headings. */
  center?: boolean;
  /** Page side padding, in pixels. */
  pad?: number;
  /** Space between a page's parts. */
  gap?: "sm" | "md" | "lg" | "xl";
}

/** Which of the five layouts each part uses (0 to 4). */
export interface KitLayout {
  header: number;
  nav: number;
  location: number;
  stores: number;
  menu: number;
  product: number;
  cart: number;
  checkout: number;
  orders: number;
  tracking: number;
  account: number;
  addresses: number;
  reset: number;
}

/** What a header shows: the brand, and a short mark for its logo. */
export interface KitBrand {
  name: string;
  mark: string;
  tagline: string;
}

const q = JSON.stringify;
/** Whether a text's extra arguments set its own size or colour. */
const sizes = /(^|[ ,])size:/;
const colors = /(^|[ ,])color:/;

/** The style's drawing helpers. */
function kit(t: KitStyle) {
  const font = t.font ? `, fontFamily: ${q(t.font)}` : "";
  const italic = t.italic ? ", fontStyle: FontStyle.italic" : "";
  const track = t.tracking ? `, letterSpacing: ${t.tracking}` : "";
  const align = t.center ? ", align: TextAlign.center" : "";
  const card = `Radius.${t.radius === "full" ? "xl" : t.radius}`;
  const pill = t.radius === "none" ? "Radius.none" : t.radius === "sm" ? "Radius.sm" : "Radius.full";
  const gap = `Space.${t.gap ?? "md"}`;
  const say = (text: string) => q(t.upper ? text.toUpperCase() : text);
  const surfaced = (extra = "") =>
    ({
      card: `radius: ${card}, background: Color.surface, border: Border(width: 1, color: Color.border)${extra}`,
      filled: `radius: ${card}, background: Color.surfaceAlt${extra}`,
      outline: `radius: ${card}, border: Border(width: 1, color: Color.text)${extra}`,
      shadow: `radius: ${card}, background: Color.surface, shadow: Shadow.md${extra}`,
      line: `${extra.replace(/^, /, "")}`,
    })[t.surface];
  const box = (children: string, padding = "Space.md") =>
    t.surface === "line"
      ? `Column(gap: Space.sm, children: [${children}, Divider()])`
      : `Box(padding: ${padding}, ${surfaced()}, child: Column(gap: Space.sm, children: [${children}]))`;
  const tapBox = (action: string, aria: string, child: string, padding = "Space.md") =>
    t.surface === "line"
      ? `Column(children: [Box(padding: Insets(y: 10), onTap: ${action}, ariaLabel: ${aria}, child: ${child}), Divider()])`
      : `Box(padding: ${padding}, ${surfaced()}, onTap: ${action}, ariaLabel: ${aria}, child: ${child})`;
  return {
    t,
    font,
    say,
    card,
    pill,
    gap,
    alignText: align,
    look: `background: Color.surface, border: Border(width: 1, color: Color.border), radius: ${t.radius === "full" ? "Radius.full" : card}`,
    heading: (text: string, size = "FontSize.xxl") =>
      `Text(child: ${text}, size: ${size}, weight: FontWeight.${t.weight ?? "bold"}${italic}${track}${font}${align}, lineHeight: 1.15)`,
    title: (text: string, extra = "") => `Text(child: ${text}, weight: FontWeight.semibold${font}${extra})`,
    body: (text: string, extra = "") => `Text(child: ${text}${font}${extra})`,
    /** Small muted text; extra may set its own size or colour. */
    muted: (text: string, extra = "") =>
      `Text(child: ${text}${sizes.test(extra) ? "" : ", size: FontSize.sm"}${colors.test(extra) ? "" : ", color: Color.textMuted"}${font}${extra})`,
    label: (text: string, color = "Color.textMuted", centred = false) =>
      `Text(child: ${text}, size: FontSize.xs, weight: FontWeight.bold, letterSpacing: ${Math.max(2, t.tracking ?? 2)}, color: ${color}${font}${centred ? ", align: TextAlign.center" : ""})`,
    box,
    tapBox,
    page: (children: string, pad = t.pad ?? 16) =>
      `Column(gap: ${gap}, padding: Insets(x: ${pad}, y: 8), children: [
      ${children}
    ])`,
    /** A full-width action: primary fill, or the style's outline. */
    action: (label: string, action: string, aria: string, filled = true) =>
      `Box(padding: Insets(x: 16, y: 14), radius: ${pill}, alignment: Anchor.center, ${filled ? "background: Color.primary" : "border: Border(width: 1, color: Color.primary)"}, onTap: ${action}, ariaLabel: ${q(aria)}, child: Text(child: ${label}, weight: FontWeight.semibold${track}${font}, color: ${filled ? "Color.primaryInk" : "Color.primary"}))`,
    /** A mark at the head of a page: centred on a centred page. */
    lead: (mark: string) => (t.center ? `Row(mainAxisAlignment: MainAxisAlignment.center, children: [${mark}])` : mark),
    circle: (icon: string, size = 48, fill = "Color.surfaceAlt", ink = "Color.primary") =>
      `Box(shape: BoxShape.circle, width: ${size}, height: ${size}, alignment: Anchor.center, background: ${fill}, child: Icon(name: Icons.${icon}, color: ${ink}))`,
    chip: (text: string, selected: string, action: string) =>
      `Box(padding: Insets(x: 14, y: 8), radius: ${pill}, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: ${action}, ariaLabel: ${text}, child: Text(child: ${text}, size: FontSize.sm, weight: FontWeight.semibold${font}, color: ${selected} ? Color.primaryInk : Color.text))`,
    divider: "Divider()",
  };
}
type Kit = ReturnType<typeof kit>;

// --- header and bottom navigation ---------------------------------------------

const cartBadge = (_K: Kit, icon = "Color.text") =>
  `Stack(width: 44, height: 44, children: [
        Positioned(top: 2, left: 2, child: Box(shape: BoxShape.circle, width: 40, height: 40, alignment: Anchor.center, onTap: Navigate(to: Route.cart), ariaLabel: "Cart", child: Icon(name: Icons.cart, color: ${icon}))),
        Positioned(top: 0, right: 0, child: If(condition: cartCount > 0, then: Box(shape: BoxShape.circle, width: 18, height: 18, alignment: Anchor.center, background: Color.primary, child: Text(child: cartCount, size: FontSize.xs, weight: FontWeight.bold, color: Color.primaryInk))))
      ])`;
const storeLine = (K: Kit, fallback: string) =>
  `If(condition: store.name, then: ${K.muted("store.name", ", size: FontSize.xs")}, else: ${K.muted(q(fallback), ", size: FontSize.xs")})`;

const headers: ((K: Kit, b: KitBrand) => string)[] = [
  // A round mark, the brand over the chosen store, and the cart.
  (K, b) => `Box(padding: Insets(x: 16, y: 10), background: Color.background, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, background: Color.primary, child: Text(child: ${q(b.mark)}, size: FontSize.xs, weight: FontWeight.bold, color: Color.primaryInk)),
      Expanded(child: Column(children: [${K.title(K.say(b.name), ", size: FontSize.lg")}, ${storeLine(K, b.tagline)}])),
      ${cartBadge(K, "Color.primary")}
    ]))`,
  // A centred wordmark over its tagline, a rule beneath.
  (K, b) => `Column(gap: Space.xs, align: Align.center, padding: Insets(x: 16, y: 14), children: [
      Row(children: [Box(width: 44), Expanded(child: Text(child: ${q(b.name.toUpperCase())}, size: FontSize.xl, weight: FontWeight.bold, letterSpacing: 5, align: TextAlign.center${K.font})), ${cartBadge(K)}]),
      ${K.muted(q(b.tagline), ", size: FontSize.xs, fontStyle: FontStyle.italic, align: TextAlign.center")},
      Divider()
    ])`,
  // A two-tone wordmark on a primary band.
  (K, b) => {
    const [first, ...rest] = b.name.split(" ");
    return `Box(padding: Insets(x: 16, y: 12), background: Color.primary, child: Row(gap: Space.xs, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Text(child: ${q(first.toUpperCase())}, size: FontSize.xl, weight: FontWeight.bold, letterSpacing: 1, color: Color.primaryInk${K.font}),
      Expanded(child: Text(child: ${q(rest.join(" ").toUpperCase())}, size: FontSize.xl, weight: FontWeight.regular, letterSpacing: 1, color: Color.primaryInk${K.font})),
      ${cartBadge(K, "Color.primaryInk")}
    ]))`;
  },
  // A square mark, the brand and where it's ordering from, account and cart.
  (K, b) => `Box(padding: Insets(x: 16, y: 10), background: Color.surface, border: Border(width: 1, color: Color.border), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Box(width: 38, height: 38, radius: Radius.sm, alignment: Anchor.center, border: Border(width: 2, color: Color.primary), child: Text(child: ${q(b.mark)}, size: FontSize.sm, weight: FontWeight.bold, color: Color.primary)),
      Expanded(child: Column(children: [${K.title(q(b.name))}, Row(gap: Space.xs, children: [Icon(name: Icons.location, size: Size.sm, color: Color.textMuted), Expanded(child: ${storeLine(K, b.tagline)})])])),
      Box(shape: BoxShape.circle, width: 40, height: 40, alignment: Anchor.center, onTap: Navigate(to: Route.account), ariaLabel: "Account", child: Icon(name: Icons.user)),
      ${cartBadge(K)}
    ]))`,
  // A slide-out menu, the brand centred, the cart.
  (K, b) => `Box(padding: Insets(x: 12, y: 10), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
      Drawer(side: Side.left, trigger: TriggerButton(icon: Icons.menu, ariaLabel: "Open menu", style: ButtonStyle.ghost), child: Column(padding: Space.lg, gap: Space.md, children: [
        Text(child: ${q(b.name)}, size: FontSize.xl, weight: FontWeight.bold, color: Color.primary${K.font}),
        ${K.muted(q(b.tagline))},
        Button(label: "Menu", style: ButtonStyle.ghost, icon: Icons.home, onTap: Navigate(to: Route.menu)),
        Button(label: "Stores", style: ButtonStyle.ghost, icon: Icons.location, onTap: Navigate(to: Route.stores)),
        Button(label: "Orders", style: ButtonStyle.ghost, icon: Icons.orders, onTap: Navigate(to: Route.orders)),
        Button(label: "Account", style: ButtonStyle.ghost, icon: Icons.user, onTap: Navigate(to: Route.account))
      ])),
      Expanded(child: Text(child: ${q(b.name)}, size: FontSize.lg, weight: FontWeight.bold, align: TextAlign.center${K.font})),
      ${cartBadge(K, "Color.primary")}
    ]))`,
];

const TABS: [route: string, icon: string, label: string][] = [
  ["menu", "home", "Menu"],
  ["cart", "cart", "Cart"],
  ["orders", "orders", "Orders"],
  ["account", "user", "Account"],
];
const on = (route: string) => `isCurrentRoute(Route.${route})`;
const navs: ((K: Kit) => string)[] = [
  // Icons in a soft capsule when current, labels beneath.
  (K) => `Box(padding: Insets(x: 8, y: 8), background: Color.surface, border: Border(width: 1, color: Color.border), child: Row(children: [
      ${TABS.map(([r, icon, label]) => `Expanded(child: Box(padding: Insets(y: 4), alignment: Anchor.center, onTap: Navigate(to: Route.${r}), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [Box(padding: Insets(x: 16, y: 4), radius: ${K.pill}, background: ${on(r)} ? Color.surfaceAlt : Color.surface, child: Icon(name: Icons.${icon}, color: ${on(r)} ? Color.primary : Color.textMuted)), Text(child: "${label}", size: FontSize.xs${K.font}, color: ${on(r)} ? Color.primary : Color.textMuted)])))`).join(",\n      ")}
    ]))`,
  // Words only, an underline under the current one.
  (K) => `Column(children: [Divider(), Box(padding: Insets(x: 12, y: 12), background: Color.background, child: Row(children: [
      ${TABS.map(([r, , label]) => `Expanded(child: Box(padding: Insets(y: 4), alignment: Anchor.center, onTap: Navigate(to: Route.${r}), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [Text(child: "${label.toUpperCase()}", size: FontSize.xs, letterSpacing: 2${K.font}, color: ${on(r)} ? Color.text : Color.textMuted), Box(width: 20, height: 2, background: ${on(r)} ? Color.primary : Color.background)])))`).join(",\n      ")}
    ]))])`,
  // A dock: the current tab a filled pill with its label.
  (K) => `Box(padding: Insets(x: 12, y: 10), background: Color.surface, child: Row(gap: Space.xs, children: [
      ${TABS.map(([r, icon, label]) => `Expanded(child: Box(padding: Insets(y: 10), radius: ${K.pill}, alignment: Anchor.center, background: ${on(r)} ? Color.primary : Color.surface, onTap: Navigate(to: Route.${r}), ariaLabel: "${label}", child: Row(gap: Space.xs, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.${icon}, size: Size.sm, color: ${on(r)} ? Color.primaryInk : Color.textMuted), If(condition: ${on(r)}, then: Text(child: "${label}", size: FontSize.xs, weight: FontWeight.bold, color: Color.primaryInk))])))`).join(",\n      ")}
    ]))`,
  // Icons over labels; the cart carries its count.
  (K) => `Box(padding: Insets(x: 8, y: 8), background: Color.background, border: Border(width: 1, color: Color.border), child: Row(children: [
      ${TABS.map(([r, icon, label]) => `Expanded(child: Box(padding: Insets(y: 6), alignment: Anchor.center, onTap: Navigate(to: Route.${r}), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [${r === "cart" ? `Row(gap: Space.xs, mainAxisAlignment: MainAxisAlignment.center, children: [Icon(name: Icons.cart, color: ${on(r)} ? Color.primary : Color.textMuted), If(condition: cartCount > 0, then: Badge(label: cartCount, tone: Tone.primary))])` : `Icon(name: Icons.${icon}, color: ${on(r)} ? Color.primary : Color.textMuted)`}, Text(child: "${label}", size: FontSize.xs, weight: ${on(r)} ? FontWeight.bold : FontWeight.regular${K.font}, color: ${on(r)} ? Color.primary : Color.textMuted)])))`).join(",\n      ")}
    ]))`,
  // A primary band of white icons, a dot under the current one.
  (_K) => `Box(padding: Insets(x: 8, y: 10), background: Color.primary, child: Row(children: [
      ${TABS.map(([r, icon, label]) => `Expanded(child: Box(padding: Insets(y: 4), alignment: Anchor.center, onTap: Navigate(to: Route.${r}), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.${icon}, color: Color.primaryInk), Box(shape: BoxShape.circle, width: 6, height: 6, background: ${on(r)} ? Color.primaryInk : Color.primary)])))`).join(",\n      ")}
    ]))`,
];

// --- pages ------------------------------------------------------------------------

type Page = (K: Kit, c: StoreCopy, b: KitBrand) => StorePageBuild;

const placeRow = (K: Kit, icon = true) =>
  `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [${icon ? "Icon(name: Icons.location, size: Size.sm, color: Color.primary), " : ""}Expanded(child: Column(children: [${K.body("place.main_text", ", weight: FontWeight.semibold")}, ${K.muted("place.secondary_text", ", size: FontSize.xs")}])), Icon(name: Icons.chevronRight, size: Size.sm, color: Color.textMuted)])`;
const cityTap = (_K: Kit, child: string, extra: string) =>
  `ForEach(items: cities, as: "city", child: Box(${extra}, onTap: ChooseCity(city: city), ariaLabel: city.name, child: ${child}))`;

const locations: Page[] = [
  // A round icon, the question, everything in one card, cities as chips.
  (K, c) => ({
    build: K.page(`${K.lead(K.circle("location", 64))},
      ${K.heading(K.say(c.location[0]))},
      ${K.muted(q(c.location[1]), K.alignText)},
      ${K.box(`${K.action(LOCATE_LABEL, "UseMyLocation()", "Use my current location")},
        ${LOCATION_PROBLEM},
        ${placeSearch(K.look)},
        ForEach(items: places, as: "place", child: Box(padding: Insets(x: 12, y: 10), radius: ${K.card}, background: Color.surfaceAlt, onTap: ChoosePlace(place: place), ariaLabel: place.label, child: ${placeRow(K)}))`)},
      If(condition: cities.length > 0, then: Column(gap: Space.sm, children: [${K.label(K.say("Or choose a city"))}, ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.sm, children: [${cityTap(K, K.body("city.name", ", size: FontSize.sm"), `padding: Insets(x: 14, y: 8), radius: ${K.pill}, border: Border(width: 1, color: Color.border)`)}]))])),
      If(condition: location, then: ${K.muted('"Ordering to ${location.label}"', K.alignText)})`),
  }),
  // Numbered steps: your location, or a search; cities as links.
  (K, c) => ({
    build: K.page(`${K.label(K.say("Step 1 of 2"))},
      ${K.heading(K.say(c.location[0]))},
      ${K.muted(q(c.location[1]), K.alignText)},
      Divider(),
      Box(padding: Insets(y: 8), onTap: UseMyLocation(), ariaLabel: "Use my current location", child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [${K.heading('"1"', "FontSize.lg")}, Expanded(child: ${K.body(LOCATE_LABEL)}), Icon(name: Icons.chevronRight, color: Color.primary)])),
      ${LOCATION_PROBLEM},
      Divider(),
      Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [${K.heading('"2"', "FontSize.lg")}, Expanded(child: ${placeSearch(K.look)})]),
      ForEach(items: places, as: "place", child: Column(children: [Box(padding: Insets(y: 10), onTap: ChoosePlace(place: place), ariaLabel: place.label, child: ${placeRow(K, false)}), Divider()])),
      If(condition: cities.length > 0, then: Column(gap: Space.xs, children: [${K.label(K.say("Or by city"))}, ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.md, children: [${cityTap(K, K.body("city.name", ", color: Color.primary, fontStyle: FontStyle.italic"), "padding: Insets(y: 4)")}]))]))`),
  }),
  // A primary banner, a full-width button, results with a coloured edge.
  (K, c) => ({
    build: K.page(`Box(padding: Space.xl, radius: ${K.card}, gradient: Gradient(from: Color.primary, to: Color.warning, begin: Anchor.topLeft, end: Anchor.bottomRight), child: Column(gap: Space.sm, children: [${K.label(K.say("Delivery"), "Color.primaryInk")}, Text(child: ${K.say(c.location[0])}, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primaryInk${K.font})])),
      ${K.muted(q(c.location[1]))},
      ${K.action(LOCATE_LABEL, "UseMyLocation()", "Use my current location")},
      ${LOCATION_PROBLEM},
      ${placeSearch(K.look)},
      ForEach(items: places, as: "place", child: Box(padding: Space.md, radius: ${K.card}, background: Color.surface, onTap: ChoosePlace(place: place), ariaLabel: place.label, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 4, height: 32, radius: Radius.full, background: Color.primary), Expanded(child: Column(children: [${K.body("place.main_text", ", weight: FontWeight.bold")}, ${K.muted("place.secondary_text", ", size: FontSize.xs")}])), Icon(name: Icons.chevronRight, color: Color.primary)]))),
      If(condition: cities.length > 0, then: ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.sm, children: [${cityTap(K, K.body("city.name", ", weight: FontWeight.semibold"), `padding: Space.md, radius: ${K.card}, border: Border(width: 1, color: Color.primary)`)}])))`),
  }),
  // Two tiles: your location, or same-day from the nearest store; a search below.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.location[0]))},
      ${K.muted(q(c.location[1]), K.alignText)},
      Grid(cols: 2, gap: Space.sm, children: [
        Box(padding: Space.md, radius: ${K.card}, background: Color.primary, onTap: UseMyLocation(), ariaLabel: "Use my current location", child: Column(gap: Space.xs, children: [Icon(name: Icons.location, color: Color.primaryInk), Text(child: ${LOCATE_LABEL}, size: FontSize.sm, weight: FontWeight.semibold, color: Color.primaryInk${K.font})])),
        Box(padding: Space.md, radius: ${K.card}, background: Color.surfaceAlt, child: Column(gap: Space.xs, children: [Icon(name: Icons.search, color: Color.primary), ${K.muted('"Or search below"')}]))
      ]),
      ${LOCATION_PROBLEM},
      ${placeSearch(K.look)},
      ForEach(items: places, as: "place", child: ${K.tapBox("ChoosePlace(place: place)", "place.label", placeRow(K))}),
      If(condition: cities.length > 0, then: ${K.box(`${K.title(K.say("Shop by city"))}, ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.sm, children: [${cityTap(K, K.body("city.name", ", size: FontSize.sm, color: Color.primary"), `padding: Insets(x: 12, y: 6), radius: ${K.pill}, background: Color.surfaceAlt`)}]))`)})`),
  }),
  // Quiet and centred: an outlined button, results between rules.
  (K, c) => ({
    build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${K.label(K.say("Where to"), "Color.primary", true)},
      Text(child: ${K.say(c.location[0])}, size: FontSize.xxl, align: TextAlign.center${K.font}),
      ${K.muted(q(c.location[1]), ", align: TextAlign.center")},
      ${K.action(LOCATE_LABEL, "UseMyLocation()", "Use my current location", false)},
      ${LOCATION_PROBLEM},
      ${placeSearch(K.look)},
      ForEach(items: places, as: "place", child: Column(gap: Space.sm, children: [Box(padding: Insets(y: 6), onTap: ChoosePlace(place: place), ariaLabel: place.label, child: Column(gap: Space.xs, align: Align.center, children: [${K.body("place.main_text", ", align: TextAlign.center")}, ${K.muted("place.secondary_text", ", size: FontSize.xs, align: TextAlign.center")}])), Box(height: 1, background: Color.border)])),
      If(condition: cities.length > 0, then: ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.sm, children: [${cityTap(K, K.body("city.name", ", size: FontSize.sm"), `padding: Insets(x: 14, y: 6), radius: Radius.full, border: Border(width: 1, color: Color.border)`)}])))
    ])`,
  }),
];

const changeLocation = (_K: Kit, child: string) =>
  `If(condition: location, then: Box(onTap: Navigate(to: Route.location), ariaLabel: "Change location", child: ${child}))`;
const noStores = (K: Kit, _c: StoreCopy) =>
  `Column(gap: Space.sm, children: [${K.muted('"No stores found here yet."')}, Button(label: "Show every store", style: ButtonStyle.secondary, onTap: SearchStores(query: ""))])`;
const openNow = 'shop.is_open ? "Open now" : "Closed"';

const storesPages: Page[] = [
  // Cards with a round icon, name, city and whether it's open.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.stores[0]))},
      ${K.muted(q(c.stores[1]), K.alignText)},
      ${changeLocation(K, `Row(gap: Space.xs, children: [Icon(name: Icons.location, size: Size.sm, color: Color.primary), ${K.muted("location.label")}, ${K.muted('"· change"', ", color: Color.primary")}])`)},
      ${storeSearch(K.look)},
      ${storesLoading()},
      ForEach(items: stores, as: "shop", child: ${K.tapBox("ChooseStore(store: shop)", "shop.name", `Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [${K.circle("home", 44)}, Expanded(child: Column(gap: Space.xs, children: [${K.title("shop.name")}, Wrap(spacing: Space.xs, children: [${K.muted("shop.city")}, ${K.muted(openNow)}])])), Icon(name: Icons.chevronRight, color: Color.textMuted)])`)}, empty: ${noStores(K, c)})`),
  }),
  // A ruled list: the name large, the address beneath, open or closed at the side.
  (K, c) => ({
    build: K.page(`${K.label(K.say("Step 2 of 2"))},
      ${K.heading(K.say(c.stores[0]))},
      ${changeLocation(K, K.muted('"Near ${location.label}. Change"', ", fontStyle: FontStyle.italic"))},
      ${storeSearch(K.look)},
      ${storesLoading()},
      Divider(),
      ForEach(items: stores, as: "shop", child: Column(children: [Box(padding: Insets(y: 12), onTap: ChooseStore(store: shop), ariaLabel: shop.name, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Column(gap: Space.xs, children: [${K.body("shop.name", ", size: FontSize.lg")}, ${K.muted("shop.address_line1", ", fontStyle: FontStyle.italic")}])), Text(child: shop.is_open ? "OPEN" : "CLOSED", size: FontSize.xs, letterSpacing: 2, color: shop.is_open ? Color.success : Color.textMuted)])), Divider()]), empty: ${noStores(K, c)})`),
  }),
  // Big cards with a primary strip to order from.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.stores[0]))},
      Box(width: 56, height: 6, radius: Radius.full, background: Color.primary),
      ${changeLocation(K, `Row(gap: Space.xs, children: [Icon(name: Icons.location, size: Size.sm, color: Color.primary), ${K.body("location.label", ", weight: FontWeight.bold")}])`)},
      ${storeSearch(K.look)},
      ${storesLoading()},
      ForEach(items: stores, as: "shop", child: Box(radius: ${K.card}, background: Color.surface, border: Border(width: 1, color: Color.border), onTap: ChooseStore(store: shop), ariaLabel: shop.name, child: Column(children: [
        Box(padding: Space.md, child: Column(gap: Space.xs, children: [Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: ${K.title("shop.name", ", size: FontSize.lg")}), Badge(label: ${openNow}, tone: shop.is_open ? Tone.success : Tone.neutral)]), ${K.muted("shop.description")}])),
        Box(padding: Insets(x: 16, y: 10), background: Color.primary, child: Text(child: ${K.say(c.stores[2])}, size: FontSize.sm, weight: FontWeight.bold, color: Color.primaryInk${K.font}))
      ])), empty: ${noStores(K, c)})`),
  }),
  // Tiles with the delivery fee, minimum and preparation time.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.stores[0]))},
      ${K.muted(q(c.stores[1]), K.alignText)},
      ${changeLocation(K, K.box(`Row(gap: Space.sm, children: [Icon(name: Icons.location, color: Color.primary), Expanded(child: Column(children: [${K.muted('"Delivering to"', ", size: FontSize.xs")}, ${K.title("location.label")}]))])`))},
      ${storeSearch(K.look)},
      ${storesLoading()},
      ForEach(items: stores, as: "shop", child: ${K.tapBox("ChooseStore(store: shop)", "shop.name", `Column(gap: Space.sm, children: [
        Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: ${K.title("shop.name")}), Badge(label: shop.is_open ? "Open" : "Closed", tone: shop.is_open ? Tone.success : Tone.neutral)]),
        Grid(cols: 3, gap: Space.xs, children: [
          Box(padding: Space.xs, radius: Radius.sm, background: Color.surfaceAlt, child: Column(children: [${K.muted('"Delivery"', ", size: FontSize.xs")}, ${K.body("formatMoney(shop.delivery_fee_cents)", ", size: FontSize.sm, weight: FontWeight.semibold")}])),
          Box(padding: Space.xs, radius: Radius.sm, background: Color.surfaceAlt, child: Column(children: [${K.muted('"Minimum"', ", size: FontSize.xs")}, ${K.body("formatMoney(shop.min_order_cents)", ", size: FontSize.sm, weight: FontWeight.semibold")}])),
          Box(padding: Space.xs, radius: Radius.sm, background: Color.surfaceAlt, child: Column(children: [${K.muted('"Ready in"', ", size: FontSize.xs")}, ${K.body('"${shop.prep_time_minutes} min"', ", size: FontSize.sm, weight: FontWeight.semibold")}]))
        ])
      ])`)}, empty: ${noStores(K, c)})`),
  }),
  // Centred frames: the name spaced out, the rating, open or closed.
  (K, c) => ({
    build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${K.label(K.say("Choose"), "Color.primary", true)},
      Text(child: ${K.say(c.stores[0])}, size: FontSize.xxl, align: TextAlign.center${K.font}),
      ${changeLocation(K, K.muted("location.label", ", align: TextAlign.center"))},
      ${storeSearch(K.look)},
      ${storesLoading("Color.primary")},
      ForEach(items: stores, as: "shop", child: Box(padding: Space.lg, radius: ${K.card}, border: Border(width: 1, color: Color.border), onTap: ChooseStore(store: shop), ariaLabel: shop.name, child: Column(gap: Space.sm, align: Align.center, children: [
        Text(child: shop.name, size: FontSize.lg, letterSpacing: 2, align: TextAlign.center${K.font}),
        ${K.muted("shop.city", ", align: TextAlign.center")},
        If(condition: shop.rating, then: Row(gap: Space.xs, mainAxisAlignment: MainAxisAlignment.center, children: [Icon(name: Icons.star, size: Size.sm, color: Color.primary), Text(child: shop.rating, size: FontSize.sm, color: Color.primary)])),
        Text(child: shop.is_open ? "OPEN" : "CLOSED", size: FontSize.xs, letterSpacing: 3, color: shop.is_open ? Color.primary : Color.textMuted)
      ])), empty: ${noStores(K, c)})
    ])`,
  }),
];

/** "All" and the categories, in a row that scrolls sideways however many there are. */
const menuChips = (K: Kit, chip: (text: string, selected: string, action: string) => string, gap = "Space.sm") =>
  `ScrollView(direction: Axis.horizontal, label: "Categories", child: Row(gap: ${gap}, children: [
        ${categoryChips(chip, K.say("All"))}
      ]))`;
const underlineTab = (K: Kit) => (text: string, selected: string, action: string) =>
  `Box(padding: Insets(y: 4), onTap: ${action}, ariaLabel: ${text}, child: Column(gap: Space.xs, children: [Text(child: ${text}, size: FontSize.sm, weight: FontWeight.semibold${K.font}, color: ${selected} ? Color.text : Color.textMuted), Box(width: 24, height: 2, background: ${selected} ? Color.primary : Color.background)]))`;
const open = (_item: string) => `OpenProduct(product: item)`;

const menus: Page[] = [
  // A greeting card, chips, two cards to a row.
  (K) => ({
    states: MENU_STATES,
    build: K.page(`${K.box(`${K.heading("store.name")}, ${K.muted('store.is_open ? "Open now." : "Closed right now. You can still browse."')}, If(condition: store.prep_time_minutes, then: ${K.muted('"Ready in about ${store.prep_time_minutes} minutes."')}), ${FULFILMENT_BADGES}`, "Space.lg")},
      ${menuSearch(K.look)},
      ${menuChips(K, K.chip)},
      Grid(cols: 2, gap: Space.md, children: [ForEach(items: ${SHOWN}, as: "item", child: Column(gap: Space.sm, children: [
        Box(onTap: ${open("item")}, ariaLabel: item.name, child: Column(gap: Space.xs, children: [Image(src: item.image_url, alt: item.name, aspectRatio: 1, radius: ${K.card}), ${K.title("item.name")}, ${K.muted("formatMoney(item.display_price_cents)")}])),
        Box(padding: Insets(y: 8), radius: ${K.pill}, alignment: Anchor.center, background: Color.surfaceAlt, onTap: AddToCart(product: item), ariaLabel: "Add \${item.name}", child: Text(child: "Add", size: FontSize.sm, weight: FontWeight.semibold, color: Color.primary))
      ]))])`),
  }),
  // The store in a ruled box, tabs, a list with pictures at the side.
  (K) => ({
    states: MENU_STATES,
    build: K.page(`Box(padding: Space.md, border: Border(width: 1, color: Color.text), child: Column(gap: Space.xs, children: [${K.heading("store.name", "FontSize.xl")}, ${K.muted("store.address_line1")}, ${K.body('store.is_open ? "Open now" : "Closed right now"', ", size: FontSize.sm, color: store.is_open ? Color.success : Color.danger")}, ${FULFILMENT_BADGES}])),
      ${menuChips(K, underlineTab(K), "Space.md")},
      ${menuSearch(K.look)},
      Divider(),
      ForEach(items: ${SHOWN}, as: "item", child: Column(gap: Space.md, children: [Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Box(width: 76, onTap: ${open("item")}, ariaLabel: item.name, child: Image(src: item.image_url, alt: item.name, aspectRatio: 1, radius: ${K.card})),
        Expanded(child: Box(onTap: ${open("item")}, ariaLabel: item.name, child: Column(gap: Space.xs, children: [${K.title("item.name")}, ${K.muted("item.description")}, ${K.body("formatMoney(item.display_price_cents)", ", color: Color.primary")}]))),
        Button(label: "Add", style: ButtonStyle.secondary, size: Size.sm, onTap: AddToCart(product: item))
      ]), Divider()]), empty: ${K.muted('"Nothing matches."')})`),
  }),
  // A gradient banner, the fee and minimum, big single cards.
  (K) => ({
    states: MENU_STATES,
    build: K.page(`Box(padding: Space.lg, radius: ${K.card}, gradient: Gradient(from: Color.primary, to: Color.warning, begin: Anchor.topLeft, end: Anchor.bottomRight), child: Column(gap: Space.xs, children: [Text(child: store.is_open ? "OPEN NOW" : "CLOSED", size: FontSize.xs, weight: FontWeight.bold, letterSpacing: 2, color: Color.primaryInk), Text(child: store.name, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primaryInk${K.font})])),
      Row(gap: Space.sm, children: [
        Expanded(child: ${K.box(`${K.muted('"Delivery"', ", size: FontSize.xs")}, ${K.title("formatMoney(store.delivery_fee_cents)")}`)}),
        Expanded(child: ${K.box(`${K.muted('"Minimum"', ", size: FontSize.xs")}, ${K.title("formatMoney(store.min_order_cents)")}`)})
      ]),
      ${menuSearch(K.look)},
      ${menuChips(K, K.chip)},
      ForEach(items: ${SHOWN}, as: "item", child: Box(radius: ${K.card}, background: Color.surface, border: Border(width: 1, color: Color.border), child: Column(children: [
        Box(onTap: ${open("item")}, ariaLabel: item.name, child: Stack(children: [Image(src: item.image_url, alt: item.name, aspectRatio: 1.8, radius: ${K.card}), Positioned(top: 10, left: 10, child: Box(padding: Insets(x: 10, y: 4), radius: Radius.full, background: Color.primary, child: Text(child: formatMoney(item.display_price_cents), size: FontSize.sm, weight: FontWeight.bold, color: Color.primaryInk)))])),
        Box(padding: Space.md, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Column(gap: Space.xs, children: [${K.title("item.name", ", size: FontSize.lg")}, ${K.muted("item.description")}])), Box(width: 44, height: 44, radius: ${K.card}, alignment: Anchor.center, background: Color.primary, onTap: AddToCart(product: item), ariaLabel: "Add \${item.name}", child: Icon(name: Icons.plus, color: Color.primaryInk))]))
      ])), empty: ${K.muted('"Nothing matches."')})`),
  }),
  // Three facts, chips with ticks, three small tiles to a row.
  (K) => ({
    states: MENU_STATES,
    build: K.page(`Grid(cols: 3, gap: Space.sm, children: [
        Box(padding: Space.sm, radius: ${K.card}, background: Color.surfaceAlt, child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.clock, color: Color.primary), Text(child: store.is_open ? "Open" : "Closed", size: FontSize.sm, weight: FontWeight.semibold, align: TextAlign.center)])),
        Box(padding: Space.sm, radius: ${K.card}, background: Color.surfaceAlt, child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.location, color: Color.primary), Text(child: formatMoney(store.delivery_fee_cents), size: FontSize.sm, weight: FontWeight.semibold, align: TextAlign.center)])),
        Box(padding: Space.sm, radius: ${K.card}, background: Color.surfaceAlt, child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.star, color: Color.primary), Text(child: store.rating, size: FontSize.sm, weight: FontWeight.semibold, align: TextAlign.center)]))
      ]),
      ${K.heading("store.name", "FontSize.xl")},
      ${menuSearch(K.look)},
      ${menuChips(K, (text, selected, action) => `Box(padding: Insets(x: 12, y: 8), radius: ${K.pill}, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), onTap: ${action}, ariaLabel: ${text}, child: Row(gap: Space.xs, children: [If(condition: ${selected}, then: Icon(name: Icons.check, size: Size.sm, color: Color.primary)), Text(child: ${text}, size: FontSize.sm, weight: FontWeight.semibold)]))`)},
      Grid(cols: 3, gap: Space.sm, children: [ForEach(items: ${SHOWN}, as: "item", child: ${K.box(`Box(onTap: ${open("item")}, ariaLabel: item.name, child: Column(gap: Space.xs, children: [Image(src: item.image_url, alt: item.name, aspectRatio: 1, radius: Radius.sm), Text(child: item.name, size: FontSize.sm, weight: FontWeight.semibold${K.font}), Text(child: formatMoney(item.display_price_cents), size: FontSize.sm, weight: FontWeight.bold, color: Color.primary)])), Button(label: "Add", size: Size.sm, fullWidth: true, onTap: AddToCart(product: item))`, "Space.sm")})])`),
  }),
  // A quiet centred heading, spaced tabs, a centred two-column grid.
  (K) => ({
    states: MENU_STATES,
    build: K.page(`Column(gap: Space.xs, align: Align.center, children: [${K.label(K.say("Menu"), "Color.primary")}, Text(child: store.name, size: FontSize.xxl, align: TextAlign.center${K.font}), ${K.muted('store.is_open ? "Open now" : "Closed right now"', ", align: TextAlign.center")}]),
      ScrollView(direction: Axis.horizontal, label: "Categories", child: Row(gap: Space.lg, children: [
        ${categoryChips((text, selected, action) => `Box(padding: Insets(y: 4), onTap: ${action}, ariaLabel: ${text}, child: Column(gap: Space.xs, align: Align.center, children: [Text(child: ${text}, size: FontSize.xs, letterSpacing: 3${K.font}, color: ${selected} ? Color.primary : Color.textMuted), Box(width: 16, height: 1, background: ${selected} ? Color.primary : Color.background)]))`, K.say("All"))}
      ])),
      ${menuSearch(K.look)},
      Grid(cols: 2, gap: Space.lg, children: [ForEach(items: ${SHOWN}, as: "item", child: Column(gap: Space.sm, align: Align.center, children: [
        Box(onTap: ${open("item")}, ariaLabel: item.name, child: Column(gap: Space.xs, align: Align.center, children: [Image(src: item.image_url, alt: item.name, aspectRatio: 1, radius: ${K.card}), Text(child: item.name, align: TextAlign.center${K.font}), Text(child: formatMoney(item.display_price_cents), size: FontSize.sm, letterSpacing: 1, color: Color.primary)])),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, border: Border(width: 1, color: Color.primary), onTap: AddToCart(product: item), ariaLabel: "Add \${item.name}", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primary))
      ]))])`, 16),
  }),
];

const back = (K: Kit) => `Button(label: ${K.say("Back to the menu")}, style: ButtonStyle.ghost, icon: Icons.chevronLeft, onTap: Navigate(to: Route.menu))`;
const productTotal = "formatMoney((product.display_price_cents + configuration.addon_price_cents) * state.quantity)";
const fewer = 'SetState(state: "quantity", value: state.quantity > 1 ? state.quantity - 1 : 1)';
const more = 'SetState(state: "quantity", value: state.quantity + 1)';
const choiceTap = (child: string, extra = "padding: Insets(y: 6)") =>
  `Box(${extra}, onTap: ToggleOption(group: group.id, choice: choice.id), ariaLabel: choice.label, child: ${child})`;
const choiceText = (K: Kit) => K.body("choice.label", ", color: choice.disabled ? Color.textMuted : Color.text");

const products: Page[] = [
  // Radio circles in cards, round steppers, the total on the button.
  (K, c) => ({
    states: QUANTITY,
    build: K.page(`${back(K)},
      If(condition: product != null, then: Column(gap: Space.lg, children: [
        Image(src: product.image_url, alt: product.name, aspectRatio: 1.2, radius: ${K.card}),
        ${K.heading("product.name")},
        ${K.muted("product.description", K.alignText)},
        ForEach(items: optionGroups, as: "group", child: Box(padding: Insets(left: group.depth > 0 ? 16 : 0), child: ${K.box(`Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: ${K.title("group.label")}), If(condition: group.required, then: Badge(label: "Required", tone: Tone.warning)), ${K.muted(GROUP_RULE, ", size: FontSize.xs")}]),
          ForEach(items: group.choices, as: "choice", child: ${choiceTap(`Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(shape: BoxShape.circle, width: 22, height: 22, alignment: Anchor.center, border: Border(width: 2, color: choice.selected ? Color.primary : Color.border), child: If(condition: choice.selected, then: Box(shape: BoxShape.circle, width: 10, height: 10, background: Color.primary))), Expanded(child: ${choiceText(K)}), ${K.muted(CHOICE_PRICE)}])`)})`)})),
        Row(gap: Space.md, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ${fewer}, ariaLabel: "Fewer", child: Icon(name: Icons.minus, color: Color.primary)),
          Text(child: state.quantity, size: FontSize.xl, weight: FontWeight.bold),
          Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ${more}, ariaLabel: "More", child: Icon(name: Icons.plus, color: Color.primary))
        ]),
        Button(label: "\${${q(c.product[1])}} · \${${productTotal}}", fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity))
      ]), else: ${K.muted('"Choose something from the menu."')})`),
  }),
  // Marks and rules, an editorial price, a quantity field.
  (K, c) => ({
    states: QUANTITY,
    build: K.page(`${back(K)},
      If(condition: product != null, then: Column(gap: Space.lg, children: [
        Image(src: product.image_url, alt: product.name, aspectRatio: 1, radius: ${K.card}),
        ${K.heading("product.name")},
        ${K.body("formatMoney(product.display_price_cents)", ", size: FontSize.lg, fontStyle: FontStyle.italic, color: Color.primary")},
        ${K.muted("product.description")},
        Divider(),
        If(condition: optionGroups.length > 0, then: ${K.label(K.say(c.product[0]))}),
        ForEach(items: optionGroups, as: "group", child: Column(gap: Space.xs, children: [
          Row(gap: Space.md, children: [Expanded(child: ${K.body('group.depth > 0 ? "— ${group.label}" : group.label', ", size: FontSize.lg")}), ${K.muted(GROUP_RULE, ", size: FontSize.xs, fontStyle: FontStyle.italic")}]),
          ForEach(items: group.choices, as: "choice", child: ${choiceTap(`Row(gap: Space.md, children: [Text(child: choice.selected ? "●" : "○", color: Color.primary), Expanded(child: ${choiceText(K)}), ${K.muted(CHOICE_PRICE, ", fontStyle: FontStyle.italic")}])`)}),
          Divider()
        ])),
        TextField(state: "quantity", label: "Quantity", type: InputType.number, min: 1, max: 99, ${K.look}),
        Row(children: [Expanded(child: ${K.title('"Total"')}), ${K.title(productTotal)}]),
        Button(label: ${K.say(c.product[1])}, fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity))
      ]), else: ${K.muted('"Choose something from the menu."')})`),
  }),
  // Choices as a grid of tiles, square steppers, a full-width bar to add.
  (K, c) => ({
    states: QUANTITY,
    build: K.page(`${back(K)},
      If(condition: product != null, then: Column(gap: Space.lg, children: [
        Stack(children: [Image(src: product.image_url, alt: product.name, aspectRatio: 1.6, radius: ${K.card}), Positioned(top: 12, right: 12, child: Box(padding: Insets(x: 12, y: 6), radius: Radius.full, background: Color.primary, child: Text(child: formatMoney(product.display_price_cents), weight: FontWeight.bold, color: Color.primaryInk)))]),
        ${K.heading("product.name")},
        ${K.muted("product.description")},
        ForEach(items: optionGroups, as: "group", child: ${K.box(`Row(gap: Space.sm, children: [Expanded(child: ${K.label("group.label", "Color.primary")}), ${K.muted('group.required ? "Must pick" : ' + GROUP_RULE, ", size: FontSize.xs")}]),
          Grid(cols: 2, gap: Space.sm, children: [ForEach(items: group.choices, as: "choice", child: ${choiceTap(`Column(gap: Space.xs, children: [Text(child: choice.label, weight: FontWeight.bold${K.font}, color: choice.selected ? Color.primaryInk : choice.disabled ? Color.textMuted : Color.text), Text(child: ${CHOICE_PRICE}, size: FontSize.xs, color: choice.selected ? Color.primaryInk : Color.textMuted)])`, `padding: Space.md, radius: ${K.card}, background: choice.selected ? Color.primary : Color.surfaceAlt`)})])`)}),
        Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(width: 48, height: 48, radius: ${K.card}, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ${fewer}, ariaLabel: "Fewer", child: Icon(name: Icons.minus)),
          Expanded(child: Text(child: state.quantity, size: FontSize.xl, weight: FontWeight.bold, align: TextAlign.center)),
          Box(width: 48, height: 48, radius: ${K.card}, alignment: Anchor.center, background: Color.primary, onTap: ${more}, ariaLabel: "More", child: Icon(name: Icons.plus, color: Color.primaryInk))
        ]),
        If(condition: product.is_available, then: Box(padding: Insets(x: 18, y: 16), radius: ${K.card}, background: Color.primary, onTap: AddConfiguredProduct(quantity: state.quantity), ariaLabel: ${q(c.product[1])}, child: Row(children: [Expanded(child: Text(child: ${K.say(c.product[1])}, weight: FontWeight.bold, color: Color.primaryInk${K.font})), Text(child: ${productTotal}, weight: FontWeight.bold, color: Color.primaryInk)])), else: Text(child: "Sold out", weight: FontWeight.bold, color: Color.danger))
      ]), else: ${K.muted('"Choose something from the menu."')})`),
  }),
  // Chips with ticks, a pill stepper beside the add button.
  (K, c) => ({
    states: QUANTITY,
    build: K.page(`${back(K)},
      If(condition: product != null, then: Column(gap: Space.md, children: [
        Box(padding: Space.lg, radius: ${K.card}, background: Color.surfaceAlt, child: Image(src: product.image_url, alt: product.name, aspectRatio: 1.4, radius: ${K.card})),
        Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: ${K.heading("product.name", "FontSize.xl")}), Box(padding: Insets(x: 12, y: 6), radius: ${K.pill}, background: Color.primary, child: Text(child: formatMoney(product.display_price_cents), weight: FontWeight.bold, color: Color.primaryInk))]),
        ${K.muted("product.description")},
        ForEach(items: optionGroups, as: "group", child: ${K.box(`Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: ${K.title("group.label")}), Badge(label: group.required ? "Required" : "Optional", tone: group.required ? Tone.warning : Tone.neutral)]),
          ${K.muted(GROUP_RULE, ", size: FontSize.xs")},
          Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [ForEach(items: group.choices, as: "choice", child: ${choiceTap(`Row(gap: Space.xs, children: [If(condition: choice.selected, then: Icon(name: Icons.check, size: Size.sm, color: Color.primary)), Text(child: choice.label, size: FontSize.sm, weight: FontWeight.semibold, color: choice.disabled ? Color.textMuted : Color.text), If(condition: choice.price_cents > 0, then: Text(child: "+\${formatMoney(choice.price_cents)}", size: FontSize.xs, color: Color.textMuted))])`, `padding: Insets(x: 12, y: 8), radius: ${K.pill}, border: Border(width: 1, color: choice.selected ? Color.primary : Color.border), background: choice.selected ? Color.surfaceAlt : Color.surface`)})])`)}),
        Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(padding: Space.xs, radius: Radius.full, border: Border(width: 1, color: Color.border), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
            Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, onTap: ${fewer}, ariaLabel: "Fewer", child: Icon(name: Icons.minus, size: Size.sm, color: Color.primary)),
            Text(child: state.quantity, weight: FontWeight.bold),
            Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, background: Color.primary, onTap: ${more}, ariaLabel: "More", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primaryInk))
          ])),
          Expanded(child: Button(label: ${q(c.product[1])}, fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity)))
        ]),
        ${K.muted('"Total ${' + productTotal + '}"', ", align: TextAlign.right")}
      ]), else: ${K.muted('"Choose something from the menu."')})`),
  }),
  // Centred and quiet: choices with a check at the side, icon steppers.
  (K, c) => ({
    states: QUANTITY,
    build: K.page(`${back(K)},
      If(condition: product != null, then: Column(gap: Space.lg, align: Align.center, children: [
        Image(src: product.image_url, alt: product.name, aspectRatio: 1.3, radius: ${K.card}),
        Text(child: product.name, size: FontSize.xxl, align: TextAlign.center${K.font}),
        Text(child: formatMoney(product.display_price_cents), letterSpacing: 2, color: Color.primary, align: TextAlign.center),
        ${K.muted("product.description", ", align: TextAlign.center")},
        ForEach(items: optionGroups, as: "group", child: Column(gap: Space.sm, children: [
          Box(height: 1, background: Color.border),
          ${K.label("group.label", "Color.primary")},
          ${K.muted(GROUP_RULE, ", size: FontSize.xs")},
          ForEach(items: group.choices, as: "choice", child: ${choiceTap(`Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: choice.label${K.font}, color: choice.selected ? Color.primary : choice.disabled ? Color.textMuted : Color.text)), ${K.muted(CHOICE_PRICE)}, If(condition: choice.selected, then: Icon(name: Icons.check, size: Size.sm, color: Color.primary))])`, "padding: Insets(y: 8)")})
        ])),
        Row(gap: Space.xl, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(onTap: ${fewer}, ariaLabel: "Fewer", child: Icon(name: Icons.minus, color: Color.primary)),
          Text(child: state.quantity, size: FontSize.xl, letterSpacing: 2),
          Box(onTap: ${more}, ariaLabel: "More", child: Icon(name: Icons.plus, color: Color.primary))
        ]),
        Button(label: "\${${q(c.product[1])}} · \${${productTotal}}", style: ButtonStyle.secondary, fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity))
      ]), else: ${K.muted('"Choose something from the menu."')})`),
  }),
];

const choices = `Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [ForEach(items: line.choices, as: "choice", child: Text(child: choice, size: FontSize.xs, color: Color.textMuted))])`;
const lineIds = { less: "ChangeCartLine(line: line.id, by: -1)", plus: "ChangeCartLine(line: line.id, by: 1)", remove: "RemoveCartLine(line: line.id)" };
const toCheckout = (K: Kit, c: StoreCopy) => K.action(K.say(c.cart[2]), "Navigate(to: Route.checkout)", c.cart[2]);
const keepShopping = `Button(label: "Keep shopping", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))`;

const carts: Page[] = [
  // Cards with round steppers, the subtotal in a pill.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.cart[0]))},
      ForEach(items: cart, as: "line", child: ${K.box(`Row(gap: Space.sm, children: [Expanded(child: Column(gap: Space.xs, children: [${K.title("line.name")}, ${choices}])), ${K.title("formatMoney(line.line_total_cents)")}]),
        Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(shape: BoxShape.circle, width: 34, height: 34, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ${lineIds.less}, ariaLabel: "One fewer", child: Icon(name: Icons.minus, size: Size.sm, color: Color.primary)),
          Text(child: line.quantity, weight: FontWeight.bold),
          Box(shape: BoxShape.circle, width: 34, height: 34, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ${lineIds.plus}, ariaLabel: "One more", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primary)),
          Spacer(),
          Button(label: "Remove", style: ButtonStyle.ghost, size: Size.sm, onTap: ${lineIds.remove})
        ])`)}, empty: ${K.muted(q(c.cart[1]), K.alignText)}),
      If(condition: cartCount > 0, then: Column(gap: Space.md, children: [
        Box(padding: Insets(x: 20, y: 14), radius: ${K.pill}, background: Color.surfaceAlt, child: Row(children: [Expanded(child: ${K.body('"Subtotal"')}), ${K.title("formatMoney(cartTotal)")}])),
        ${toCheckout(K, c)}
      ])),
      ${keepShopping}`),
  }),
  // A ruled list: "2 × name", text links to change it.
  (K, c) => ({
    build: K.page(`${K.label(K.say("Your selection"))},
      ${K.heading(K.say(c.cart[0]))},
      Divider(),
      ForEach(items: cart, as: "line", child: Column(gap: Space.sm, children: [
        Row(gap: Space.md, children: [Expanded(child: ${K.body('"${line.quantity} × ${line.name}"', ", size: FontSize.lg")}), ${K.body("formatMoney(line.line_total_cents)")}]),
        ${choices},
        Row(gap: Space.lg, children: [
          Box(padding: Insets(y: 4), onTap: ${lineIds.less}, ariaLabel: "One fewer", child: ${K.body('"one fewer"', ", size: FontSize.sm, color: Color.primary")}),
          Box(padding: Insets(y: 4), onTap: ${lineIds.plus}, ariaLabel: "One more", child: ${K.body('"one more"', ", size: FontSize.sm, color: Color.primary")}),
          Box(padding: Insets(y: 4), onTap: ${lineIds.remove}, ariaLabel: "Remove", child: ${K.body('"remove"', ", size: FontSize.sm, color: Color.textMuted")})
        ]),
        Divider()
      ]), empty: ${K.muted(q(c.cart[1]))}),
      If(condition: cartCount > 0, then: Column(gap: Space.md, children: [Row(children: [Expanded(child: ${K.title('"Subtotal"')}), ${K.title("formatMoney(cartTotal)")}]), ${toCheckout(K, c)}])),
      ${keepShopping}`),
  }),
  // Blocks with stacked square steppers, a bar to check out with the total.
  (K, c) => ({
    build: K.page(`Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [${K.heading(K.say(c.cart[0]))}, If(condition: cartCount > 0, then: Box(padding: Insets(x: 10, y: 4), radius: Radius.full, background: Color.primary, child: Text(child: cartCount, weight: FontWeight.bold, color: Color.primaryInk)))]),
      ForEach(items: cart, as: "line", child: Box(padding: Space.md, radius: ${K.card}, background: Color.surface, border: Border(width: 1, color: Color.border), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Column(gap: Space.xs, align: Align.center, children: [
          Box(width: 32, height: 32, radius: Radius.sm, alignment: Anchor.center, background: Color.primary, onTap: ${lineIds.plus}, ariaLabel: "One more", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primaryInk)),
          Text(child: line.quantity, size: FontSize.lg, weight: FontWeight.bold),
          Box(width: 32, height: 32, radius: Radius.sm, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ${lineIds.less}, ariaLabel: "One fewer", child: Icon(name: Icons.minus, size: Size.sm))
        ]),
        Expanded(child: Column(gap: Space.xs, children: [${K.title("line.name")}, ${choices}, Text(child: formatMoney(line.line_total_cents), weight: FontWeight.bold, color: Color.primary)])),
        Box(width: 36, height: 36, alignment: Anchor.center, onTap: ${lineIds.remove}, ariaLabel: "Remove", child: Icon(name: Icons.close, color: Color.textMuted))
      ])), empty: ${K.muted(q(c.cart[1]))}),
      If(condition: cartCount > 0, then: Box(padding: Insets(x: 18, y: 16), radius: ${K.card}, background: Color.primary, onTap: Navigate(to: Route.checkout), ariaLabel: ${q(c.cart[2])}, child: Row(children: [Expanded(child: Text(child: ${K.say(c.cart[2])}, weight: FontWeight.bold, color: Color.primaryInk${K.font})), Text(child: formatMoney(cartTotal), size: FontSize.lg, weight: FontWeight.bold, color: Color.primaryInk)]))),
      ${keepShopping}`),
  }),
  // Bordered rows with a pill stepper, the choices as badges, a summary box.
  (K, c) => ({
    build: K.page(`Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: ${K.heading(K.say(c.cart[0]))}), Badge(label: "\${cartCount} items", tone: Tone.primary)]),
      ForEach(items: cart, as: "line", child: Box(padding: Space.sm, radius: ${K.card}, border: Border(width: 1, color: Color.border), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(child: Column(gap: Space.xs, children: [${K.title("line.name")}, Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [ForEach(items: line.choices, as: "choice", child: Badge(label: choice, tone: Tone.neutral))]), Text(child: formatMoney(line.line_total_cents), weight: FontWeight.bold, color: Color.primary)])),
        Box(padding: Space.xs, radius: Radius.full, border: Border(width: 1, color: Color.border), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(shape: BoxShape.circle, width: 30, height: 30, alignment: Anchor.center, onTap: ${lineIds.less}, ariaLabel: "One fewer", child: Icon(name: Icons.minus, size: Size.sm, color: Color.primary)),
          Text(child: line.quantity, weight: FontWeight.bold),
          Box(shape: BoxShape.circle, width: 30, height: 30, alignment: Anchor.center, background: Color.primary, onTap: ${lineIds.plus}, ariaLabel: "One more", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primaryInk))
        ])),
        Box(width: 30, height: 30, alignment: Anchor.center, onTap: ${lineIds.remove}, ariaLabel: "Remove", child: Icon(name: Icons.close, size: Size.sm, color: Color.textMuted))
      ])), empty: ${K.box(`${K.title(q(c.cart[1]))}, ${K.muted('"Add something from the menu."')}`)}),
      If(condition: cartCount > 0, then: ${K.box(`Row(children: [Expanded(child: ${K.body('"Items"')}), Text(child: cartCount)]), Row(children: [Expanded(child: ${K.title('"Subtotal"')}), ${K.title("formatMoney(cartTotal)")}]), ${K.muted('"Delivery and any tip are added at checkout."', ", size: FontSize.xs")}`)}),
      If(condition: cartCount > 0, then: Row(gap: Space.sm, children: [Expanded(child: Button(label: "Keep shopping", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu))), Expanded(child: Button(label: ${q(c.cart[2])}, onTap: Navigate(to: Route.checkout)))]), else: Button(label: "Start shopping", onTap: Navigate(to: Route.menu)))`),
  }),
  // Minimal: "name × 2", icon steppers, thin rules, centred.
  (K, c) => ({
    build: `Column(gap: Space.lg, padding: Insets(x: 24, y: 24), children: [
      ${K.label(K.say(c.cart[0]), "Color.primary")},
      ForEach(items: cart, as: "line", child: Column(gap: Space.sm, children: [
        Row(gap: Space.md, children: [Expanded(child: ${K.body('"${line.name} × ${line.quantity}"', ", letterSpacing: 1")}), Text(child: formatMoney(line.line_total_cents), color: Color.primary)]),
        ${choices},
        Row(gap: Space.lg, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(onTap: ${lineIds.less}, ariaLabel: "One fewer", child: Icon(name: Icons.minus, size: Size.sm, color: Color.primary)),
          Box(onTap: ${lineIds.plus}, ariaLabel: "One more", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primary)),
          Spacer(),
          Box(onTap: ${lineIds.remove}, ariaLabel: "Remove", child: Text(child: "REMOVE", size: FontSize.xs, letterSpacing: 3, color: Color.textMuted))
        ]),
        Box(height: 1, background: Color.border)
      ]), empty: ${K.muted(q(c.cart[1]), ", align: TextAlign.center")}),
      If(condition: cartCount > 0, then: Column(gap: Space.md, children: [Row(children: [Expanded(child: ${K.label('"SUBTOTAL"')}), Text(child: formatMoney(cartTotal), size: FontSize.lg, color: Color.primary)]), ${K.action(K.say(c.cart[2]), "Navigate(to: Route.checkout)", c.cart[2], false)}])),
      ${keepShopping}
    ])`,
  }),
];

/** The checkout, in five arrangements of the same form. */
const checkouts: Page[] = [0, 1, 2, 3, 4].map((variant): Page => (K, c) => {
  const f = fields(K.look);
  const sections: [title: string, children: string][] = [
    ["Your details", `${f.name}, ${f.phone}`],
    ["Collection or delivery", `Row(gap: Space.sm, children: [${fulfilment((value, label, selected) =>
      variant === 1
        ? `Expanded(child: Box(padding: Insets(y: 8), onTap: SetState(state: "fulfilment", value: "${value}"), ariaLabel: "${label}", child: Row(gap: Space.sm, children: [Text(child: ${selected} ? "●" : "○", color: Color.primary), ${K.body(`"${label}"`)}])))`
        : variant === 4
          ? `Expanded(child: Box(padding: Insets(y: 10), radius: ${K.card}, alignment: Anchor.center, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), onTap: SetState(state: "fulfilment", value: "${value}"), ariaLabel: "${label}", child: Text(child: "${label.toUpperCase()}", size: FontSize.sm, letterSpacing: 2, color: ${selected} ? Color.primary : Color.textMuted)))`
          : `Expanded(child: Box(padding: Insets(y: 12), radius: ${K.card}, alignment: Anchor.center, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: SetState(state: "fulfilment", value: "${value}"), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [${variant === 3 ? `Icon(name: Icons.${value === "pickup" ? "home" : "location"}, color: ${selected} ? Color.primaryInk : Color.primary), ` : ""}Text(child: "${label}", weight: FontWeight.semibold${K.font}, color: ${selected} ? Color.primaryInk : Color.text)])))`,
    ).join(", ")}]),
      ${deliveryDetails(K.look, f.instructions,
        variant === 1
          ? (selected, action) => `Box(padding: Insets(y: 8), onTap: ${action}, ariaLabel: spot.place_name, child: Row(gap: Space.md, children: [Text(child: ${selected} ? "●" : "○", color: Color.primary), Expanded(child: ${K.body("spot.place_name")}), ${K.muted("formatMoney(spot.fee_cents)")}]))`
          : variant === 2
            ? (selected, action) => `Box(padding: Space.md, radius: ${K.card}, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: ${action}, ariaLabel: spot.place_name, child: Row(children: [Expanded(child: Text(child: spot.place_name, weight: FontWeight.bold${K.font}, color: ${selected} ? Color.primaryInk : Color.text)), Text(child: formatMoney(spot.fee_cents), weight: FontWeight.bold, color: ${selected} ? Color.primaryInk : Color.primary)]))`
            : spotTile(K.card, K.font),
        (value, extra = "") => `Text(child: ${value}${K.font}${extra})`)}`],
    ["Payment and tip", `${f.payment}, Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [${tips((label, selected, action, aria) =>
      `Box(padding: Insets(x: 14, y: 8), radius: ${K.pill}, ${variant === 4 ? `border: Border(width: 1, color: ${selected} ? Color.primary : Color.border)` : `background: ${selected} ? Color.primary : Color.surfaceAlt`}, onTap: ${action}, ariaLabel: "${aria}", child: Text(child: "${label}", size: FontSize.sm, color: ${variant === 4 ? `${selected} ? Color.primary : Color.textMuted` : `${selected} ? Color.primaryInk : Color.text`}))`,
    ).join(", ")}])`],
    ["Notes", `${f.notes}, ${f.save}, ${f.account}`],
  ];
  const marks = ["I.", "II.", "III.", "IV."];
  const section = ([title, children]: [string, string], i: number) =>
    [
      () => K.box(`${K.title(K.say(title))}, ${children}`, "Space.lg"),
      () => `Column(gap: Space.md, children: [Row(gap: Space.md, children: [${K.body(`"${marks[i]}"`, ", color: Color.primary, fontStyle: FontStyle.italic")}, ${K.body(K.say(title), ", size: FontSize.lg")}]), Divider(), ${children}])`,
      () => `Box(padding: Space.lg, radius: ${K.card}, background: Color.surface, border: Border(width: 1, color: Color.border), child: Column(gap: Space.md, children: [${K.label(`"0${i + 1} · ${title.toUpperCase()}"`, "Color.primary")}, ${children}]))`,
      () => `Box(padding: Space.md, radius: ${K.card}, border: Border(width: 1, color: Color.border), child: Column(gap: Space.md, children: [Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [${K.circle(["user", "location", "cart", "email"][i], 32)}, ${K.title(K.say(title))}]), ${children}]))`,
      () => `Column(gap: Space.md, children: [${K.label(K.say(title))}, ${children}, Box(height: 1, background: Color.border)])`,
    ][variant]();
  const line = (label: string, value: string) => `Row(children: [Expanded(child: ${K.muted(label)}), ${K.body(value)}])`;
  return {
    states: CHECKOUT_STATES,
    build: K.page(`${K.heading(K.say(c.checkout[0]))},
      If(condition: cartCount > 0, then: Form(id: "checkout", onSubmit: PlaceOrder(fulfilment: state.fulfilment), child: Column(gap: Space.lg, children: [
        ${sections.map(section).join(",\n        ")},
        ${K.box(`${summary(line).join(", ")}, Row(children: [Expanded(child: ${K.title('"Total"')}), ${K.title(TOTAL, ", size: FontSize.lg")}])`)},
        ${K.muted('"The store confirms the final total with your order."', ", size: FontSize.xs")},
        SubmitButton(label: ${K.say(c.checkout[1])}, fullWidth: true)
      ])), else: ${K.muted('"Add something to your order first."')})`),
  };
});

const ordersPages: Page[] = [
  // Cards with a clock, the number, its status and total.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.orders[0]))},
      ForEach(items: orders, as: "past", child: ${K.tapBox("OpenOrder(order: past.id)", '"Order ${past.order_number}"', `Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [${K.circle("clock", 40)}, Expanded(child: Column(gap: Space.xs, children: [${K.title("past.order_number")}, ${K.muted(status("past"))}])), ${K.title("formatMoney(past.total_cents)")}, Icon(name: Icons.chevronRight, size: Size.sm, color: Color.textMuted)])`)}, empty: ${K.muted(q(c.orders[1]), K.alignText)}),
      Button(label: "Order something", onTap: Navigate(to: Route.menu))`),
  }),
  // A ruled ledger: number, status, total.
  (K, c) => ({
    build: K.page(`${K.label(K.say("Order history"))},
      ${K.heading(K.say(c.orders[0]))},
      Divider(),
      ForEach(items: orders, as: "past", child: Column(children: [Box(padding: Insets(y: 10), onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Row(gap: Space.md, children: [${K.body('"No. ${past.order_number}"')}, Expanded(child: ${K.muted(status("past"), ", fontStyle: FontStyle.italic")}), ${K.body("formatMoney(past.total_cents)")}])), Divider()]), empty: ${K.muted(q(c.orders[1]))}),
      Button(label: "Visit the menu", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu))`),
  }),
  // Blocks with a coloured edge and the status in a tone.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.orders[0]))},
      ForEach(items: orders, as: "past", child: Box(padding: Space.md, radius: ${K.card}, background: Color.surface, border: Border(width: 1, color: Color.border), onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 6, height: 40, radius: Radius.full, background: Color.primary), Expanded(child: Column(gap: Space.xs, children: [${K.title('"#${past.order_number}"')}, Text(child: ${status("past")}, size: FontSize.xs, weight: FontWeight.bold, color: Color.primary)])), ${K.title("formatMoney(past.total_cents)", ", size: FontSize.lg")}])), empty: ${K.muted(q(c.orders[1]))}),
      ${K.action(K.say("Order again"), "Navigate(to: Route.menu)", "Order again")}`),
  }),
  // Bordered rows with a status badge.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.orders[0]))},
      ${K.box(`Row(gap: Space.sm, children: [Icon(name: Icons.orders, color: Color.primary), Expanded(child: ${K.muted('"Open an order to follow it or see what was in it."')})])`)},
      ForEach(items: orders, as: "past", child: Box(padding: Space.md, radius: ${K.card}, border: Border(width: 1, color: Color.border), onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Column(children: [${K.title("past.order_number")}, ${K.muted("formatMoney(past.total_cents)")}])), Badge(label: ${status("past")}, tone: past.status == "delivered" ? Tone.success : past.status == "cancelled" || past.status == "failed" ? Tone.danger : Tone.primary)])), empty: ${K.muted(q(c.orders[1]))}),
      Button(label: "Start a new order", onTap: Navigate(to: Route.menu))`),
  }),
  // Centred frames, the number spaced out.
  (K, c) => ({
    build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${K.label(K.say("History"), "Color.primary", true)},
      Text(child: ${K.say(c.orders[0])}, size: FontSize.xxl, align: TextAlign.center${K.font}),
      ForEach(items: orders, as: "past", child: Box(padding: Space.lg, radius: ${K.card}, border: Border(width: 1, color: Color.border), onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Column(gap: Space.xs, align: Align.center, children: [Text(child: past.order_number, letterSpacing: 4), Text(child: ${status("past")}, size: FontSize.xs, letterSpacing: 2, color: Color.primary), ${K.muted("formatMoney(past.total_cents)")}])), empty: ${K.muted(q(c.orders[1]), ", align: TextAlign.center")}),
      Button(label: "Back to the menu", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu))
    ])`,
  }),
];

const items = (_K: Kit, row: string) => `ForEach(items: orderItems, as: "line", child: ${row})`;
const trackingPages: Page[] = [
  // Circles that fill as the order moves.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.tracking))},
      If(condition: order != null, then: Column(gap: Space.lg, children: [
        ${K.box(`${K.title("order.order_number", ", size: FontSize.lg")}, If(condition: ${STOPPED}, then: Badge(label: ${status("order")}, tone: Tone.danger), else: Column(gap: Space.sm, children: [
          ${progress((label, reached, current) => `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(shape: BoxShape.circle, width: 24, height: 24, alignment: Anchor.center, background: ${reached} ? Color.primary : Color.surface, border: Border(width: 1, color: Color.border), child: If(condition: ${reached}, then: Icon(name: Icons.check, size: Size.sm, color: Color.primaryInk))), Text(child: "${label}", weight: ${current} ? FontWeight.bold : FontWeight.regular, color: ${reached} ? Color.text : Color.textMuted)])`)}
        ]))`, "Space.lg")},
        ${K.box(`${items(K, `Row(children: [Expanded(child: ${K.body('"${line.quantity} × ${line.product_name}"')}), ${K.body("formatMoney(line.line_total_cents)")}])`)}, Divider(), Row(children: [Expanded(child: ${K.title('"Total"')}), ${K.title("formatMoney(order.total_cents)")}])`)},
        ${TRACKING_ACTIONS("ButtonStyle.secondary")}
      ]), else: ${K.muted('"Place an order to follow it here."')}),
      Button(label: "All orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))`),
  }),
  // Ticks and words, an editorial receipt.
  (K, _c) => ({
    build: K.page(`${K.label(K.say("Your order"))},
      If(condition: order != null, then: Column(gap: Space.lg, children: [
        ${K.heading("order.order_number")},
        If(condition: ${STOPPED}, then: ${K.body(status("order"), ", color: Color.danger, fontStyle: FontStyle.italic")}, else: Column(gap: Space.xs, children: [
          ${progress((label, reached, current) => `Row(gap: Space.md, children: [Text(child: ${reached} ? "✓" : "·", color: Color.primary), Text(child: "${label}"${K.font}, fontStyle: ${current} ? FontStyle.italic : FontStyle.normal, color: ${reached} ? Color.text : Color.textMuted)])`)}
        ])),
        Divider(),
        ${items(K, `Row(children: [Expanded(child: ${K.body('"${line.quantity} × ${line.product_name}"')}), ${K.body("formatMoney(line.line_total_cents)")}])`)},
        Divider(),
        Row(children: [Expanded(child: ${K.title('"Total"')}), ${K.title("formatMoney(order.total_cents)")}]),
        ${TRACKING_ACTIONS("ButtonStyle.ghost")}
      ]), else: ${K.muted('"Place an order to follow it here."')}),
      Button(label: "All orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))`),
  }),
  // A status banner, chunky square steps.
  (K, _c) => ({
    build: K.page(`If(condition: order != null, then: Column(gap: Space.lg, children: [
        Box(padding: Space.xl, radius: ${K.card}, gradient: Gradient(from: Color.primary, to: Color.warning, begin: Anchor.topLeft, end: Anchor.bottomRight), child: Column(gap: Space.sm, children: [Text(child: "ORDER \${order.order_number}", size: FontSize.xs, weight: FontWeight.bold, letterSpacing: 2, color: Color.primaryInk), Text(child: ${status("order")}, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primaryInk${K.font})])),
        If(condition: ${STOPPED}, then: ${K.muted('"This order was not completed."')}, else: Column(gap: Space.sm, children: [
          ${progress((label, reached, current) => `Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 28, height: 28, radius: Radius.sm, alignment: Anchor.center, background: ${reached} ? Color.primary : Color.surfaceAlt, child: If(condition: ${reached}, then: Icon(name: Icons.check, size: Size.sm, color: Color.primaryInk))), Text(child: "${label.toUpperCase()}", weight: FontWeight.bold, letterSpacing: 1, color: ${current} ? Color.primary : ${reached} ? Color.text : Color.textMuted)])`)}
        ])),
        ${K.box(`${items(K, `Row(children: [Expanded(child: ${K.body('"${line.quantity}× ${line.product_name}"', ", weight: FontWeight.semibold")}), ${K.body("formatMoney(line.line_total_cents)")}])`)}, Row(children: [Expanded(child: ${K.label('"TOTAL"')}), Text(child: formatMoney(order.total_cents), weight: FontWeight.bold, color: Color.primary)])`)},
        ${TRACKING_ACTIONS("ButtonStyle.secondary")}
      ]), else: ${K.muted('"No order to follow yet."')}),
      Button(label: "All orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))`),
  }),
  // Two facts, a checklist with "now" beside the current step.
  (K, c) => ({
    build: K.page(`${K.heading(K.say(c.tracking))},
      If(condition: order != null, then: Column(gap: Space.md, children: [
        Grid(cols: 2, gap: Space.sm, children: [${K.box(`${K.muted('"Order"', ", size: FontSize.xs")}, ${K.title("order.order_number")}`)}, ${K.box(`${K.muted('"Total"', ", size: FontSize.xs")}, ${K.title("formatMoney(order.total_cents)")}`)}]),
        If(condition: ${STOPPED}, then: Badge(label: ${status("order")}, tone: Tone.danger), else: ${K.box(progress((label, reached, current) => `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.check, size: Size.sm, color: ${reached} ? Color.primary : Color.border), Expanded(child: Text(child: "${label}", weight: ${current} ? FontWeight.bold : FontWeight.regular, color: ${reached} ? Color.text : Color.textMuted)), If(condition: ${current}, then: Badge(label: "Now", tone: Tone.primary))])`))}),
        ${K.box(items(K, `Row(gap: Space.sm, children: [Badge(label: line.quantity, tone: Tone.primary), Expanded(child: ${K.body("line.product_name")}), ${K.body("formatMoney(line.line_total_cents)")}])`))},
        ${TRACKING_ACTIONS("ButtonStyle.secondary")}
      ]), else: ${K.muted('"Place an order to track it here."')}),
      Button(label: "All orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))`),
  }),
  // Centred dots, the steps spaced out in capitals.
  (K, c) => ({
    build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${K.label(K.say("In progress"), "Color.primary", true)},
      If(condition: order != null, then: Column(gap: Space.lg, align: Align.center, children: [
        Text(child: ${K.say(c.tracking)}, size: FontSize.xxl, align: TextAlign.center${K.font}),
        Text(child: order.order_number, letterSpacing: 4, color: Color.primary),
        If(condition: ${STOPPED}, then: Text(child: ${status("order")}, letterSpacing: 2, color: Color.danger), else: Column(gap: Space.sm, align: Align.center, children: [
          ${progress((label, reached, current) => `Column(gap: Space.xs, align: Align.center, children: [Box(shape: BoxShape.circle, width: 10, height: 10, background: ${reached} ? Color.primary : Color.border), Text(child: "${label.toUpperCase()}", size: FontSize.xs, letterSpacing: 3, color: ${current} ? Color.primary : ${reached} ? Color.text : Color.textMuted)])`)}
        ])),
        Box(padding: Space.lg, radius: ${K.card}, border: Border(width: 1, color: Color.border), child: Column(gap: Space.sm, children: [${items(K, `Row(children: [Expanded(child: ${K.body('"${line.product_name} × ${line.quantity}"')}), ${K.muted("formatMoney(line.line_total_cents)")}])`)}, Row(children: [Expanded(child: ${K.label('"TOTAL"')}), Text(child: formatMoney(order.total_cents), color: Color.primary)])])),
        ${TRACKING_ACTIONS("ButtonStyle.ghost")}
      ]), else: ${K.muted('"There is no order to follow yet."', ", align: TextAlign.center")}),
      Button(label: "All orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))
    ])`,
  }),
];

const signOut = `If(condition: !me.is_anonymous, then: Button(label: "Sign out", style: ButtonStyle.secondary, onTap: SignOutPreviewCustomer()))`;
const accountName = (c: StoreCopy) => `me.is_anonymous ? ${q(c.account[0])} : me.display_name`;
const accountLine = (c: StoreCopy) => `me.is_anonymous ? ${q(c.account[1])} : me.email`;
const LINKS: [route: string, icon: string, label: string][] = [
  ["orders", "orders", "Orders"],
  ["addresses", "location", "Addresses"],
  ["resetPassword", "settings", "Password"],
];
const accounts: Page[] = [
  // A big round avatar, a card of links.
  (K, c) => ({
    build: K.page(`${K.lead(K.circle("user", 80))},
      ${K.heading(accountName(c))},
      ${K.muted(accountLine(c), K.alignText)},
      ${K.box(LINKS.map(([r, icon, label]) => `Button(label: "${label}", style: ButtonStyle.ghost, icon: Icons.${icon}, fullWidth: true, onTap: Navigate(to: Route.${r}))`).join(", "))},
      ${signOut}`),
  }),
  // A square monogram, links between rules.
  (K, c, b) => ({
    build: K.page(`Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 56, height: 56, alignment: Anchor.center, border: Border(width: 1, color: Color.text), child: Text(child: ${q(b.mark)}, size: FontSize.lg${K.font})), Expanded(child: Column(gap: Space.xs, children: [${K.heading(accountName(c), "FontSize.xl")}, ${K.muted(accountLine(c))}]))]),
      Divider(),
      ${LINKS.map(([r, , label]) => `Box(padding: Insets(y: 10), onTap: Navigate(to: Route.${r}), ariaLabel: "${label}", child: Row(children: [Expanded(child: ${K.body(`"${label}"`)}), Icon(name: Icons.chevronRight, size: Size.sm, color: Color.textMuted)])), Divider()`).join(", ")},
      ${signOut}`),
  }),
  // A primary banner, a two-by-two grid of tiles.
  (K, c) => ({
    build: K.page(`Box(padding: Space.xl, radius: ${K.card}, background: Color.primary, child: Column(gap: Space.xs, children: [${K.label(K.say("Your account"), "Color.primaryInk")}, Text(child: ${accountName(c)}, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primaryInk${K.font})])),
      ${K.muted(accountLine(c))},
      Grid(cols: 2, gap: Space.sm, children: [
        ${[...LINKS, ["menu", "home", "Menu"] as [string, string, string]].map(([r, icon, label]) => `Box(padding: Space.lg, radius: ${K.card}, background: Color.surfaceAlt, onTap: Navigate(to: Route.${r}), ariaLabel: "${label}", child: Column(gap: Space.sm, children: [Icon(name: Icons.${icon}, color: Color.primary), ${K.title(K.say(label))}]))`).join(",\n        ")}
      ]),
      ${signOut}`),
  }),
  // Bordered tiles with icons beside their names.
  (K, c) => ({
    build: K.page(`${K.heading(accountName(c))},
      ${K.muted(accountLine(c), K.alignText)},
      Grid(cols: 2, gap: Space.sm, children: [
        ${[...LINKS, ["cart", "cart", "Cart"] as [string, string, string]].map(([r, icon, label]) => `Box(padding: Space.md, radius: ${K.card}, border: Border(width: 1, color: Color.border), onTap: Navigate(to: Route.${r}), ariaLabel: "${label}", child: Row(gap: Space.sm, children: [Icon(name: Icons.${icon}, color: Color.primary), ${K.title(`"${label}"`)}]))`).join(",\n        ")}
      ]),
      ${signOut}`),
  }),
  // Centred: an outlined circle, quiet text buttons.
  (K, c) => ({
    build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [Box(shape: BoxShape.circle, width: 72, height: 72, alignment: Anchor.center, border: Border(width: 1, color: Color.primary), child: Icon(name: Icons.user, color: Color.primary))]),
      Text(child: ${accountName(c)}, size: FontSize.xxl, align: TextAlign.center${K.font}),
      ${K.muted(accountLine(c), ", align: TextAlign.center")},
      Box(height: 1, background: Color.border),
      ${LINKS.map(([r, , label]) => `Button(label: "${label}", style: ButtonStyle.ghost, onTap: Navigate(to: Route.${r}))`).join(", ")},
      ${signOut}
    ])`,
  }),
];

const addressForm = (K: Kit, label: string) =>
  `Form(id: "address", onSubmit: SavePreviewAddress(), child: Column(gap: Space.md, children: [TextField(name: "label", label: "Name it (Home, Work...)", required: true, maxLength: 40, ${K.look}), TextField(name: "address", label: "Address", required: true, maxLength: 200, ${K.look}), SubmitButton(label: ${K.say(label)}, fullWidth: true)]))`;
const removeAddress = `RemoveAddress(address: saved.id)`;
const addressesPages: Page[] = [
  (K) => ({
    build: K.page(`${K.heading(K.say("Your addresses"))},
      ForEach(items: addresses, as: "saved", child: ${K.box(`Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [${K.circle("home", 40)}, Expanded(child: Column(gap: Space.xs, children: [Row(gap: Space.xs, children: [${K.title("saved.label")}, If(condition: saved.is_default, then: Badge(label: "Default", tone: Tone.primary))]), ${K.muted("saved.line1")}])), Button(label: "Remove", style: ButtonStyle.ghost, size: Size.sm, onTap: ${removeAddress})])`)}, empty: ${K.muted('"No saved addresses yet."')}),
      ${K.box(`${K.title(K.say("Add an address"))}, ${addressForm(K, "Save address")}`, "Space.lg")}`),
  }),
  (K) => ({
    build: K.page(`${K.label(K.say("Addresses"))},
      ${K.heading(K.say("Where we deliver"))},
      Divider(),
      ForEach(items: addresses, as: "saved", child: Column(gap: Space.sm, children: [Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Column(gap: Space.xs, children: [${K.body('saved.is_default ? "${saved.label} (default)" : saved.label', ", size: FontSize.lg")}, ${K.muted("saved.line1", ", fontStyle: FontStyle.italic")}])), Box(padding: Insets(y: 4), onTap: ${removeAddress}, ariaLabel: "Remove", child: ${K.body('"remove"', ", size: FontSize.sm, color: Color.primary")})]), Divider()]), empty: ${K.muted('"No addresses kept yet."')}),
      ${K.label(K.say("A new address"))},
      ${addressForm(K, "Save")}`),
  }),
  (K) => ({
    build: K.page(`${K.heading(K.say("Drop-off spots"))},
      Box(width: 56, height: 6, radius: Radius.full, background: Color.primary),
      ForEach(items: addresses, as: "saved", child: Box(padding: Space.md, radius: ${K.card}, background: Color.surface, border: Border(width: 1, color: Color.border), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 6, height: 40, radius: Radius.full, background: saved.is_default ? Color.warning : Color.primary), Expanded(child: Column(gap: Space.xs, children: [${K.title("saved.label")}, ${K.muted("saved.line1")}])), Box(width: 36, height: 36, alignment: Anchor.center, onTap: ${removeAddress}, ariaLabel: "Remove", child: Icon(name: Icons.close, color: Color.textMuted))])), empty: ${K.muted('"No spots saved."')}),
      ${K.box(`${K.label(K.say("Add one"), "Color.primary")}, ${addressForm(K, "Save it")}`)}`),
  }),
  (K) => ({
    build: K.page(`${K.heading(K.say("Delivery addresses"))},
      ForEach(items: addresses, as: "saved", child: Box(padding: Space.md, radius: ${K.card}, border: Border(width: 1, color: Color.border), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.location, color: Color.primary), Expanded(child: Column(children: [Row(gap: Space.xs, children: [${K.title("saved.label")}, If(condition: saved.is_default, then: Badge(label: "Default", tone: Tone.success))]), ${K.muted("saved.line1")}])), Box(width: 30, height: 30, alignment: Anchor.center, onTap: ${removeAddress}, ariaLabel: "Remove", child: Icon(name: Icons.close, size: Size.sm, color: Color.textMuted))])), empty: ${K.muted('"No delivery addresses yet."')}),
      Box(padding: Space.md, radius: ${K.card}, border: Border(width: 1, color: Color.border), child: Column(gap: Space.md, children: [Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [${K.circle("plus", 32)}, ${K.title(K.say("New address"))}]), ${addressForm(K, "Save address")}]))`),
  }),
  (K) => ({
    build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${K.label(K.say("Addresses"), "Color.primary")},
      ForEach(items: addresses, as: "saved", child: Box(padding: Space.lg, radius: ${K.card}, border: Border(width: 1, color: Color.border), child: Column(gap: Space.sm, align: Align.center, children: [Text(child: saved.label, letterSpacing: 3, align: TextAlign.center${K.font}), ${K.muted("saved.line1", ", align: TextAlign.center")}, If(condition: saved.is_default, then: Text(child: "DEFAULT", size: FontSize.xs, letterSpacing: 4, color: Color.primary)), Button(label: "Remove", style: ButtonStyle.ghost, size: Size.sm, onTap: ${removeAddress})])), empty: ${K.muted('"No addresses saved."', ", align: TextAlign.center")}),
      Box(padding: Space.lg, radius: ${K.card}, border: Border(width: 1, color: Color.border), child: Column(gap: Space.md, children: [${K.label(K.say("New address"))}, ${addressForm(K, "Save")}]))
    ])`,
  }),
];

const resetForm = (K: Kit, label: string) =>
  `Form(id: "resetPassword", onSubmit: ResetPreviewPassword(), child: Column(gap: Space.md, children: [TextField(name: "email", label: "Your email", type: InputType.email, required: true, ${K.look}), SubmitButton(label: ${K.say(label)}, fullWidth: true)]))`;
const resets: Page[] = [
  (K) => ({ build: K.page(`${K.lead(K.circle("settings", 64))}, ${K.heading(K.say("A new password"))}, ${K.muted('"We\'ll email you a link to choose one."', K.alignText)}, ${K.box(resetForm(K, "Email me a link"), "Space.lg")}, ${back(K)}`) }),
  (K) => ({ build: K.page(`${K.label(K.say("Account"))}, ${K.heading(K.say("Forgotten your password?"))}, ${K.muted('"Enter your email; a link to choose a new one follows."', ", fontStyle: FontStyle.italic")}, Divider(), ${resetForm(K, "Send the link")}, ${back(K)}`) }),
  (K) => ({ build: K.page(`Box(padding: Space.xl, radius: ${K.card}, background: Color.primary, child: Column(gap: Space.sm, children: [${K.label(K.say("Security"), "Color.primaryInk")}, Text(child: ${K.say("Reset your password")}, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primaryInk${K.font})])), ${resetForm(K, "Send reset link")}, ${back(K)}`) }),
  (K) => ({ build: K.page(`${K.heading(K.say("Reset your password"))}, ${K.box(`Row(gap: Space.sm, children: [Icon(name: Icons.email, color: Color.primary), Expanded(child: ${K.muted('"We\'ll email you a reset link."')})])`)}, ${resetForm(K, "Send reset link")}, ${back(K)}`) }),
  (K) => ({
    build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 32), children: [
      ${K.label(K.say("Account"), "Color.primary", true)},
      Text(child: ${K.say("New password")}, size: FontSize.xxl, align: TextAlign.center${K.font}),
      ${K.muted('"A link to choose it comes by email."', ", align: TextAlign.center")},
      ${resetForm(K, "Send link")},
      ${back(K)}
    ])`,
  }),
];

/** A kit template's pages, header and bottom navigation. */
export function kitTemplate(style: KitStyle, layout: KitLayout, copy: StoreCopy, brand: KitBrand) {
  const K = kit(style);
  const pages: Record<StorePageId, StorePageBuild> = {
    location: locations[layout.location](K, copy, brand),
    stores: storesPages[layout.stores](K, copy, brand),
    menu: menus[layout.menu](K, copy, brand),
    product: products[layout.product](K, copy, brand),
    cart: carts[layout.cart](K, copy, brand),
    checkout: checkouts[layout.checkout](K, copy, brand),
    orders: ordersPages[layout.orders](K, copy, brand),
    tracking: trackingPages[layout.tracking](K, copy, brand),
    account: accounts[layout.account](K, copy, brand),
    addresses: addressesPages[layout.addresses](K, copy, brand),
    "reset-password": resets[layout.reset](K, copy, brand),
  };
  return { pages, header: headers[layout.header](K, brand), nav: navs[layout.nav](K) };
}

/**
 * The [index]th kit template's layouts: five in a row never share one on any
 * part, and further along each part shifts by its own step, so any two
 * templates share only a few of their thirteen.
 */
export function kitLayout(index: number): KitLayout {
  const parts: (keyof KitLayout)[] = ["header", "nav", "location", "stores", "menu", "product", "cart", "checkout", "orders", "tracking", "account", "addresses", "reset"];
  const steps = [0, 1, 2, 3, 4, 1, 2, 3, 4, 0, 1, 2, 3];
  return Object.fromEntries(
    parts.map((part, p) => [part, (index + p + Math.floor(index / 5) * steps[p]) % 5]),
  ) as unknown as KitLayout;
}
