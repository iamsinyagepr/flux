// Synced from Upskale Studio (upskaleapp/src/lib/studio/storeTemplatePages.ts). Edit it there, then npm run sync.
/**
 * Each store template's own pages. Every template runs the same storefront
 * flow (location, store, menu, product, cart, checkout, orders, tracking,
 * account, addresses, password reset) on the same live data, but each lays
 * every page out in its own visual language, so no two read as copies:
 *
 * - Bean & Bloom: warm and soft; centred, rounded cards, icon circles.
 * - Maison Crumb: editorial; serif display type, numbered steps, rules.
 * - Fire Slice: loud; dark, uppercase, gradients and chunky blocks.
 * - Green Basket: practical; grids, info tiles, steppers, icon rows.
 * - Kiri: quiet; centred, letter-spaced, thin gold lines on navy.
 *
 * No page uses a ready-made storefront block: each template draws its own
 * location search, store list, menu, product options, cart, orders, order
 * progress and addresses from layout primitives, wired to the storefront's
 * data (places, cities, stores, products, optionGroups, cart, orders,
 * addresses) and actions (UseMyLocation, ChoosePlace, ChooseStore,
 * ToggleOption, ChangeCartLine, OpenOrder, PlaceOrder, ...). The checkout
 * keeps the field names PlaceOrder reads (name, phone, address,
 * instructions, payment, notes, email, password).
 */

export type StorePageId =
  | "location"
  | "stores"
  | "menu"
  | "product"
  | "cart"
  | "checkout"
  | "orders"
  | "tracking"
  | "account"
  | "addresses"
  | "reset-password";

export interface StorePageBuild {
  build: string;
  /** Declared local states, as a Component's states list. */
  states?: string;
}

export interface StoreCopy {
  location: [title: string, subtitle: string, button: string];
  stores: [title: string, subtitle: string, button: string];
  product: [title: string, button: string];
  cart: [title: string, empty: string, button: string];
  checkout: [title: string, button: string];
  orders: [title: string, empty: string];
  tracking: string;
  account: [title: string, subtitle: string];
}

const q = JSON.stringify;

// --- shared working parts, each template dresses them its own way ----------

export const QUANTITY = 'NumberState(name: "quantity", default: 1)';
export const CHECKOUT_STATES =
  'StringState(name: "fulfilment", default: "pickup"), BoolState(name: "saveDetails", default: false)';

/** The checkout's fields, in one appearance. */
export function fields(look: string) {
  return {
    name: `TextField(name: "name", label: "Name", required: true, maxLength: 80, ${look})`,
    phone: `TextField(name: "phone", label: "Phone", type: InputType.tel, required: true, maxLength: 24, ${look})`,
    address: `TextField(name: "address", label: "Delivery address", required: true, maxLength: 200, ${look})`,
    instructions: `TextField(name: "instructions", label: "Delivery instructions", maxLength: 200, ${look})`,
    payment: `SelectField(name: "payment", label: "Payment", value: "cash", ${look}, options: [SelectOption(value: "cash", label: "Cash on collection / delivery"), SelectOption(value: "card", label: "Card on collection / delivery")])`,
    notes: `TextField(name: "notes", label: "Order notes", rows: 3, maxLength: 400, ${look})`,
    save: `Box(padding: Insets(y: 6), onTap: SetState(state: "saveDetails", value: !state.saveDetails), ariaLabel: "Save my details for next time", child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 22, height: 22, radius: Radius.sm, alignment: Anchor.center, border: Border(width: 2, color: Color.primary), background: state.saveDetails ? Color.primary : Color.surface, child: If(condition: state.saveDetails, then: Icon(name: Icons.check, size: Size.sm, color: Color.primaryInk))), Expanded(child: Text(child: "Save my details for next time"))]))`,
    account: `If(condition: state.saveDetails, then: Column(gap: Space.md, children: [TextField(name: "email", label: "Email", type: InputType.email, required: true, ${look}), TextField(name: "password", label: "Password", type: InputType.password, minLength: 8, required: true, ${look})]))`,
  };
}

/** The four tip choices, each drawn by chip(label, selected, action, ariaLabel). */
export function tips(chip: (label: string, selected: string, action: string, aria: string) => string): string[] {
  return [
    chip("No tip", "checkout.tip_cents == 0", "SetTip(cents: 0)", "No tip"),
    chip("10%", "checkout.tip_cents == round(cartTotal * 10 / 100)", "SetTip(percent: 10)", "10% tip"),
    chip("15%", "checkout.tip_cents == round(cartTotal * 15 / 100)", "SetTip(percent: 15)", "15% tip"),
    chip("20%", "checkout.tip_cents == round(cartTotal * 20 / 100)", "SetTip(percent: 20)", "20% tip"),
  ];
}

/** Pickup and delivery as two tappable choices, each drawn by tile(value, label, selected). */
export function fulfilment(tile: (value: string, label: string, selected: string) => string): string[] {
  return [
    tile("pickup", "Collection", 'state.fulfilment == "pickup"'),
    tile("delivery", "Delivery", 'state.fulfilment == "delivery"'),
  ];
}

/** The order total as the checkout shows it. */
export const TOTAL = `formatMoney(cartTotal + checkout.tip_cents + (state.fulfilment == "delivery" ? deliveryFeeCents : 0))`;

/**
 * Where a delivery goes, as the store has set delivery up: with named places
 * (deliveryOptions.mode "preset") the customer picks one, each drawn by
 * spot(selected, action), then writes the address details; priced by
 * distance, they confirm where they are as the point (ConfirmDeliveryPoint),
 * then the details.
 * PlaceOrder refuses a delivery until that's done.
 */
export function deliveryDetails(
  look: string,
  instructions: string,
  spot: (selected: string, action: string) => string,
  text: (value: string, extra?: string) => string = (value, extra = "") => `Text(child: ${value}${extra})`,
): string {
  return `If(condition: state.fulfilment == "delivery", then: Column(gap: Space.md, children: [
            If(condition: deliveryOptions.mode == "preset", then: Column(gap: Space.sm, children: [
              ${text('"Where should we deliver?"', ", weight: FontWeight.semibold")},
              ForEach(items: deliveryPresets, as: "spot", child: ${spot("checkout.delivery_preset_id == spot.id", 'SetCheckout(field: "delivery_preset_id", value: spot.id)')})
            ]), else: Column(gap: Space.sm, children: [
              ${text('"Confirm where we deliver"', ", weight: FontWeight.semibold")},
              ${text('"We deliver to \${location.label}"', ", color: Color.textMuted")},
              Button(label: checkout.delivery_point_confirmed ? "Location confirmed" : "Confirm this location", style: checkout.delivery_point_confirmed ? ButtonStyle.secondary : ButtonStyle.primary, onTap: ConfirmDeliveryPoint()),
              If(condition: checkout.delivery_point_confirmed, then: ${text('"Delivery location confirmed."', ", size: FontSize.sm, color: Color.success")}, else: ${text('"Confirm the location above to continue."', ", size: FontSize.sm, color: Color.textMuted")})
            ])),
            TextField(name: "address", label: deliveryOptions.mode == "preset" ? "Street, building and unit" : "Building, unit and any landmark", required: true, maxLength: 200, ${look}),
            ${instructions}
          ]))`;
}

/** A named place to deliver to: its name, its fee, and a tick when chosen. */
export const spotTile = (radius: string, extra = "") => (selected: string, action: string) =>
  `Box(padding: Insets(x: 14, y: 10), radius: ${radius}, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), background: ${selected} ? Color.surfaceAlt : Color.surface, onTap: ${action}, ariaLabel: spot.place_name, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: spot.place_name, weight: FontWeight.semibold${extra})), Text(child: formatMoney(spot.fee_cents), size: FontSize.sm, color: Color.textMuted), If(condition: ${selected}, then: Icon(name: Icons.check, size: Size.sm, color: Color.primary))]))`;

/** The summary lines, each drawn by line(label, value). */
export function summary(line: (label: string, value: string) => string): string[] {
  return [
    line('"Subtotal"', "formatMoney(quote.items_subtotal_cents)"),
    `If(condition: state.fulfilment == "delivery", then: ${line('"Delivery"', "formatMoney(deliveryFeeCents)")})`,
    `If(condition: checkout.tip_cents > 0, then: ${line('"Tip"', "formatMoney(checkout.tip_cents)")})`,
  ];
}

/** The tracking page's actions: cancel while it can be, rate once delivered. */
export const TRACKING_ACTIONS = (secondary: string) => `If(condition: order.status == "pending" || order.status == "confirmed", then: Button(label: "Cancel order", style: ${secondary}, onTap: CancelOrder())),
        If(condition: order.status == "delivered" && review == null, then: Wrap(spacing: Space.sm, children: [
          Text(child: "Rate your food"),
          Button(label: "5 stars", style: ButtonStyle.secondary, size: Size.sm, onTap: SubmitReview(foodRating: 5)),
          Button(label: "4 stars", style: ButtonStyle.ghost, size: Size.sm, onTap: SubmitReview(foodRating: 4)),
        ])),
        If(condition: review != null, then: Text(child: "Thanks for your review: \${review.food_rating}/5", color: Color.textMuted))`;


// --- what every template's own parts do, however they're drawn -------------

/** Finding the customer: their device, an address search, or a city. */
export const LOCATE_LABEL = 'locating ? "Finding you..." : "Use my current location"';
export const placeSearch = (look: string) =>
  `SearchField(ariaLabel: "Search address", placeholder: "Street, suburb or city", onChanged: SearchPlaces(query: input.value), ${look})`;
export const LOCATION_PROBLEM = `If(condition: locationError, then: Text(child: locationError, size: FontSize.sm, color: Color.danger))`;
export const storeSearch = (look: string) =>
  `SearchField(ariaLabel: "Search stores", placeholder: "Store name or food", onChanged: SearchStores(query: input.value), ${look})`;
export const storesLoading = (color = "Color.textMuted") =>
  `If(condition: storesLoading, then: Text(child: "Finding stores...", size: FontSize.sm, color: ${color}))`;

/** The menu: a category ("" for every one) and a search over what's available. */
export const MENU_STATES = 'StringState(name: "category", default: ""), StringState(name: "query", default: "")';
export const menuSearch = (look: string) =>
  `SearchField(state: "query", ariaLabel: "Search the menu", placeholder: "Search the menu", ${look})`;
export const SHOWN = `search(state.category == "" ? filter(products, "is_available", true) : filter(filter(products, "is_available", true), "category_id", state.category), state.query, ["name", "description"])`;
/** "All" and then each category, each drawn by chip(label, selected, action). */
export const categoryChips = (chip: (label: string, selected: string, action: string) => string, all = '"All"') =>
  `${chip(all, 'state.category == ""', 'SetState(state: "category", value: "")')},
        ForEach(items: categories, as: "cat", child: ${chip("cat.name", "state.category == cat.id", 'SetState(state: "category", value: cat.id)')})`;

/** Delivery and/or collection, as the chosen store offers them. */
export const FULFILMENT_BADGES = `Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [
        If(condition: store.accepts_delivery, then: Badge(label: "Delivery", tone: Tone.success)),
        If(condition: store.accepts_collect, then: Badge(label: "Collection", tone: Tone.primary))
      ])`;

/** A product option group's rule, and a choice's price. */
export const GROUP_RULE = 'group.single ? "Choose one" : "Up to ${group.max}"';
export const CHOICE_PRICE = 'choice.price_cents > 0 ? "+ ${formatMoney(choice.price_cents)}" : "Included"';

/** An order's status, in words. */
export const status = (o: string) =>
  `${o}.status == "pending" ? "Received" : ${o}.status == "confirmed" ? "Confirmed" : ${o}.status == "preparing" ? "Being prepared" : ${o}.status == "ready" ? "Ready" : ${o}.status == "out_for_delivery" ? "On its way" : ${o}.status == "delivered" ? "Delivered" : ${o}.status == "cancelled" ? "Cancelled" : "Not completed"`;
export const STOPPED = 'order.status == "cancelled" || order.status == "failed"';
const FLOW = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"];
/** The open order's steps, each drawn by step(label, reached, current); "on its way" is a delivery's only. */
export function progress(step: (label: string, reached: string, current: string) => string): string {
  const steps: [string, string][] = [["Received", "pending"], ["Confirmed", "confirmed"], ["Preparing", "preparing"], ["Ready", "ready"], ["On its way", "out_for_delivery"], ["Delivered", "delivered"]];
  return steps
    .map(([label, at]) => {
      const reached = "(" + FLOW.slice(FLOW.indexOf(at)).map((later) => `order.status == "${later}"`).join(" || ") + ")";
      const drawn = step(label, reached, `order.status == "${at}"`);
      return at === "out_for_delivery" ? `If(condition: order.fulfilment_type == "delivery", then: ${drawn})` : drawn;
    })
    .join(",\n          ");
}

// --- Bean & Bloom: warm, soft, centred -------------------------------------

function cafe(c: StoreCopy): Record<StorePageId, StorePageBuild> {
  const look = "background: Color.surface, border: Border(width: 1, color: Color.border), radius: Radius.lg";
  const f = fields(look);
  const circle = (icon: string, size = 64) =>
    `Box(shape: BoxShape.circle, width: ${size}, height: ${size}, alignment: Anchor.center, background: Color.surfaceAlt, child: Icon(name: Icons.${icon}, color: Color.primary))`;
  const card = (children: string) =>
    `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, border: Border(width: 1, color: Color.border), child: Column(gap: Space.md, children: [${children}]))`;
  const heading = (text: string, sub?: string) =>
    `Column(gap: Space.xs, align: Align.center, children: [Text(child: ${text}, size: FontSize.xxl, weight: FontWeight.bold, fontStyle: FontStyle.italic, align: TextAlign.center)${sub ? `, Text(child: ${sub}, color: Color.textMuted, align: TextAlign.center)` : ""}])`;
  return {
    location: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), align: Align.center, children: [
      ${circle("location", 72)},
      ${heading(q(c.location[0]), q(c.location[1]))},
      ${card(`Box(padding: Insets(x: 16, y: 12), radius: Radius.full, background: Color.surfaceAlt, onTap: UseMyLocation(), ariaLabel: "Use my current location", child: Row(gap: Space.sm, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.location, color: Color.primary), Text(child: ${LOCATE_LABEL}, weight: FontWeight.semibold, color: Color.primary)])),
        ${LOCATION_PROBLEM},
        ${placeSearch(look)},
        ForEach(items: places, as: "place", child: Box(padding: Insets(x: 14, y: 12), radius: Radius.lg, background: Color.surfaceAlt, onTap: ChoosePlace(place: place), ariaLabel: place.label, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.location, size: Size.sm, color: Color.primary), Expanded(child: Text(child: place.label)), Icon(name: Icons.chevronRight, size: Size.sm, color: Color.textMuted)])))`)},
      If(condition: cities.length > 0, then: Column(gap: Space.sm, align: Align.center, children: [
        Text(child: "Or pick a city", fontStyle: FontStyle.italic, color: Color.textMuted, align: TextAlign.center),
        ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.sm, children: [ForEach(items: cities, as: "city", child: Box(padding: Insets(x: 16, y: 8), radius: Radius.full, background: Color.surface, border: Border(width: 1, color: Color.border), onTap: ChooseCity(city: city), ariaLabel: city.name, child: Text(child: city.name)))]))
      ])),
      If(condition: location, then: Text(child: "Ordering to \${location.label}", size: FontSize.sm, color: Color.textMuted, align: TextAlign.center))
    ])`,
    },
    stores: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      Box(padding: Space.lg, radius: Radius.lg, background: Color.surfaceAlt, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        ${circle("home", 48)},
        Expanded(child: Column(gap: Space.xs, children: [Text(child: ${q(c.stores[0])}, size: FontSize.xl, weight: FontWeight.bold, fontStyle: FontStyle.italic), Text(child: ${q(c.stores[1])}, color: Color.textMuted)]))
      ])),
      If(condition: location, then: Box(padding: Insets(x: 14, y: 8), radius: Radius.full, border: Border(width: 1, color: Color.border), onTap: Navigate(to: Route.location), ariaLabel: "Change location", child: Row(gap: Space.xs, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.location, size: Size.sm, color: Color.primary), Expanded(child: Text(child: location ? location.label : "Choose your location", size: FontSize.sm)), Text(child: "Change", size: FontSize.sm, color: Color.primary)]))),
      ${storeSearch(look)},
      ${storesLoading()},
      ForEach(items: stores, as: "shop", child: Box(padding: Space.md, radius: Radius.lg, background: Color.surface, border: Border(width: 1, color: Color.border), onTap: ChooseStore(store: shop), ariaLabel: shop.name, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        ${circle("heart", 44)},
        Expanded(child: Column(gap: Space.xs, children: [Text(child: shop.name, weight: FontWeight.bold, fontStyle: FontStyle.italic), Wrap(spacing: Space.xs, children: [Text(child: shop.city, size: FontSize.sm, color: Color.textMuted), Text(child: shop.is_open ? "· Open now" : "· Closed", size: FontSize.sm, color: Color.textMuted)])])),
        Text(child: ${q(c.stores[2])}, size: FontSize.sm, weight: FontWeight.semibold, color: Color.primary)
      ])), empty: Column(gap: Space.sm, align: Align.center, children: [Text(child: "No cafés found here yet.", color: Color.textMuted, align: TextAlign.center), Button(label: "Show every café", style: ButtonStyle.secondary, onTap: SearchStores(query: ""))]))
    ])`,
    },
    menu: {
      states: MENU_STATES,
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      Box(padding: Space.lg, radius: Radius.lg, background: Color.surfaceAlt, child: Column(gap: Space.sm, children: [
        Text(child: "Good morning.", size: FontSize.xxl, weight: FontWeight.bold, fontStyle: FontStyle.italic),
        Text(child: store.is_open ? "We're open." : "We're closed right now. You can still browse.", color: Color.textMuted),
        If(condition: store.prep_time_minutes, then: Text(child: "Ready in about \${store.prep_time_minutes} minutes.", color: Color.textMuted)),
        ${FULFILMENT_BADGES}
      ])),
      Text(child: "What are you having?", size: FontSize.xl, weight: FontWeight.bold, fontStyle: FontStyle.italic),
      ${menuSearch(look)},
      ScrollView(direction: Axis.horizontal, label: "Categories", child: Row(gap: Space.sm, children: [
        ${categoryChips((label, selected, action) => `Box(padding: Insets(x: 16, y: 8), radius: Radius.full, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: ${action}, ariaLabel: ${label}, child: Text(child: ${label}, color: ${selected} ? Color.primaryInk : Color.text))`)}
      ])),
      Grid(cols: 2, gap: Space.md, children: [ForEach(items: ${SHOWN}, as: "item", child: Box(padding: Space.sm, radius: Radius.lg, background: Color.surface, border: Border(width: 1, color: Color.border), child: Column(gap: Space.sm, children: [
        Box(onTap: OpenProduct(product: item), ariaLabel: item.name, child: Column(gap: Space.xs, children: [Image(src: item.image_url, alt: item.name, aspectRatio: 1, radius: Radius.md), Text(child: item.name, weight: FontWeight.semibold, fontStyle: FontStyle.italic), Text(child: formatMoney(item.display_price_cents), size: FontSize.sm, color: Color.textMuted)])),
        Box(padding: Insets(y: 8), radius: Radius.full, alignment: Anchor.center, background: Color.surfaceAlt, onTap: AddToCart(product: item), ariaLabel: "Add \${item.name}", child: Text(child: "Add", size: FontSize.sm, weight: FontWeight.semibold, color: Color.primary))
      ])))])
    ])`,
    },
    product: {
      states: QUANTITY,
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      Button(label: "Back to the menu", style: ButtonStyle.ghost, icon: Icons.chevronLeft, onTap: Navigate(to: Route.menu)),
      If(condition: product != null, then: Column(gap: Space.lg, children: [
        Image(src: product.image_url, alt: product.name, aspectRatio: 1.2, radius: Radius.lg),
        Column(gap: Space.xs, align: Align.center, children: [
          Text(child: product.name, size: FontSize.xxl, weight: FontWeight.bold, fontStyle: FontStyle.italic, align: TextAlign.center),
          Text(child: product.description, color: Color.textMuted, align: TextAlign.center)
        ]),
        If(condition: optionGroups.length > 0, then: Text(child: ${q(c.product[0])}, size: FontSize.lg, weight: FontWeight.bold, fontStyle: FontStyle.italic)),
        ForEach(items: optionGroups, as: "group", child: Box(padding: Insets(left: group.depth > 0 ? 16 : 0), child: ${card(`Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: group.label, weight: FontWeight.bold)), If(condition: group.required, then: Badge(label: "Required", tone: Tone.warning)), Text(child: ${GROUP_RULE}, size: FontSize.xs, color: Color.textMuted)]),
          ForEach(items: group.choices, as: "choice", child: Box(padding: Insets(y: 6), onTap: ToggleOption(group: group.id, choice: choice.id), ariaLabel: choice.label, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
            Box(shape: BoxShape.circle, width: 22, height: 22, alignment: Anchor.center, border: Border(width: 2, color: choice.selected ? Color.primary : Color.border), child: If(condition: choice.selected, then: Box(shape: BoxShape.circle, width: 10, height: 10, background: Color.primary))),
            Expanded(child: Text(child: choice.label, color: choice.disabled ? Color.textMuted : Color.text)),
            Text(child: ${CHOICE_PRICE}, size: FontSize.sm, color: Color.textMuted)
          ])))`)})),
        Row(gap: Space.md, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.surfaceAlt, onTap: SetState(state: "quantity", value: state.quantity > 1 ? state.quantity - 1 : 1), ariaLabel: "Fewer", child: Icon(name: Icons.minus, color: Color.primary)),
          Text(child: state.quantity, size: FontSize.xl, weight: FontWeight.bold),
          Box(shape: BoxShape.circle, width: 44, height: 44, alignment: Anchor.center, background: Color.surfaceAlt, onTap: SetState(state: "quantity", value: state.quantity + 1), ariaLabel: "More", child: Icon(name: Icons.plus, color: Color.primary))
        ]),
        Button(label: "\${${q(c.product[1])}} · \${formatMoney((product.display_price_cents + configuration.addon_price_cents) * state.quantity)}", fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity))
      ]), else: Text(child: "Choose something from the menu.", align: TextAlign.center, color: Color.textMuted))
    ])`,
    },
    cart: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      ${heading(q(c.cart[0]))},
      ForEach(items: cart, as: "line", child: ${card(`Row(gap: Space.sm, children: [Expanded(child: Column(gap: Space.xs, children: [Text(child: line.name, weight: FontWeight.bold, fontStyle: FontStyle.italic), Wrap(spacing: Space.xs, children: [ForEach(items: line.choices, as: "choice", child: Text(child: choice, size: FontSize.xs, color: Color.textMuted))])])), Text(child: formatMoney(line.line_total_cents), weight: FontWeight.semibold)]),
        Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ChangeCartLine(line: line.id, by: -1), ariaLabel: "One fewer", child: Icon(name: Icons.minus, size: Size.sm, color: Color.primary)),
          Text(child: line.quantity, weight: FontWeight.bold),
          Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ChangeCartLine(line: line.id, by: 1), ariaLabel: "One more", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primary)),
          Spacer(),
          Button(label: "Remove", style: ButtonStyle.ghost, size: Size.sm, onTap: RemoveCartLine(line: line.id))
        ])`)}, empty: Column(gap: Space.sm, align: Align.center, children: [${circle("cart", 56)}, Text(child: ${q(c.cart[1])}, color: Color.textMuted, align: TextAlign.center)])),
      If(condition: cartCount > 0, then: Column(gap: Space.md, children: [
        Box(padding: Insets(x: 20, y: 14), radius: Radius.full, background: Color.surfaceAlt, child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "Subtotal"), Text(child: formatMoney(cartTotal), weight: FontWeight.bold)])),
        Button(label: ${q(c.cart[2])}, fullWidth: true, onTap: Navigate(to: Route.checkout))
      ])),
      Button(label: "Keep browsing", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))
    ])`,
    },
    checkout: {
      states: CHECKOUT_STATES,
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      ${heading(q(c.checkout[0]), '"A few details and it\'s on its way."')},
      If(condition: cartCount > 0, then: Form(id: "checkout", onSubmit: PlaceOrder(fulfilment: state.fulfilment), child: Column(gap: Space.lg, children: [
        ${card(`Text(child: "Who's it for?", weight: FontWeight.bold), ${f.name}, ${f.phone}`)},
        ${card(`Text(child: "How would you like it?", weight: FontWeight.bold),
          Row(gap: Space.sm, children: [${fulfilment((value, label, selected) => `Expanded(child: Box(padding: Space.md, radius: Radius.lg, alignment: Anchor.center, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: SetState(state: "fulfilment", value: "${value}"), ariaLabel: "${label}", child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.${value === "pickup" ? "home" : "location"}, color: ${selected} ? Color.primaryInk : Color.primary), Text(child: "${label}", weight: FontWeight.semibold, color: ${selected} ? Color.primaryInk : Color.text)])))`).join(", ")}]),
          ${deliveryDetails(look, f.instructions, spotTile("Radius.lg"))}`)},
        ${card(`Text(child: "Say thanks", weight: FontWeight.bold), Wrap(spacing: Space.sm, children: [${tips((label, selected, action, aria) => `Box(padding: Insets(x: 16, y: 8), radius: Radius.full, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: ${action}, ariaLabel: "${aria}", child: Text(child: "${label}", color: ${selected} ? Color.primaryInk : Color.text))`).join(", ")}]), ${f.payment}, ${f.notes}`)},
        ${f.save}, ${f.account},
        Box(padding: Space.lg, radius: Radius.lg, background: Color.surfaceAlt, child: Column(gap: Space.sm, children: [
          ${summary((label, value) => `Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: ${label}, color: Color.textMuted), Text(child: ${value})])`).join(",\n          ")},
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "Total", weight: FontWeight.bold, size: FontSize.lg), Text(child: ${TOTAL}, weight: FontWeight.bold, size: FontSize.lg)])
        ])),
        Text(child: "The café confirms the final total when you order.", size: FontSize.sm, color: Color.textMuted, align: TextAlign.center),
        SubmitButton(label: ${q(c.checkout[1])}, fullWidth: true)
      ])), else: Text(child: "Add something to your order first.", align: TextAlign.center, color: Color.textMuted))
    ])`,
    },
    orders: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), align: Align.center, children: [
      ${circle("orders")},
      ${heading(q(c.orders[0]))},
      ForEach(items: orders, as: "past", child: Box(padding: Space.md, radius: Radius.lg, background: Color.surface, border: Border(width: 1, color: Color.border), onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [${circle("clock", 40)}, Expanded(child: Column(gap: Space.xs, children: [Text(child: past.order_number, weight: FontWeight.bold), Text(child: ${status("past")}, size: FontSize.sm, fontStyle: FontStyle.italic, color: Color.textMuted)])), Text(child: formatMoney(past.total_cents), weight: FontWeight.semibold), Icon(name: Icons.chevronRight, size: Size.sm, color: Color.textMuted)])), empty: Text(child: ${q(c.orders[1])}, color: Color.textMuted, align: TextAlign.center)),
      Button(label: "Order something", onTap: Navigate(to: Route.menu))
    ])`,
    },
    tracking: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      ${heading(q(c.tracking))},
      If(condition: order != null, then: Column(gap: Space.lg, children: [
        Box(padding: Space.lg, radius: Radius.lg, background: Color.surfaceAlt, child: Column(gap: Space.md, align: Align.center, children: [
          ${circle("clock", 56)},
          Text(child: order.order_number, size: FontSize.lg, weight: FontWeight.bold),
          If(condition: ${STOPPED}, then: Badge(label: ${status("order")}, tone: Tone.danger), else: Column(gap: Space.sm, children: [
          ${progress((label, reached, current) => `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(shape: BoxShape.circle, width: 24, height: 24, alignment: Anchor.center, background: ${reached} ? Color.primary : Color.surface, border: Border(width: 1, color: Color.border), child: If(condition: ${reached}, then: Icon(name: Icons.check, size: Size.sm, color: Color.primaryInk))), Text(child: "${label}", weight: ${current} ? FontWeight.bold : FontWeight.regular, color: ${reached} ? Color.text : Color.textMuted)])`)}
          ]))
        ])),
        ${card(`ForEach(items: orderItems, as: "line", child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "\${line.quantity} × \${line.product_name}"), Text(child: formatMoney(line.line_total_cents))])),
          Divider(),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "Total", weight: FontWeight.bold), Text(child: formatMoney(order.total_cents), weight: FontWeight.bold)])`)},
        ${TRACKING_ACTIONS("ButtonStyle.secondary")}
      ]), else: Text(child: "Place an order to follow it here.", align: TextAlign.center, color: Color.textMuted)),
      Button(label: "All my orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))
    ])`,
    },
    account: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), align: Align.center, children: [
      ${circle("user", 80)},
      Text(child: me.is_anonymous ? ${q(c.account[0])} : "Hello, \${me.display_name}", size: FontSize.xxl, weight: FontWeight.bold, fontStyle: FontStyle.italic, align: TextAlign.center),
      Text(child: me.is_anonymous ? ${q(c.account[1])} : me.email, color: Color.textMuted, align: TextAlign.center),
      ${card(`Button(label: "My orders", style: ButtonStyle.ghost, icon: Icons.orders, fullWidth: true, onTap: Navigate(to: Route.orders)),
        Button(label: "Saved addresses", style: ButtonStyle.ghost, icon: Icons.location, fullWidth: true, onTap: Navigate(to: Route.addresses)),
        Button(label: "Change password", style: ButtonStyle.ghost, icon: Icons.settings, fullWidth: true, onTap: Navigate(to: Route.resetPassword))`)},
      If(condition: !me.is_anonymous, then: Button(label: "Sign out", style: ButtonStyle.secondary, onTap: SignOutPreviewCustomer()))
    ])`,
    },
    addresses: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      ${heading('"Your places"', '"Home, work, wherever the coffee goes."')},
      ForEach(items: addresses, as: "saved", child: ${card(`Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [${circle("home", 40)}, Expanded(child: Column(gap: Space.xs, children: [Row(gap: Space.xs, children: [Text(child: saved.label, weight: FontWeight.bold, fontStyle: FontStyle.italic), If(condition: saved.is_default, then: Badge(label: "Default", tone: Tone.primary))]), Text(child: saved.line1, size: FontSize.sm, color: Color.textMuted)])), Button(label: "Remove", style: ButtonStyle.ghost, size: Size.sm, onTap: RemoveAddress(address: saved.id))])`)}, empty: Text(child: "No saved places yet.", color: Color.textMuted, align: TextAlign.center)),
      ${card(`Text(child: "Add a place", weight: FontWeight.bold), Form(id: "address", onSubmit: SavePreviewAddress(), child: Column(gap: Space.md, children: [TextField(name: "label", label: "Name it (Home, Work...)", required: true, maxLength: 40, ${look}), TextField(name: "address", label: "Address", required: true, maxLength: 200, ${look}), SubmitButton(label: "Save address", fullWidth: true)]))`)}
    ])`,
    },
    "reset-password": {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), align: Align.center, children: [
      ${circle("settings")},
      ${heading('"A fresh password"', '"We\'ll email you a link to choose one."')},
      ${card(`Form(id: "resetPassword", onSubmit: ResetPreviewPassword(), child: Column(gap: Space.md, children: [TextField(name: "email", label: "Your email", type: InputType.email, required: true, ${look}), SubmitButton(label: "Email me a link", fullWidth: true)]))`)},
      Button(label: "Back to the menu", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))
    ])`,
    },
  };
}

// --- Maison Crumb: editorial, serif, numbered ------------------------------

function bakery(c: StoreCopy): Record<StorePageId, StorePageBuild> {
  const look = "background: Color.background, border: Border(width: 1, color: Color.text), radius: Radius.none";
  const f = fields(look);
  const serif = (text: string, size = "FontSize.display") => `Text(child: ${text}, size: ${size}, fontFamily: "Georgia", lineHeight: 1.05)`;
  const label = (text: string) => `Text(child: ${text}, size: FontSize.xs, weight: FontWeight.bold, letterSpacing: 3, color: Color.textMuted)`;
  const step = (n: string, title: string, children: string) =>
    `Column(gap: Space.md, children: [Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Text(child: "${n}", size: FontSize.lg, fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.primary), Text(child: "${title}", size: FontSize.lg, fontFamily: "Georgia")]), Divider(), ${children}])`;
  const line = (left: string, right: string, bold = false) =>
    `Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: ${left}, fontFamily: "Georgia"${bold ? ", weight: FontWeight.bold" : ""}), Text(child: ${right}, fontFamily: "Georgia"${bold ? ", weight: FontWeight.bold" : ""})])`;
  return {
    location: {
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      ${label('"STEP ONE · YOUR ADDRESS"')},
      ${serif(q(c.location[0]))},
      Text(child: ${q(c.location[1])}, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted),
      Divider(),
      Box(padding: Insets(y: 8), onTap: UseMyLocation(), ariaLabel: "Use my current location", child: Row(gap: Space.md, children: [Text(child: "i.", fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.primary), Expanded(child: Text(child: ${LOCATE_LABEL}, fontFamily: "Georgia")), Text(child: "→", fontFamily: "Georgia")])),
      ${LOCATION_PROBLEM},
      Divider(),
      Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Text(child: "ii.", fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.primary), Expanded(child: ${placeSearch(look)})]),
      ForEach(items: places, as: "place", child: Column(children: [Box(padding: Insets(y: 10), onTap: ChoosePlace(place: place), ariaLabel: place.label, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Column(children: [Text(child: place.main_text, fontFamily: "Georgia"), Text(child: place.secondary_text, size: FontSize.sm, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted)])), Text(child: "→", fontFamily: "Georgia")])), Divider()])),
      If(condition: cities.length > 0, then: Column(gap: Space.sm, children: [${label('"OR, BY CITY"')}, ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.md, children: [ForEach(items: cities, as: "city", child: Box(padding: Insets(y: 4), onTap: ChooseCity(city: city), ariaLabel: city.name, child: Text(child: city.name, fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.primary)))]))]))
    ])`,
    },
    stores: {
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      ${label('"STEP TWO · YOUR SHOP"')},
      ${serif(q(c.stores[0]), "FontSize.xxl")},
      If(condition: location, then: Box(onTap: Navigate(to: Route.location), ariaLabel: "Change address", child: Text(child: location ? "Near \${location.label}. Change" : "Choose your address first", fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted))),
      ${storeSearch(look)},
      ${storesLoading()},
      Divider(),
      ForEach(items: stores, as: "shop", child: Column(children: [Box(padding: Insets(y: 12), onTap: ChooseStore(store: shop), ariaLabel: shop.name, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(child: Column(gap: Space.xs, children: [Text(child: shop.name, size: FontSize.lg, fontFamily: "Georgia"), Text(child: shop.address_line1, size: FontSize.sm, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted)])),
        Text(child: shop.is_open ? "OPEN" : "CLOSED", size: FontSize.xs, letterSpacing: 2, color: shop.is_open ? Color.success : Color.textMuted)
      ])), Divider()]), empty: Column(gap: Space.sm, children: [Text(child: "No shop nearby yet.", fontFamily: "Georgia", fontStyle: FontStyle.italic), Button(label: "SEE EVERY SHOP", style: ButtonStyle.ghost, onTap: SearchStores(query: ""))]))
    ])`,
    },
    menu: {
      states: MENU_STATES,
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      ${serif('"Bread worth getting up for."')},
      Box(padding: Space.md, border: Border(width: 1, color: Color.text), child: Column(gap: Space.xs, children: [
        Text(child: store.name, fontFamily: "Georgia", size: FontSize.lg),
        Text(child: store.address_line1, color: Color.textMuted),
        Text(child: store.is_open ? "Open now" : "Closed right now", size: FontSize.sm, color: store.is_open ? Color.success : Color.danger),
        ${FULFILMENT_BADGES}
      ])),
      ${label('"THE SHOP"')},
      Text(child: "Naturally leavened, baked before sunrise.", fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.textMuted),
      ScrollView(direction: Axis.horizontal, label: "Categories", child: Row(gap: Space.lg, children: [
        ${categoryChips((text, selected, action) => `Box(padding: Insets(y: 4), onTap: ${action}, ariaLabel: ${text}, child: Column(gap: Space.xs, children: [Text(child: ${text}, size: FontSize.xs, letterSpacing: 2, fontFamily: "Georgia", color: ${selected} ? Color.text : Color.textMuted), Box(width: 24, height: 1, background: ${selected} ? Color.primary : Color.background)]))`, '"EVERYTHING"')}
      ])),
      ${menuSearch(look)},
      Divider(),
      ForEach(items: ${SHOWN}, as: "item", child: Column(gap: Space.md, children: [Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Box(width: 76, onTap: OpenProduct(product: item), ariaLabel: item.name, child: Image(src: item.image_url, alt: item.name, aspectRatio: 1, radius: Radius.none)),
        Expanded(child: Box(onTap: OpenProduct(product: item), ariaLabel: item.name, child: Column(gap: Space.xs, children: [Text(child: item.name, size: FontSize.lg, fontFamily: "Georgia"), Text(child: item.description, size: FontSize.sm, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted), Text(child: formatMoney(item.display_price_cents), fontFamily: "Georgia", color: Color.primary)]))),
        Button(label: "ADD", style: ButtonStyle.secondary, size: Size.sm, onTap: AddToCart(product: item))
      ]), Divider()]), empty: Text(child: "Nothing by that name today.", fontFamily: "Georgia", fontStyle: FontStyle.italic))
    ])`,
    },
    product: {
      states: QUANTITY,
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      Button(label: "← The shop", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu)),
      If(condition: product != null, then: Column(gap: Space.lg, children: [
        Image(src: product.image_url, alt: product.name, aspectRatio: 1, radius: Radius.none),
        ${label('"FROM THE OVEN"')},
        ${serif("product.name", "FontSize.xxl")},
        Text(child: formatMoney(product.display_price_cents), fontFamily: "Georgia", fontStyle: FontStyle.italic, size: FontSize.lg, color: Color.primary),
        Text(child: product.description, fontFamily: "Georgia", color: Color.textMuted, lineHeight: 1.5),
        Divider(),
        If(condition: optionGroups.length > 0, then: ${label(q(c.product[0].toUpperCase()))}),
        ForEach(items: optionGroups, as: "group", child: Column(gap: Space.xs, children: [
          Row(gap: Space.md, children: [Expanded(child: Text(child: group.depth > 0 ? "— \${group.label}" : group.label, fontFamily: "Georgia", size: FontSize.lg)), Text(child: ${GROUP_RULE}, size: FontSize.xs, fontStyle: FontStyle.italic, color: Color.textMuted)]),
          ForEach(items: group.choices, as: "choice", child: Box(padding: Insets(y: 6), onTap: ToggleOption(group: group.id, choice: choice.id), ariaLabel: choice.label, child: Row(gap: Space.md, children: [Text(child: choice.selected ? "●" : "○", fontFamily: "Georgia", color: Color.primary), Expanded(child: Text(child: choice.label, fontFamily: "Georgia", color: choice.disabled ? Color.textMuted : Color.text)), Text(child: ${CHOICE_PRICE}, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted)]))),
          Divider()
        ])),
        TextField(state: "quantity", label: "Quantity", type: InputType.number, min: 1, max: 99, ${look}),
        Divider(),
        ${line('"Total"', "formatMoney((product.display_price_cents + configuration.addon_price_cents) * state.quantity)", true)},
        Button(label: ${q(c.product[1].toUpperCase())}, fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity))
      ]), else: Text(child: "Choose from the shop.", fontFamily: "Georgia", fontStyle: FontStyle.italic))
    ])`,
    },
    cart: {
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      ${label('"YOUR SELECTION"')},
      ${serif(q(c.cart[0]), "FontSize.xxl")},
      Divider(),
      ForEach(items: cart, as: "line", child: Column(gap: Space.sm, children: [
        Row(gap: Space.md, children: [Expanded(child: Text(child: "\${line.quantity} × \${line.name}", size: FontSize.lg, fontFamily: "Georgia")), Text(child: formatMoney(line.line_total_cents), fontFamily: "Georgia")]),
        Wrap(spacing: Space.sm, children: [ForEach(items: line.choices, as: "choice", child: Text(child: choice, size: FontSize.sm, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted))]),
        Row(gap: Space.lg, children: [
          Box(padding: Insets(y: 4), onTap: ChangeCartLine(line: line.id, by: -1), ariaLabel: "One fewer", child: Text(child: "one fewer", size: FontSize.sm, fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.primary)),
          Box(padding: Insets(y: 4), onTap: ChangeCartLine(line: line.id, by: 1), ariaLabel: "One more", child: Text(child: "one more", size: FontSize.sm, fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.primary)),
          Box(padding: Insets(y: 4), onTap: RemoveCartLine(line: line.id), ariaLabel: "Remove", child: Text(child: "remove", size: FontSize.sm, fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.textMuted))
        ]),
        Divider()
      ]), empty: Text(child: ${q(c.cart[1])}, fontFamily: "Georgia", fontStyle: FontStyle.italic)),
      If(condition: cartCount > 0, then: Column(gap: Space.md, children: [
        Divider(),
        ${line('"Subtotal"', "formatMoney(cartTotal)", true)},
        Button(label: ${q(c.cart[2].toUpperCase())}, fullWidth: true, onTap: Navigate(to: Route.checkout))
      ])),
      Button(label: "Return to the shop", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))
    ])`,
    },
    checkout: {
      states: CHECKOUT_STATES,
      build: `Column(gap: Space.xl, padding: Insets(x: 20, y: 12), children: [
      ${serif(q(c.checkout[0]), "FontSize.xxl")},
      If(condition: cartCount > 0, then: Form(id: "checkout", onSubmit: PlaceOrder(fulfilment: state.fulfilment), child: Column(gap: Space.xl, children: [
        ${step("I.", "Your details", `${f.name}, ${f.phone}`)},
        ${step("II.", "Collection or delivery", `Column(gap: Space.xs, children: [${fulfilment((value, choice, selected) => `Box(padding: Insets(y: 8), onTap: SetState(state: "fulfilment", value: "${value}"), ariaLabel: "${choice}", child: Row(gap: Space.md, children: [Text(child: ${selected} ? "●" : "○", fontFamily: "Georgia", color: Color.primary), Text(child: "${value === "pickup" ? "Collect from the shop" : "Deliver to me"}", fontFamily: "Georgia")]))`).join(", ")}]),
          ${deliveryDetails(look, f.instructions, (selected, action) => `Box(padding: Insets(y: 8), onTap: ${action}, ariaLabel: spot.place_name, child: Row(gap: Space.md, children: [Text(child: ${selected} ? "●" : "○", fontFamily: "Georgia", color: Color.primary), Expanded(child: Text(child: spot.place_name, fontFamily: "Georgia")), Text(child: formatMoney(spot.fee_cents), fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.textMuted)]))`, (value, extra = "") => `Text(child: ${value}, fontFamily: "Georgia"${extra})`)}`)},
        ${step("III.", "Payment", `${f.payment},
          Wrap(spacing: Space.lg, children: [${tips((tipLabel, selected, action, aria) => `Box(padding: Insets(y: 6), onTap: ${action}, ariaLabel: "${aria}", border: Border(width: ${selected} ? 2 : 0, color: Color.primary), child: Text(child: "${tipLabel}", fontFamily: "Georgia", fontStyle: ${selected} ? FontStyle.italic : FontStyle.normal))`).join(", ")}])`)},
        ${step("IV.", "A note for the bakers", `${f.notes}, ${f.save}, ${f.account}`)},
        Column(gap: Space.sm, children: [
          Divider(),
          ${summary((l, v) => line(l, v)).join(",\n          ")},
          Divider(),
          ${line('"Total"', TOTAL, true)}
        ]),
        Text(child: "The shop confirms the final total with your order.", size: FontSize.sm, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted),
        SubmitButton(label: ${q(c.checkout[1].toUpperCase())}, fullWidth: true)
      ])), else: Text(child: "Your basket is empty.", fontFamily: "Georgia", fontStyle: FontStyle.italic))
    ])`,
    },
    orders: {
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      ${label('"ORDER HISTORY"')},
      ${serif(q(c.orders[0]), "FontSize.xxl")},
      Divider(),
      ForEach(items: orders, as: "past", child: Column(children: [Box(padding: Insets(y: 10), onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Row(gap: Space.md, children: [Text(child: "No. \${past.order_number}", fontFamily: "Georgia"), Expanded(child: Text(child: ${status("past")}, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted)), Text(child: formatMoney(past.total_cents), fontFamily: "Georgia")])), Divider()]), empty: Text(child: ${q(c.orders[1])}, fontFamily: "Georgia", fontStyle: FontStyle.italic)),
      Button(label: "Visit the shop", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu))
    ])`,
    },
    tracking: {
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      ${label('"YOUR ORDER"')},
      If(condition: order != null, then: Column(gap: Space.lg, children: [
        ${serif("order.order_number", "FontSize.xxl")},
        If(condition: ${STOPPED}, then: Text(child: ${status("order")}, fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.danger), else: Column(gap: Space.xs, children: [
          ${progress((step, reached, current) => `Row(gap: Space.md, children: [Text(child: ${reached} ? "✓" : "·", fontFamily: "Georgia", color: Color.primary), Text(child: "${step}", fontFamily: "Georgia", fontStyle: ${current} ? FontStyle.italic : FontStyle.normal, color: ${reached} ? Color.text : Color.textMuted)])`)}
        ])),
        Divider(),
        ForEach(items: orderItems, as: "line", child: ${line('"\\${line.quantity} × \\${line.product_name}"', "formatMoney(line.line_total_cents)")}),
        Divider(),
        ${line('"Delivery"', "formatMoney(order.delivery_fee_cents)")},
        ${line('"Total"', "formatMoney(order.total_cents)", true)},
        ${TRACKING_ACTIONS("ButtonStyle.ghost")}
      ]), else: Text(child: "Place an order to follow it here.", fontFamily: "Georgia", fontStyle: FontStyle.italic)),
      Button(label: "All orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))
    ])`,
    },
    account: {
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Box(width: 56, height: 56, alignment: Anchor.center, border: Border(width: 1, color: Color.text), child: Text(child: "MC", fontFamily: "Georgia", size: FontSize.lg)),
        Expanded(child: Column(gap: Space.xs, children: [${serif(`me.is_anonymous ? ${q(c.account[0])} : me.display_name`, "FontSize.xl")}, Text(child: me.is_anonymous ? ${q(c.account[1])} : me.email, fontStyle: FontStyle.italic, color: Color.textMuted)]))
      ]),
      Divider(),
      Button(label: "Order history", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders)),
      Divider(),
      Button(label: "Addresses", style: ButtonStyle.ghost, onTap: Navigate(to: Route.addresses)),
      Divider(),
      Button(label: "Password", style: ButtonStyle.ghost, onTap: Navigate(to: Route.resetPassword)),
      Divider(),
      If(condition: !me.is_anonymous, then: Button(label: "Sign out", style: ButtonStyle.ghost, onTap: SignOutPreviewCustomer()))
    ])`,
    },
    addresses: {
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 12), children: [
      ${label('"ADDRESSES"')},
      ${serif('"Where we deliver"', "FontSize.xxl")},
      Divider(),
      ForEach(items: addresses, as: "saved", child: Column(gap: Space.sm, children: [Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Column(gap: Space.xs, children: [Text(child: saved.is_default ? "\${saved.label} (default)" : saved.label, fontFamily: "Georgia", size: FontSize.lg), Text(child: saved.line1, fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted)])), Box(padding: Insets(y: 4), onTap: RemoveAddress(address: saved.id), ariaLabel: "Remove", child: Text(child: "remove", size: FontSize.sm, fontFamily: "Georgia", fontStyle: FontStyle.italic, color: Color.primary))]), Divider()]), empty: Text(child: "No addresses kept yet.", fontFamily: "Georgia", fontStyle: FontStyle.italic)),
      ${step("+", "A new address", `Form(id: "address", onSubmit: SavePreviewAddress(), child: Column(gap: Space.md, children: [TextField(name: "label", label: "Label", required: true, maxLength: 40, ${look}), TextField(name: "address", label: "Address", required: true, maxLength: 200, ${look}), SubmitButton(label: "SAVE", fullWidth: true)]))`)}
    ])`,
    },
    "reset-password": {
      build: `Column(gap: Space.lg, padding: Insets(x: 20, y: 24), align: Align.center, children: [
      ${label('"ACCOUNT"')},
      Text(child: "A new password", size: FontSize.xxl, fontFamily: "Georgia", align: TextAlign.center),
      Text(child: "We will email you a link to choose it.", fontStyle: FontStyle.italic, fontFamily: "Georgia", color: Color.textMuted, align: TextAlign.center),
      Form(id: "resetPassword", onSubmit: ResetPreviewPassword(), child: Column(gap: Space.md, children: [TextField(name: "email", label: "Your email", type: InputType.email, required: true, ${look}), SubmitButton(label: "SEND THE LINK", fullWidth: true)])),
      Button(label: "← The shop", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))
    ])`,
    },
  };
}

// --- Fire Slice: loud, dark, uppercase -------------------------------------

function pizza(c: StoreCopy): Record<StorePageId, StorePageBuild> {
  const look = "background: Color.surface, border: Border(width: 2, color: Color.border), radius: Radius.md";
  const f = fields(look);
  const shout = (text: string, size = "FontSize.display") => `Text(child: ${text}, size: ${size}, weight: FontWeight.bold, letterSpacing: 1, lineHeight: 1)`;
  const bar = `Box(width: 56, height: 6, radius: Radius.full, background: Color.primary)`;
  const banner = (kicker: string, title: string) =>
    `Box(padding: Space.xl, radius: Radius.lg, gradient: Gradient(from: Color.primary, to: Color.warning, begin: Anchor.topLeft, end: Anchor.bottomRight), child: Column(gap: Space.sm, children: [Text(child: ${kicker}, size: FontSize.xs, weight: FontWeight.bold, letterSpacing: 3, color: Color.primaryInk), Text(child: ${title}, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primaryInk, lineHeight: 1.05)]))`;
  const block = (title: string, children: string) =>
    `Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, child: Column(gap: Space.md, children: [Text(child: "${title}", size: FontSize.sm, weight: FontWeight.bold, letterSpacing: 2, color: Color.primary), ${children}]))`;
  const flame = (text: string) =>
    `Box(padding: Insets(x: 18, y: 16), radius: Radius.lg, gradient: Gradient(from: Color.primary, to: Color.warning, begin: Anchor.left, end: Anchor.right), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.center, children: [${text}]))`;
  return {
    location: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      ${banner('"STEP 1 OF 2"', q(c.location[0].toUpperCase()))},
      Text(child: ${q(c.location[1])}, color: Color.textMuted),
      Box(onTap: UseMyLocation(), ariaLabel: "Use my current location", child: ${flame(`Text(child: locating ? "FINDING YOU..." : "USE MY LOCATION", weight: FontWeight.bold, letterSpacing: 2, color: Color.primaryInk), Icon(name: Icons.location, color: Color.primaryInk)`)}),
      ${LOCATION_PROBLEM},
      ${placeSearch(look)},
      ForEach(items: places, as: "place", child: Box(padding: Space.md, radius: Radius.md, background: Color.surface, onTap: ChoosePlace(place: place), ariaLabel: place.label, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 4, height: 32, radius: Radius.full, background: Color.primary), Expanded(child: Column(children: [Text(child: place.main_text, weight: FontWeight.bold), Text(child: place.secondary_text, size: FontSize.xs, color: Color.textMuted)])), Icon(name: Icons.chevronRight, color: Color.primary)]))),
      If(condition: cities.length > 0, then: Column(gap: Space.sm, children: [Text(child: "OR PICK A CITY", size: FontSize.xs, weight: FontWeight.bold, letterSpacing: 2, color: Color.warning), ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.sm, children: [ForEach(items: cities, as: "city", child: Box(padding: Insets(x: 14, y: 8), radius: Radius.md, border: Border(width: 2, color: Color.primary), onTap: ChooseCity(city: city), ariaLabel: city.name, child: Text(child: city.name, weight: FontWeight.bold)))]))]))
    ])`,
    },
    stores: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${shout(q(c.stores[0].toUpperCase()), "FontSize.xxl")},
      ${bar},
      If(condition: location, then: Box(onTap: Navigate(to: Route.location), ariaLabel: "Change location", child: Row(gap: Space.xs, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.location, size: Size.sm, color: Color.primary), Text(child: location ? location.label : "SET YOUR ADDRESS", weight: FontWeight.bold)]))),
      ${storeSearch(look)},
      ${storesLoading("Color.warning")},
      ForEach(items: stores, as: "shop", child: Box(radius: Radius.lg, background: Color.surface, onTap: ChooseStore(store: shop), ariaLabel: shop.name, child: Column(children: [
        Box(padding: Space.md, child: Column(gap: Space.sm, children: [
          Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: shop.name, size: FontSize.lg, weight: FontWeight.bold)), Box(padding: Insets(x: 8, y: 4), radius: Radius.sm, background: shop.is_open ? Color.success : Color.surfaceAlt, child: Text(child: shop.is_open ? "OPEN" : "CLOSED", size: FontSize.xs, weight: FontWeight.bold, color: Color.background))]),
          Row(gap: Space.md, children: [If(condition: shop.delivery_fee_cents != null, then: Text(child: "\${formatMoney(shop.delivery_fee_cents)} DELIVERY", size: FontSize.xs, weight: FontWeight.bold, color: Color.textMuted)), If(condition: shop.prep_time_minutes, then: Text(child: "\${shop.prep_time_minutes} MIN", size: FontSize.xs, weight: FontWeight.bold, color: Color.textMuted))])
        ])),
        Box(padding: Insets(x: 16, y: 10), gradient: Gradient(from: Color.primary, to: Color.warning, begin: Anchor.left, end: Anchor.right), child: Text(child: ${q(c.stores[2].toUpperCase())}, size: FontSize.sm, weight: FontWeight.bold, letterSpacing: 2, color: Color.primaryInk))
      ])), empty: Column(gap: Space.sm, children: [Text(child: "NO KITCHENS HERE YET.", weight: FontWeight.bold), Button(label: "SHOW ALL KITCHENS", style: ButtonStyle.secondary, onTap: SearchStores(query: ""))]))
    ])`,
    },
    menu: {
      states: MENU_STATES,
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      Box(padding: Space.lg, radius: Radius.lg, gradient: Gradient(from: Color.primary, to: Color.warning, begin: Anchor.topLeft, end: Anchor.bottomRight), child: Column(gap: Space.xs, children: [
        Text(child: store.is_open ? "OVEN'S HOT" : "OVEN'S OFF", size: FontSize.xs, weight: FontWeight.bold, letterSpacing: 2, color: Color.primaryInk),
        Text(child: store.name, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primaryInk),
        If(condition: store.prep_time_minutes, then: Text(child: "Ready in about \${store.prep_time_minutes} minutes", color: Color.primaryInk))
      ])),
      Row(gap: Space.sm, children: [
        Expanded(child: Box(padding: Space.md, radius: Radius.md, background: Color.surface, child: Column(gap: Space.xs, children: [Text(child: "Delivery", size: FontSize.xs, color: Color.textMuted), Text(child: formatMoney(store.delivery_fee_cents), weight: FontWeight.bold)]))),
        Expanded(child: Box(padding: Space.md, radius: Radius.md, background: Color.surface, child: Column(gap: Space.xs, children: [Text(child: "Minimum", size: FontSize.xs, color: Color.textMuted), Text(child: formatMoney(store.min_order_cents), weight: FontWeight.bold)])))
      ]),
      ${menuSearch(look)},
      ScrollView(direction: Axis.horizontal, label: "Categories", child: Row(gap: Space.sm, children: [
        ${categoryChips((text, selected, action) => `Box(padding: Insets(x: 14, y: 8), radius: Radius.md, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: ${action}, ariaLabel: ${text}, child: Text(child: ${text}, size: FontSize.sm, weight: FontWeight.bold, letterSpacing: 1, color: ${selected} ? Color.primaryInk : Color.text))`, '"ALL"')}
      ])),
      ForEach(items: ${SHOWN}, as: "item", child: Box(radius: Radius.lg, background: Color.surface, child: Column(children: [
        Box(onTap: OpenProduct(product: item), ariaLabel: item.name, child: Stack(children: [Image(src: item.image_url, alt: item.name, aspectRatio: 1.8, radius: Radius.lg), Positioned(top: 10, left: 10, child: Box(padding: Insets(x: 10, y: 4), radius: Radius.full, background: Color.primary, child: Text(child: formatMoney(item.display_price_cents), size: FontSize.sm, weight: FontWeight.bold, color: Color.primaryInk)))])),
        Box(padding: Space.md, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Column(gap: Space.xs, children: [Text(child: item.name, size: FontSize.lg, weight: FontWeight.bold), Text(child: item.description, size: FontSize.sm, color: Color.textMuted)])), Box(width: 44, height: 44, radius: Radius.md, alignment: Anchor.center, background: Color.primary, onTap: AddToCart(product: item), ariaLabel: "Add \${item.name}", child: Icon(name: Icons.plus, color: Color.primaryInk))]))
      ])), empty: Text(child: "NOTHING ON THAT ONE.", weight: FontWeight.bold)),
      If(condition: cartCount > 0, then: Box(padding: Insets(x: 16, y: 12), radius: Radius.lg, background: Color.primary, shadow: Shadow.lg, onTap: Navigate(to: Route.cart), ariaLabel: "View cart", child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Text(child: "\${cartCount} in cart", weight: FontWeight.bold, color: Color.primaryInk),
        Expanded(child: Text(child: formatMoney(cartTotal), weight: FontWeight.bold, color: Color.primaryInk, align: TextAlign.right)),
        Icon(name: Icons.chevronRight, color: Color.primaryInk)
      ])))
    ])`,
    },
    product: {
      states: QUANTITY,
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      Button(label: "BACK", style: ButtonStyle.ghost, icon: Icons.chevronLeft, onTap: Navigate(to: Route.menu)),
      If(condition: product != null, then: Column(gap: Space.lg, children: [
        Stack(children: [
          Image(src: product.image_url, alt: product.name, aspectRatio: 1.6, radius: Radius.lg),
          Positioned(top: 12, right: 12, child: Box(padding: Insets(x: 12, y: 6), radius: Radius.full, background: Color.primary, child: Text(child: formatMoney(product.display_price_cents), weight: FontWeight.bold, color: Color.primaryInk)))
        ]),
        ${shout("product.name", "FontSize.xxl")},
        Text(child: product.description, color: Color.textMuted),
        ForEach(items: optionGroups, as: "group", child: Box(padding: Space.lg, radius: Radius.lg, background: group.depth > 0 ? Color.surfaceAlt : Color.surface, child: Column(gap: Space.md, children: [
          Row(gap: Space.sm, children: [Expanded(child: Text(child: group.label, size: FontSize.sm, weight: FontWeight.bold, letterSpacing: 2, color: Color.primary)), Text(child: group.required ? "MUST PICK" : ${GROUP_RULE}, size: FontSize.xs, weight: FontWeight.bold, color: Color.warning)]),
          Grid(cols: 2, gap: Space.sm, children: [ForEach(items: group.choices, as: "choice", child: Box(padding: Space.md, radius: Radius.md, background: choice.selected ? Color.primary : Color.surfaceAlt, onTap: ToggleOption(group: group.id, choice: choice.id), ariaLabel: choice.label, child: Column(gap: Space.xs, children: [Text(child: choice.label, weight: FontWeight.bold, color: choice.selected ? Color.primaryInk : choice.disabled ? Color.textMuted : Color.text), Text(child: ${CHOICE_PRICE}, size: FontSize.xs, color: choice.selected ? Color.primaryInk : Color.textMuted)])))])
        ]))),
        Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(width: 52, height: 52, radius: Radius.md, alignment: Anchor.center, background: Color.surfaceAlt, onTap: SetState(state: "quantity", value: state.quantity > 1 ? state.quantity - 1 : 1), ariaLabel: "Fewer", child: Icon(name: Icons.minus)),
          Expanded(child: Text(child: state.quantity, size: FontSize.xxl, weight: FontWeight.bold, align: TextAlign.center)),
          Box(width: 52, height: 52, radius: Radius.md, alignment: Anchor.center, background: Color.primary, onTap: SetState(state: "quantity", value: state.quantity + 1), ariaLabel: "More", child: Icon(name: Icons.plus, color: Color.primaryInk))
        ]),
        If(condition: product.is_available, then: Box(onTap: AddConfiguredProduct(quantity: state.quantity), ariaLabel: ${q(c.product[1])}, child: ${flame(`Text(child: ${q(c.product[1].toUpperCase())}, weight: FontWeight.bold, letterSpacing: 2, color: Color.primaryInk), Text(child: formatMoney((product.display_price_cents + configuration.addon_price_cents) * state.quantity), weight: FontWeight.bold, color: Color.primaryInk)`)}), else: Text(child: "SOLD OUT", weight: FontWeight.bold, color: Color.danger))
      ]), else: Text(child: "PICK SOMETHING FROM THE MENU.", weight: FontWeight.bold))
    ])`,
    },
    cart: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [${shout(q(c.cart[0].toUpperCase()), "FontSize.xxl")}, If(condition: cartCount > 0, then: Box(padding: Insets(x: 10, y: 4), radius: Radius.full, background: Color.primary, child: Text(child: cartCount, weight: FontWeight.bold, color: Color.primaryInk)))]),
      ${bar},
      ForEach(items: cart, as: "line", child: Box(padding: Space.md, radius: Radius.lg, background: Color.surface, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Column(gap: Space.xs, align: Align.center, children: [
          Box(width: 32, height: 32, radius: Radius.sm, alignment: Anchor.center, background: Color.primary, onTap: ChangeCartLine(line: line.id, by: 1), ariaLabel: "One more", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primaryInk)),
          Text(child: line.quantity, size: FontSize.lg, weight: FontWeight.bold),
          Box(width: 32, height: 32, radius: Radius.sm, alignment: Anchor.center, background: Color.surfaceAlt, onTap: ChangeCartLine(line: line.id, by: -1), ariaLabel: "One fewer", child: Icon(name: Icons.minus, size: Size.sm))
        ]),
        Expanded(child: Column(gap: Space.xs, children: [Text(child: line.name, weight: FontWeight.bold), Wrap(spacing: Space.xs, children: [ForEach(items: line.choices, as: "choice", child: Text(child: choice, size: FontSize.xs, color: Color.textMuted))]), Text(child: formatMoney(line.line_total_cents), weight: FontWeight.bold, color: Color.primary)])),
        Box(width: 36, height: 36, alignment: Anchor.center, onTap: RemoveCartLine(line: line.id), ariaLabel: "Remove", child: Icon(name: Icons.close, color: Color.textMuted))
      ])), empty: Text(child: ${q(c.cart[1])}, weight: FontWeight.bold)),
      If(condition: cartCount > 0, then: Box(onTap: Navigate(to: Route.checkout), ariaLabel: ${q(c.cart[2])}, child: ${flame(`Text(child: ${q(c.cart[2].toUpperCase())}, weight: FontWeight.bold, letterSpacing: 2, color: Color.primaryInk), Text(child: formatMoney(cartTotal), weight: FontWeight.bold, size: FontSize.lg, color: Color.primaryInk)`)})),
      Button(label: "ADD MORE", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu))
    ])`,
    },
    checkout: {
      states: CHECKOUT_STATES,
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      ${shout(q(c.checkout[0].toUpperCase()), "FontSize.xxl")},
      ${bar},
      If(condition: cartCount > 0, then: Form(id: "checkout", onSubmit: PlaceOrder(fulfilment: state.fulfilment), child: Column(gap: Space.lg, children: [
        ${block("01 · YOU", `${f.name}, ${f.phone}`)},
        ${block("02 · HOW", `Row(gap: Space.sm, children: [${fulfilment((value, fLabel, selected) => `Expanded(child: Box(padding: Insets(y: 14), radius: Radius.md, alignment: Anchor.center, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: SetState(state: "fulfilment", value: "${value}"), ariaLabel: "${fLabel}", child: Text(child: "${fLabel.toUpperCase()}", weight: FontWeight.bold, letterSpacing: 2, color: ${selected} ? Color.primaryInk : Color.text)))`).join(", ")}]),
          ${deliveryDetails(look, f.instructions, (selected, action) => `Box(padding: Space.md, radius: Radius.md, background: ${selected} ? Color.primary : Color.surfaceAlt, onTap: ${action}, ariaLabel: spot.place_name, child: Row(children: [Expanded(child: Text(child: spot.place_name, weight: FontWeight.bold, letterSpacing: 1, color: ${selected} ? Color.primaryInk : Color.text)), Text(child: formatMoney(spot.fee_cents), weight: FontWeight.bold, color: ${selected} ? Color.primaryInk : Color.warning)]))`)}`)},
        ${block("03 · PAY & TIP", `${f.payment}, Row(gap: Space.sm, children: [${tips((tLabel, selected, action, aria) => `Expanded(child: Box(padding: Insets(y: 12), radius: Radius.md, alignment: Anchor.center, background: ${selected} ? Color.warning : Color.surfaceAlt, onTap: ${action}, ariaLabel: "${aria}", child: Text(child: "${tLabel.toUpperCase()}", size: FontSize.sm, weight: FontWeight.bold, color: ${selected} ? Color.background : Color.text)))`).join(", ")}])`)},
        ${block("04 · EXTRAS", `${f.notes}, ${f.save}, ${f.account}`)},
        ${summary((l, v) => `Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: ${l}, color: Color.textMuted), Text(child: ${v}, weight: FontWeight.bold)])`).join(",\n        ")},
        ${flame(`Text(child: "TOTAL", weight: FontWeight.bold, letterSpacing: 2, color: Color.primaryInk), Text(child: ${TOTAL}, size: FontSize.xl, weight: FontWeight.bold, color: Color.primaryInk)`)},
        SubmitButton(label: ${q(c.checkout[1].toUpperCase())}, fullWidth: true)
      ])), else: Text(child: "YOUR CART'S EMPTY.", weight: FontWeight.bold))
    ])`,
    },
    orders: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${shout('"ORDER AGAIN"', "FontSize.xxl")},
      ${bar},
      Text(child: ${q(c.orders[0])}, color: Color.textMuted),
      ForEach(items: orders, as: "past", child: Box(padding: Space.md, radius: Radius.lg, background: Color.surface, onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 6, height: 40, radius: Radius.full, background: Color.primary), Expanded(child: Column(gap: Space.xs, children: [Text(child: "#\${past.order_number}", weight: FontWeight.bold), Text(child: ${status("past")}, size: FontSize.xs, weight: FontWeight.bold, letterSpacing: 1, color: Color.warning)])), Text(child: formatMoney(past.total_cents), size: FontSize.lg, weight: FontWeight.bold)])), empty: Text(child: ${q(c.orders[1])}, weight: FontWeight.bold)),
      Button(label: "HIT THE MENU", fullWidth: true, onTap: Navigate(to: Route.menu))
    ])`,
    },
    tracking: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      If(condition: order != null, then: Column(gap: Space.lg, children: [
        ${banner('"ORDER \${order.order_number}"', q(c.tracking.toUpperCase()))},
        If(condition: ${STOPPED}, then: Text(child: ${status("order")}, size: FontSize.xl, weight: FontWeight.bold, color: Color.danger), else: Column(gap: Space.sm, children: [
          ${progress((step, reached, current) => `Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 28, height: 28, radius: Radius.sm, alignment: Anchor.center, background: ${reached} ? Color.primary : Color.surfaceAlt, child: If(condition: ${reached}, then: Icon(name: Icons.check, size: Size.sm, color: Color.primaryInk))), Text(child: "${step.toUpperCase()}", weight: FontWeight.bold, letterSpacing: 1, color: ${current} ? Color.warning : ${reached} ? Color.text : Color.textMuted)])`)}
        ])),
        ${block("IN THE BOX", `ForEach(items: orderItems, as: "line", child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "\${line.quantity}× \${line.product_name}", weight: FontWeight.semibold), Text(child: formatMoney(line.line_total_cents))])), Divider(), Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "TOTAL", weight: FontWeight.bold, letterSpacing: 2), Text(child: formatMoney(order.total_cents), weight: FontWeight.bold, color: Color.primary)])`)},
        ${TRACKING_ACTIONS("ButtonStyle.secondary")}
      ]), else: Text(child: "NO ORDER TO TRACK YET.", weight: FontWeight.bold)),
      Button(label: "ALL ORDERS", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))
    ])`,
    },
    account: {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      ${banner('"YOUR ACCOUNT"', `me.is_anonymous ? ${q(c.account[0].toUpperCase())} : "YO, \${me.display_name}"`)},
      Text(child: me.is_anonymous ? ${q(c.account[1])} : me.email, color: Color.textMuted),
      Grid(cols: 2, gap: Space.sm, children: [
        Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, onTap: Navigate(to: Route.orders), ariaLabel: "Orders", child: Column(gap: Space.sm, children: [Icon(name: Icons.orders, color: Color.primary), Text(child: "ORDERS", weight: FontWeight.bold, letterSpacing: 2)])),
        Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, onTap: Navigate(to: Route.addresses), ariaLabel: "Addresses", child: Column(gap: Space.sm, children: [Icon(name: Icons.location, color: Color.primary), Text(child: "ADDRESSES", weight: FontWeight.bold, letterSpacing: 2)])),
        Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, onTap: Navigate(to: Route.resetPassword), ariaLabel: "Password", child: Column(gap: Space.sm, children: [Icon(name: Icons.settings, color: Color.primary), Text(child: "PASSWORD", weight: FontWeight.bold, letterSpacing: 2)])),
        Box(padding: Space.lg, radius: Radius.lg, background: Color.surface, onTap: Navigate(to: Route.menu), ariaLabel: "Menu", child: Column(gap: Space.sm, children: [Icon(name: Icons.home, color: Color.primary), Text(child: "MENU", weight: FontWeight.bold, letterSpacing: 2)]))
      ]),
      If(condition: !me.is_anonymous, then: Button(label: "SIGN OUT", style: ButtonStyle.secondary, onTap: SignOutPreviewCustomer()))
    ])`,
    },
    addresses: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${shout('"DROP-OFF SPOTS"', "FontSize.xxl")},
      ${bar},
      ForEach(items: addresses, as: "saved", child: Box(padding: Space.md, radius: Radius.lg, background: Color.surface, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 6, height: 40, radius: Radius.full, background: saved.is_default ? Color.warning : Color.primary), Expanded(child: Column(gap: Space.xs, children: [Text(child: saved.label, weight: FontWeight.bold), Text(child: saved.line1, size: FontSize.sm, color: Color.textMuted)])), Box(width: 36, height: 36, alignment: Anchor.center, onTap: RemoveAddress(address: saved.id), ariaLabel: "Remove", child: Icon(name: Icons.close, color: Color.textMuted))])), empty: Text(child: "NO SPOTS SAVED.", weight: FontWeight.bold)),
      ${block("ADD ONE", `Form(id: "address", onSubmit: SavePreviewAddress(), child: Column(gap: Space.md, children: [TextField(name: "label", label: "Label", required: true, maxLength: 40, ${look}), TextField(name: "address", label: "Address", required: true, maxLength: 200, ${look}), SubmitButton(label: "SAVE IT", fullWidth: true)]))`)}
    ])`,
    },
    "reset-password": {
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      ${banner('"SECURITY"', '"NEW PASSWORD"')},
      Form(id: "resetPassword", onSubmit: ResetPreviewPassword(), child: Column(gap: Space.md, children: [TextField(name: "email", label: "Your email", type: InputType.email, required: true, ${look}), SubmitButton(label: "SEND RESET LINK", fullWidth: true)])),
      Button(label: "BACK TO THE MENU", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))
    ])`,
    },
  };
}

// --- Green Basket: practical, tiles, steppers -------------------------------

function grocer(c: StoreCopy): Record<StorePageId, StorePageBuild> {
  const look = "background: Color.surface, border: Border(width: 1, color: Color.border), radius: Radius.md";
  const f = fields(look);
  const tile = (icon: string, title: string, text: string) =>
    `Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.${icon}, color: Color.primary), Expanded(child: Column(children: [Text(child: ${title}, weight: FontWeight.semibold, size: FontSize.sm), Text(child: ${text}, size: FontSize.xs, color: Color.textMuted)]))]))`;
  const steps = (current: number) =>
    `Row(gap: Space.xs, crossAxisAlignment: CrossAxisAlignment.center, children: [${["Address", "Store", "Shop"]
      .map(
        (name, i) =>
          `Box(padding: Insets(x: 10, y: 4), radius: Radius.full, background: ${i <= current ? "Color.primary" : "Color.surfaceAlt"}, child: Text(child: "${i < current ? "✓ " : ""}${name}", size: FontSize.xs, weight: FontWeight.semibold, color: ${i <= current ? "Color.primaryInk" : "Color.textMuted"}))`,
      )
      .join(", ")}])`;
  const section = (icon: string, title: string, children: string) =>
    `Box(padding: Space.md, radius: Radius.lg, border: Border(width: 1, color: Color.border), child: Column(gap: Space.md, children: [Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, background: Color.surfaceAlt, child: Icon(name: Icons.${icon}, size: Size.sm, color: Color.primary)), Text(child: "${title}", weight: FontWeight.bold)]), ${children}]))`;
  const heading = (text: string) => `Text(child: ${text}, size: FontSize.xxl, weight: FontWeight.bold, color: Color.primary)`;
  return {
    location: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${steps(0)},
      ${heading(q(c.location[0]))},
      Text(child: ${q(c.location[1])}, color: Color.textMuted),
      Grid(cols: 2, gap: Space.sm, children: [
        Box(padding: Space.md, radius: Radius.md, background: Color.primary, onTap: UseMyLocation(), ariaLabel: "Use my current location", child: Column(gap: Space.xs, children: [Icon(name: Icons.location, color: Color.primaryInk), Text(child: locating ? "Finding you..." : "Use my location", size: FontSize.sm, weight: FontWeight.semibold, color: Color.primaryInk)])),
        ${tile("clock", '"Same day"', '"From your nearest store"')}
      ]),
      ${LOCATION_PROBLEM},
      ${placeSearch(look)},
      ForEach(items: places, as: "place", child: Box(padding: Space.md, radius: Radius.md, border: Border(width: 1, color: Color.border), onTap: ChoosePlace(place: place), ariaLabel: place.label, child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.location, size: Size.sm, color: Color.primary), Expanded(child: Column(children: [Text(child: place.main_text, weight: FontWeight.semibold), Text(child: place.secondary_text, size: FontSize.xs, color: Color.textMuted)]))]))),
      If(condition: cities.length > 0, then: ${section("home", "Shop by city", `ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.sm, children: [ForEach(items: cities, as: "city", child: Box(padding: Insets(x: 12, y: 6), radius: Radius.full, background: Color.surfaceAlt, onTap: ChooseCity(city: city), ariaLabel: city.name, child: Text(child: city.name, size: FontSize.sm, weight: FontWeight.semibold, color: Color.primary)))]))`)})
    ])`,
    },
    stores: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${steps(1)},
      ${heading(q(c.stores[0]))},
      If(condition: location, then: Box(onTap: Navigate(to: Route.location), ariaLabel: "Change address", child: ${tile("location", '"Delivering to"', 'location ? location.label : "Choose your address"')})),
      ${storeSearch(look)},
      ${storesLoading()},
      ForEach(items: stores, as: "shop", child: Box(padding: Space.md, radius: Radius.lg, border: Border(width: 1, color: Color.border), onTap: ChooseStore(store: shop), ariaLabel: shop.name, child: Column(gap: Space.sm, children: [
        Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: shop.name, weight: FontWeight.bold)), Badge(label: shop.is_open ? "Open" : "Closed", tone: shop.is_open ? Tone.success : Tone.neutral)]),
        Grid(cols: 3, gap: Space.xs, children: [
          Box(padding: Space.xs, radius: Radius.sm, background: Color.surfaceAlt, child: Column(children: [Text(child: "Delivery", size: FontSize.xs, color: Color.textMuted), Text(child: formatMoney(shop.delivery_fee_cents), size: FontSize.sm, weight: FontWeight.semibold)])),
          Box(padding: Space.xs, radius: Radius.sm, background: Color.surfaceAlt, child: Column(children: [Text(child: "Minimum", size: FontSize.xs, color: Color.textMuted), Text(child: formatMoney(shop.min_order_cents), size: FontSize.sm, weight: FontWeight.semibold)])),
          Box(padding: Space.xs, radius: Radius.sm, background: Color.surfaceAlt, child: Column(children: [Text(child: "Ready in", size: FontSize.xs, color: Color.textMuted), Text(child: "\${shop.prep_time_minutes} min", size: FontSize.sm, weight: FontWeight.semibold)]))
        ]),
        Text(child: ${q(c.stores[2] + " →")}, size: FontSize.sm, weight: FontWeight.semibold, color: Color.primary)
      ])), empty: Column(gap: Space.sm, children: [Text(child: "No stores deliver here yet."), Button(label: "See all stores", style: ButtonStyle.secondary, onTap: SearchStores(query: ""))]))
    ])`,
    },
    menu: {
      states: MENU_STATES,
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      Grid(cols: 3, gap: Space.sm, children: [
        Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.clock, color: Color.primary), Text(child: store.is_open ? "Open" : "Closed", size: FontSize.sm, weight: FontWeight.semibold, align: TextAlign.center)])),
        Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.location, color: Color.primary), Text(child: "\${formatMoney(store.delivery_fee_cents)} delivery", size: FontSize.sm, weight: FontWeight.semibold, align: TextAlign.center)])),
        Box(padding: Space.md, radius: Radius.md, background: Color.surfaceAlt, child: Column(gap: Space.xs, align: Align.center, children: [Icon(name: Icons.cart, color: Color.primary), Text(child: "\${formatMoney(store.min_order_cents)} min", size: FontSize.sm, weight: FontWeight.semibold, align: TextAlign.center)]))
      ]),
      ${FULFILMENT_BADGES},
      ${menuSearch(look)},
      ScrollView(direction: Axis.horizontal, label: "Aisles", child: Row(gap: Space.sm, children: [
        ${categoryChips((text, selected, action) => `Box(padding: Insets(x: 14, y: 8), radius: Radius.full, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), background: ${selected} ? Color.surfaceAlt : Color.surface, onTap: ${action}, ariaLabel: ${text}, child: Row(gap: Space.xs, children: [If(condition: ${selected}, then: Icon(name: Icons.check, size: Size.sm, color: Color.primary)), Text(child: ${text}, size: FontSize.sm, weight: FontWeight.semibold)]))`, '"All aisles"')}
      ])),
      Grid(cols: 3, gap: Space.sm, children: [ForEach(items: ${SHOWN}, as: "item", child: Box(padding: Space.sm, radius: Radius.md, border: Border(width: 1, color: Color.border), child: Column(gap: Space.xs, children: [
        Box(onTap: OpenProduct(product: item), ariaLabel: item.name, child: Column(gap: Space.xs, children: [Box(padding: Space.xs, radius: Radius.md, background: Color.surfaceAlt, child: Image(src: item.image_url, alt: item.name, aspectRatio: 1, radius: Radius.sm)), Text(child: item.name, size: FontSize.sm, weight: FontWeight.semibold), Text(child: formatMoney(item.display_price_cents), size: FontSize.sm, weight: FontWeight.bold, color: Color.primary)])),
        Button(label: "Add", size: Size.sm, fullWidth: true, onTap: AddToCart(product: item))
      ])))])
    ])`,
    },
    product: {
      states: QUANTITY,
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      Button(label: "Back to the aisles", style: ButtonStyle.ghost, icon: Icons.chevronLeft, onTap: Navigate(to: Route.menu)),
      If(condition: product != null, then: Column(gap: Space.md, children: [
        Box(padding: Space.lg, radius: Radius.lg, background: Color.surfaceAlt, child: Image(src: product.image_url, alt: product.name, aspectRatio: 1.4, radius: Radius.md)),
        Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Expanded(child: Text(child: product.name, size: FontSize.xl, weight: FontWeight.bold)),
          Box(padding: Insets(x: 12, y: 6), radius: Radius.full, background: Color.primary, child: Text(child: formatMoney(product.display_price_cents), weight: FontWeight.bold, color: Color.primaryInk))
        ]),
        Text(child: product.description, color: Color.textMuted),
        ForEach(items: optionGroups, as: "group", child: Box(padding: Space.md, radius: Radius.lg, border: Border(width: 1, color: Color.border), background: group.depth > 0 ? Color.surfaceAlt : Color.surface, child: Column(gap: Space.sm, children: [
          Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(shape: BoxShape.circle, width: 28, height: 28, alignment: Anchor.center, background: Color.surfaceAlt, child: Icon(name: Icons.check, size: Size.sm, color: Color.primary)), Expanded(child: Text(child: group.label, weight: FontWeight.bold)), Badge(label: group.required ? "Required" : "Optional", tone: group.required ? Tone.warning : Tone.neutral)]),
          Text(child: ${GROUP_RULE}, size: FontSize.xs, color: Color.textMuted),
          Wrap(spacing: Space.sm, runSpacing: Space.sm, children: [ForEach(items: group.choices, as: "choice", child: Box(padding: Insets(x: 12, y: 8), radius: Radius.full, border: Border(width: 1, color: choice.selected ? Color.primary : Color.border), background: choice.selected ? Color.surfaceAlt : Color.surface, onTap: ToggleOption(group: group.id, choice: choice.id), ariaLabel: choice.label, child: Row(gap: Space.xs, children: [If(condition: choice.selected, then: Icon(name: Icons.check, size: Size.sm, color: Color.primary)), Text(child: choice.label, size: FontSize.sm, weight: FontWeight.semibold, color: choice.disabled ? Color.textMuted : Color.text), If(condition: choice.price_cents > 0, then: Text(child: "+\${formatMoney(choice.price_cents)}", size: FontSize.xs, color: Color.textMuted))])))])
        ]))),
        Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(padding: Space.xs, radius: Radius.full, border: Border(width: 1, color: Color.border), child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [
            Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, onTap: SetState(state: "quantity", value: state.quantity > 1 ? state.quantity - 1 : 1), ariaLabel: "Fewer", child: Icon(name: Icons.minus, size: Size.sm, color: Color.primary)),
            Text(child: state.quantity, weight: FontWeight.bold),
            Box(shape: BoxShape.circle, width: 36, height: 36, alignment: Anchor.center, background: Color.primary, onTap: SetState(state: "quantity", value: state.quantity + 1), ariaLabel: "More", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primaryInk))
          ])),
          Expanded(child: Button(label: ${q(c.product[1])}, fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity)))
        ]),
        Text(child: "Total \${formatMoney((product.display_price_cents + configuration.addon_price_cents) * state.quantity)}", color: Color.textMuted, align: TextAlign.right)
      ]), else: Text(child: "Choose an item from the aisles."))
    ])`,
    },
    cart: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: ${heading(q(c.cart[0]))}), Badge(label: "\${cartCount} items", tone: Tone.primary)]),
      ForEach(items: cart, as: "line", child: Box(padding: Space.sm, radius: Radius.md, border: Border(width: 1, color: Color.border), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(child: Column(gap: Space.xs, children: [Text(child: line.name, weight: FontWeight.semibold), Wrap(spacing: Space.xs, runSpacing: Space.xs, children: [ForEach(items: line.choices, as: "choice", child: Badge(label: choice, tone: Tone.neutral))]), Text(child: formatMoney(line.line_total_cents), weight: FontWeight.bold, color: Color.primary)])),
        Box(padding: Space.xs, radius: Radius.full, border: Border(width: 1, color: Color.border), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(shape: BoxShape.circle, width: 30, height: 30, alignment: Anchor.center, onTap: ChangeCartLine(line: line.id, by: -1), ariaLabel: "One fewer", child: Icon(name: Icons.minus, size: Size.sm, color: Color.primary)),
          Text(child: line.quantity, weight: FontWeight.bold),
          Box(shape: BoxShape.circle, width: 30, height: 30, alignment: Anchor.center, background: Color.primary, onTap: ChangeCartLine(line: line.id, by: 1), ariaLabel: "One more", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primaryInk))
        ])),
        Box(width: 30, height: 30, alignment: Anchor.center, onTap: RemoveCartLine(line: line.id), ariaLabel: "Remove", child: Icon(name: Icons.close, size: Size.sm, color: Color.textMuted))
      ])), empty: ${tile("cart", q(c.cart[1]), '"Add something from the aisles."')}),
      If(condition: cartCount > 0, then: Box(padding: Space.md, radius: Radius.lg, background: Color.surfaceAlt, child: Column(gap: Space.sm, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "Items"), Text(child: cartCount)]),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "Subtotal", weight: FontWeight.bold), Text(child: formatMoney(cartTotal), weight: FontWeight.bold)]),
        Text(child: "Delivery and any tip are added at checkout.", size: FontSize.xs, color: Color.textMuted)
      ]))),
      If(condition: cartCount > 0, then: Row(gap: Space.sm, children: [
        Expanded(child: Button(label: "Keep shopping", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu))),
        Expanded(child: Button(label: ${q(c.cart[2])}, onTap: Navigate(to: Route.checkout)))
      ]), else: Button(label: "Start shopping", onTap: Navigate(to: Route.menu)))
    ])`,
    },
    checkout: {
      states: CHECKOUT_STATES,
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${heading(q(c.checkout[0]))},
      If(condition: cartCount > 0, then: Form(id: "checkout", onSubmit: PlaceOrder(fulfilment: state.fulfilment), child: Column(gap: Space.md, children: [
        ${section("user", "Contact", `Grid(cols: Responsive(base: 1, md: 2), gap: Space.sm, children: [${f.name}, ${f.phone}])`)},
        ${section("location", "Delivery or collection", `Row(gap: Space.sm, children: [${fulfilment((value, fLabel, selected) => `Box(padding: Insets(x: 14, y: 8), radius: Radius.full, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), background: ${selected} ? Color.surfaceAlt : Color.surface, onTap: SetState(state: "fulfilment", value: "${value}"), ariaLabel: "${fLabel}", child: Row(gap: Space.xs, children: [If(condition: ${selected}, then: Icon(name: Icons.check, size: Size.sm, color: Color.primary)), Text(child: "${fLabel}", weight: FontWeight.semibold)]))`).join(", ")}]),
          ${deliveryDetails(look, f.instructions, spotTile("Radius.md"))}`)},
        ${section("cart", "Payment and tip", `${f.payment}, Grid(cols: 4, gap: Space.xs, children: [${tips((tLabel, selected, action, aria) => `Box(padding: Insets(y: 10), radius: Radius.md, alignment: Anchor.center, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), onTap: ${action}, ariaLabel: "${aria}", child: Text(child: "${tLabel}", size: FontSize.sm, weight: FontWeight.semibold, color: ${selected} ? Color.primary : Color.text))`).join(", ")}])`)},
        ${section("email", "Notes and account", `${f.notes}, ${f.save}, ${f.account}`)},
        Box(padding: Space.md, radius: Radius.lg, background: Color.surfaceAlt, child: Column(gap: Space.sm, children: [
          ${summary((l, v) => `Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: ${l}), Text(child: ${v})])`).join(",\n          ")},
          Divider(),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "Total", weight: FontWeight.bold), Text(child: ${TOTAL}, weight: FontWeight.bold, color: Color.primary)])
        ])),
        Text(child: "The store confirms the final total when the order is placed.", size: FontSize.xs, color: Color.textMuted),
        SubmitButton(label: ${q(c.checkout[1])}, fullWidth: true)
      ])), else: Text(child: "Your basket is empty."))
    ])`,
    },
    orders: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${heading(q(c.orders[0]))},
      ${tile("orders", '"Reorder in a tap"', '"Open an order to see what was in it."')},
      ForEach(items: orders, as: "past", child: Box(padding: Space.md, radius: Radius.md, border: Border(width: 1, color: Color.border), onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.orders, color: Color.primary), Expanded(child: Column(children: [Text(child: past.order_number, weight: FontWeight.semibold), Text(child: formatMoney(past.total_cents), size: FontSize.sm, color: Color.textMuted)])), Badge(label: ${status("past")}, tone: past.status == "delivered" ? Tone.success : past.status == "cancelled" || past.status == "failed" ? Tone.danger : Tone.primary)])), empty: Text(child: ${q(c.orders[1])}, color: Color.textMuted)),
      Button(label: "Start a new basket", onTap: Navigate(to: Route.menu))
    ])`,
    },
    tracking: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${heading(q(c.tracking))},
      If(condition: order != null, then: Column(gap: Space.md, children: [
        Grid(cols: 2, gap: Space.sm, children: [${tile("orders", '"Order"', "order.order_number")}, ${tile("cart", '"Total"', "formatMoney(order.total_cents)")}]),
        If(condition: ${STOPPED}, then: Badge(label: ${status("order")}, tone: Tone.danger), else: ${section("clock", "Progress", progress((step, reached, current) => `Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.check, size: Size.sm, color: ${reached} ? Color.primary : Color.border), Expanded(child: Text(child: "${step}", weight: ${current} ? FontWeight.bold : FontWeight.regular, color: ${reached} ? Color.text : Color.textMuted)), If(condition: ${current}, then: Badge(label: "Now", tone: Tone.primary))])`))}),
        ${section("check", "In your basket", `ForEach(items: orderItems, as: "line", child: Row(gap: Space.sm, children: [Badge(label: line.quantity, tone: Tone.primary), Expanded(child: Text(child: line.product_name)), Text(child: formatMoney(line.line_total_cents))]))`)},
        ${TRACKING_ACTIONS("ButtonStyle.secondary")}
      ]), else: Text(child: "Place an order to track it here.")),
      Button(label: "All orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))
    ])`,
    },
    account: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${heading(`me.is_anonymous ? ${q(c.account[0])} : "Hi, \${me.display_name}"`)},
      Text(child: me.is_anonymous ? ${q(c.account[1])} : me.email, color: Color.textMuted),
      Grid(cols: 2, gap: Space.sm, children: [
        Box(padding: Space.md, radius: Radius.lg, border: Border(width: 1, color: Color.border), onTap: Navigate(to: Route.orders), ariaLabel: "Orders", child: Row(gap: Space.sm, children: [Icon(name: Icons.orders, color: Color.primary), Text(child: "Orders", weight: FontWeight.semibold)])),
        Box(padding: Space.md, radius: Radius.lg, border: Border(width: 1, color: Color.border), onTap: Navigate(to: Route.addresses), ariaLabel: "Addresses", child: Row(gap: Space.sm, children: [Icon(name: Icons.location, color: Color.primary), Text(child: "Addresses", weight: FontWeight.semibold)])),
        Box(padding: Space.md, radius: Radius.lg, border: Border(width: 1, color: Color.border), onTap: Navigate(to: Route.resetPassword), ariaLabel: "Password", child: Row(gap: Space.sm, children: [Icon(name: Icons.settings, color: Color.primary), Text(child: "Password", weight: FontWeight.semibold)])),
        Box(padding: Space.md, radius: Radius.lg, border: Border(width: 1, color: Color.border), onTap: Navigate(to: Route.cart), ariaLabel: "Basket", child: Row(gap: Space.sm, children: [Icon(name: Icons.cart, color: Color.primary), Text(child: "Basket", weight: FontWeight.semibold)]))
      ]),
      If(condition: !me.is_anonymous, then: Button(label: "Sign out", style: ButtonStyle.ghost, onTap: SignOutPreviewCustomer()))
    ])`,
    },
    addresses: {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${heading('"Delivery addresses"')},
      ForEach(items: addresses, as: "saved", child: Box(padding: Space.md, radius: Radius.md, border: Border(width: 1, color: Color.border), child: Row(gap: Space.sm, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.location, color: Color.primary), Expanded(child: Column(children: [Row(gap: Space.xs, children: [Text(child: saved.label, weight: FontWeight.semibold), If(condition: saved.is_default, then: Badge(label: "Default", tone: Tone.success))]), Text(child: saved.line1, size: FontSize.sm, color: Color.textMuted)])), Box(width: 30, height: 30, alignment: Anchor.center, onTap: RemoveAddress(address: saved.id), ariaLabel: "Remove", child: Icon(name: Icons.close, size: Size.sm, color: Color.textMuted))])), empty: Text(child: "No delivery addresses yet.", color: Color.textMuted)),
      ${section("plus", "New address", `Form(id: "address", onSubmit: SavePreviewAddress(), child: Column(gap: Space.sm, children: [TextField(name: "label", label: "Label", required: true, maxLength: 40, ${look}), TextField(name: "address", label: "Address", required: true, maxLength: 200, ${look}), SubmitButton(label: "Save address", fullWidth: true)]))`)}
    ])`,
    },
    "reset-password": {
      build: `Column(gap: Space.md, padding: Insets(x: 16, y: 8), children: [
      ${heading('"Reset your password"')},
      ${tile("email", '"Keep your account safe"', '"We\'ll email you a reset link."')},
      Form(id: "resetPassword", onSubmit: ResetPreviewPassword(), child: Column(gap: Space.sm, children: [TextField(name: "email", label: "Your email", type: InputType.email, required: true, ${look}), SubmitButton(label: "Send reset link", fullWidth: true)])),
      Button(label: "Back to the aisles", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))
    ])`,
    },
  };
}

// --- Kiri: quiet, centred, gold lines --------------------------------------

function sushi(c: StoreCopy): Record<StorePageId, StorePageBuild> {
  const look = "background: Color.background, border: Border(width: 1, color: Color.border), radius: Radius.sm";
  const f = fields(look);
  const mark = (text: string) =>
    `Row(gap: Space.md, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 24, height: 1, background: Color.primary), Text(child: ${text}, size: FontSize.xs, letterSpacing: 4, color: Color.primary), Box(width: 24, height: 1, background: Color.primary)])`;
  const title = (text: string) => `Text(child: ${text}, size: FontSize.xxl, letterSpacing: 2, align: TextAlign.center, lineHeight: 1.2)`;
  const frame = (children: string) =>
    `Box(padding: Space.lg, radius: Radius.sm, border: Border(width: 1, color: Color.border), child: Column(gap: Space.md, children: [${children}]))`;
  const label = (text: string) => `Text(child: ${text}, size: FontSize.xs, letterSpacing: 3, color: Color.textMuted)`;
  const goldLine = `Box(height: 1, background: Color.primary)`;
  return {
    location: {
      build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${mark('"DELIVERY"')},
      ${title(q(c.location[0]))},
      Text(child: ${q(c.location[1])}, color: Color.textMuted, align: TextAlign.center),
      Box(padding: Insets(y: 12), radius: Radius.sm, alignment: Anchor.center, border: Border(width: 1, color: Color.primary), onTap: UseMyLocation(), ariaLabel: "Use my current location", child: Text(child: locating ? "FINDING YOU" : "USE MY LOCATION", size: FontSize.sm, letterSpacing: 3, color: Color.primary)),
      ${LOCATION_PROBLEM},
      ${placeSearch(look)},
      ForEach(items: places, as: "place", child: Column(gap: Space.sm, children: [Box(padding: Insets(y: 6), onTap: ChoosePlace(place: place), ariaLabel: place.label, child: Column(gap: Space.xs, align: Align.center, children: [Text(child: place.main_text, letterSpacing: 1, align: TextAlign.center), Text(child: place.secondary_text, size: FontSize.xs, color: Color.textMuted, align: TextAlign.center)])), ${goldLine}])),
      If(condition: cities.length > 0, then: Column(gap: Space.md, align: Align.center, children: [${label('"OR CHOOSE A CITY"')}, ScrollView(direction: Axis.horizontal, label: "Cities", child: Row(gap: Space.sm, children: [ForEach(items: cities, as: "city", child: Box(padding: Insets(x: 14, y: 6), radius: Radius.full, border: Border(width: 1, color: Color.border), onTap: ChooseCity(city: city), ariaLabel: city.name, child: Text(child: city.name, size: FontSize.sm, letterSpacing: 2)))]))]))
    ])`,
    },
    stores: {
      build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${mark('"RESTAURANTS"')},
      ${title(q(c.stores[0]))},
      If(condition: location, then: Box(onTap: Navigate(to: Route.location), ariaLabel: "Change location", child: Text(child: location ? location.label : "Choose where to deliver", color: Color.textMuted, align: TextAlign.center))),
      ${storeSearch(look)},
      ${storesLoading("Color.primary")},
      ForEach(items: stores, as: "shop", child: Box(padding: Space.lg, radius: Radius.sm, border: Border(width: 1, color: Color.border), onTap: ChooseStore(store: shop), ariaLabel: shop.name, child: Column(gap: Space.sm, align: Align.center, children: [
        Text(child: shop.name, size: FontSize.lg, letterSpacing: 3, align: TextAlign.center),
        Text(child: shop.city, size: FontSize.sm, color: Color.textMuted, align: TextAlign.center),
        If(condition: shop.rating, then: Row(gap: Space.xs, mainAxisAlignment: MainAxisAlignment.center, children: [Icon(name: Icons.star, size: Size.sm, color: Color.primary), Text(child: shop.rating, size: FontSize.sm, color: Color.primary)])),
        Text(child: shop.is_open ? "OPEN" : "CLOSED", size: FontSize.xs, letterSpacing: 4, color: shop.is_open ? Color.primary : Color.textMuted),
        Text(child: ${q(c.stores[2].toUpperCase())}, size: FontSize.xs, letterSpacing: 3)
      ])), empty: Column(gap: Space.md, align: Align.center, children: [Text(child: "No restaurant nearby yet.", color: Color.textMuted, align: TextAlign.center), Button(label: "All restaurants", style: ButtonStyle.ghost, onTap: SearchStores(query: ""))]))
    ])`,
    },
    menu: {
      states: MENU_STATES,
      build: `Column(gap: Space.lg, padding: Insets(x: 16, y: 8), children: [
      Box(padding: Space.xl, radius: Radius.lg, gradient: Gradient(from: Color.surfaceAlt, to: Color.background, begin: Anchor.top, end: Anchor.bottom), border: Border(width: 1, color: Color.border), child: Column(gap: Space.sm, children: [
        Text(child: store.name, size: FontSize.xxl, weight: FontWeight.bold, lineHeight: 1.1),
        If(condition: store.rating && store.rating_count, then: Row(gap: Space.xs, crossAxisAlignment: CrossAxisAlignment.center, children: [Icon(name: Icons.star, size: Size.sm, color: Color.primary), Text(child: "\${store.rating} · \${store.rating_count} reviews", color: Color.textMuted)])),
        Text(child: store.is_open ? "Open now" : "Closed right now", color: store.is_open ? Color.primary : Color.textMuted),
        ${FULFILMENT_BADGES}
      ])),
      ${mark('"MENU"')},
      ScrollView(direction: Axis.horizontal, label: "Categories", child: Row(gap: Space.lg, children: [
        ${categoryChips((text, selected, action) => `Box(padding: Insets(y: 4), onTap: ${action}, ariaLabel: ${text}, child: Column(gap: Space.xs, align: Align.center, children: [Text(child: ${text}, size: FontSize.xs, letterSpacing: 3, color: ${selected} ? Color.primary : Color.textMuted), Box(width: 16, height: 1, background: ${selected} ? Color.primary : Color.background)]))`, '"ALL"')}
      ])),
      ${menuSearch(look)},
      Grid(cols: 2, gap: Space.lg, children: [ForEach(items: ${SHOWN}, as: "item", child: Column(gap: Space.sm, align: Align.center, children: [
        Box(onTap: OpenProduct(product: item), ariaLabel: item.name, child: Column(gap: Space.xs, align: Align.center, children: [Image(src: item.image_url, alt: item.name, aspectRatio: 1, radius: Radius.lg), Text(child: item.name, letterSpacing: 1, align: TextAlign.center), Text(child: formatMoney(item.display_price_cents), size: FontSize.sm, letterSpacing: 2, color: Color.primary)])),
        Box(shape: BoxShape.circle, width: 32, height: 32, alignment: Anchor.center, border: Border(width: 1, color: Color.primary), onTap: AddToCart(product: item), ariaLabel: "Add \${item.name}", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primary))
      ]))])
    ])`,
    },
    product: {
      states: QUANTITY,
      build: `Column(gap: Space.lg, padding: Insets(x: 24, y: 12), children: [
      Button(label: "Menu", style: ButtonStyle.ghost, icon: Icons.chevronLeft, onTap: Navigate(to: Route.menu)),
      If(condition: product != null, then: Column(gap: Space.lg, align: Align.center, children: [
        Image(src: product.image_url, alt: product.name, aspectRatio: 1.3, radius: Radius.lg),
        ${title("product.name")},
        Text(child: formatMoney(product.display_price_cents), letterSpacing: 2, color: Color.primary, align: TextAlign.center),
        Text(child: product.description, color: Color.textMuted, align: TextAlign.center, lineHeight: 1.6),
        ${goldLine},
        ForEach(items: optionGroups, as: "group", child: Column(gap: Space.sm, children: [
          Row(gap: Space.md, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [Box(width: 16, height: 1, background: Color.primary), Text(child: group.label, size: FontSize.xs, letterSpacing: 3, color: Color.primary), Box(width: 16, height: 1, background: Color.primary)]),
          Text(child: ${GROUP_RULE}, size: FontSize.xs, color: Color.textMuted, align: TextAlign.center),
          ForEach(items: group.choices, as: "choice", child: Box(padding: Insets(y: 8), onTap: ToggleOption(group: group.id, choice: choice.id), ariaLabel: choice.label, child: Row(gap: Space.md, crossAxisAlignment: CrossAxisAlignment.center, children: [Expanded(child: Text(child: choice.label, letterSpacing: 1, color: choice.selected ? Color.primary : choice.disabled ? Color.textMuted : Color.text)), Text(child: ${CHOICE_PRICE}, size: FontSize.sm, color: Color.textMuted), If(condition: choice.selected, then: Icon(name: Icons.check, size: Size.sm, color: Color.primary))])))
        ])),
        ${goldLine},
        Row(gap: Space.xl, mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(onTap: SetState(state: "quantity", value: state.quantity > 1 ? state.quantity - 1 : 1), ariaLabel: "Fewer", child: Icon(name: Icons.minus, color: Color.primary)),
          Text(child: state.quantity, size: FontSize.xl, letterSpacing: 2),
          Box(onTap: SetState(state: "quantity", value: state.quantity + 1), ariaLabel: "More", child: Icon(name: Icons.plus, color: Color.primary))
        ]),
        Button(label: "\${${q(c.product[1])}} · \${formatMoney((product.display_price_cents + configuration.addon_price_cents) * state.quantity)}", style: ButtonStyle.secondary, fullWidth: true, disabled: !product.is_available, onTap: AddConfiguredProduct(quantity: state.quantity))
      ]), else: Text(child: "Choose from the menu.", color: Color.textMuted, align: TextAlign.center))
    ])`,
    },
    cart: {
      build: `Column(gap: Space.lg, padding: Insets(x: 24, y: 24), children: [
      ${mark('"YOUR ORDER"')},
      ForEach(items: cart, as: "line", child: Column(gap: Space.sm, children: [
        Row(gap: Space.md, children: [Expanded(child: Text(child: "\${line.name} × \${line.quantity}", letterSpacing: 1)), Text(child: formatMoney(line.line_total_cents), color: Color.primary)]),
        Wrap(spacing: Space.sm, children: [ForEach(items: line.choices, as: "choice", child: Text(child: choice, size: FontSize.xs, color: Color.textMuted))]),
        Row(gap: Space.lg, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Box(onTap: ChangeCartLine(line: line.id, by: -1), ariaLabel: "One fewer", child: Icon(name: Icons.minus, size: Size.sm, color: Color.primary)),
          Box(onTap: ChangeCartLine(line: line.id, by: 1), ariaLabel: "One more", child: Icon(name: Icons.plus, size: Size.sm, color: Color.primary)),
          Spacer(),
          Box(onTap: RemoveCartLine(line: line.id), ariaLabel: "Remove", child: Text(child: "REMOVE", size: FontSize.xs, letterSpacing: 3, color: Color.textMuted))
        ]),
        ${goldLine}
      ]), empty: Text(child: ${q(c.cart[1])}, color: Color.textMuted, align: TextAlign.center)),
      If(condition: cartCount > 0, then: Column(gap: Space.md, children: [
        ${goldLine},
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [${label('"SUBTOTAL"')}, Text(child: formatMoney(cartTotal), size: FontSize.lg, color: Color.primary)]),
        Button(label: ${q(c.cart[2])}, fullWidth: true, onTap: Navigate(to: Route.checkout))
      ])),
      Button(label: "Continue browsing", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))
    ])`,
    },
    checkout: {
      states: CHECKOUT_STATES,
      build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${mark('"CHECKOUT"')},
      If(condition: cartCount > 0, then: Form(id: "checkout", onSubmit: PlaceOrder(fulfilment: state.fulfilment), child: Column(gap: Space.lg, children: [
        ${label('"GUEST"')}, ${f.name}, ${f.phone},
        ${goldLine},
        ${label('"SERVICE"')},
        Row(gap: Space.lg, mainAxisAlignment: MainAxisAlignment.center, children: [${fulfilment((value, fLabel, selected) => `Box(padding: Insets(x: 20, y: 10), radius: Radius.sm, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), onTap: SetState(state: "fulfilment", value: "${value}"), ariaLabel: "${fLabel}", child: Text(child: "${fLabel.toUpperCase()}", size: FontSize.sm, letterSpacing: 3, color: ${selected} ? Color.primary : Color.textMuted))`).join(", ")}]),
        ${deliveryDetails(look, f.instructions, (selected, action) => `Box(padding: Insets(x: 16, y: 10), radius: Radius.sm, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), onTap: ${action}, ariaLabel: spot.place_name, child: Row(children: [Expanded(child: Text(child: spot.place_name, letterSpacing: 2, color: ${selected} ? Color.primary : Color.text)), Text(child: formatMoney(spot.fee_cents), size: FontSize.sm, color: Color.textMuted)]))`)},
        ${goldLine},
        ${label('"PAYMENT"')}, ${f.payment},
        Row(gap: Space.md, mainAxisAlignment: MainAxisAlignment.center, children: [${tips((tLabel, selected, action, aria) => `Box(padding: Insets(x: 12, y: 6), radius: Radius.full, border: Border(width: 1, color: ${selected} ? Color.primary : Color.border), onTap: ${action}, ariaLabel: "${aria}", child: Text(child: "${tLabel}", size: FontSize.sm, color: ${selected} ? Color.primary : Color.textMuted))`).join(", ")}]),
        ${f.notes}, ${f.save}, ${f.account},
        ${goldLine},
        ${summary((l, v) => `Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: ${l}, color: Color.textMuted), Text(child: ${v})])`).join(",\n        ")},
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [${label('"TOTAL"')}, Text(child: ${TOTAL}, size: FontSize.lg, color: Color.primary)]),
        SubmitButton(label: ${q(c.checkout[1])}, fullWidth: true)
      ])), else: Text(child: "Your order is empty.", color: Color.textMuted, align: TextAlign.center))
    ])`,
    },
    orders: {
      build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${mark('"HISTORY"')},
      ${title(q(c.orders[0]))},
      ForEach(items: orders, as: "past", child: Box(padding: Space.lg, radius: Radius.sm, border: Border(width: 1, color: Color.border), onTap: OpenOrder(order: past.id), ariaLabel: "Order \${past.order_number}", child: Column(gap: Space.xs, align: Align.center, children: [Text(child: past.order_number, letterSpacing: 4), Text(child: ${status("past")}, size: FontSize.xs, letterSpacing: 3, color: Color.primary), Text(child: formatMoney(past.total_cents), size: FontSize.sm, color: Color.textMuted)])), empty: Text(child: ${q(c.orders[1])}, color: Color.textMuted, align: TextAlign.center)),
      Button(label: "Return to the menu", style: ButtonStyle.secondary, onTap: Navigate(to: Route.menu))
    ])`,
    },
    tracking: {
      build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${mark('"IN PROGRESS"')},
      If(condition: order != null, then: Column(gap: Space.lg, align: Align.center, children: [
        ${title(q(c.tracking))},
        Text(child: order.order_number, letterSpacing: 4, color: Color.primary),
        If(condition: ${STOPPED}, then: Text(child: ${status("order")}, letterSpacing: 3, color: Color.danger), else: Column(gap: Space.sm, align: Align.center, children: [
          ${progress((step, reached, current) => `Column(gap: Space.xs, align: Align.center, children: [Box(shape: BoxShape.circle, width: 10, height: 10, background: ${reached} ? Color.primary : Color.border), Text(child: "${step.toUpperCase()}", size: FontSize.xs, letterSpacing: 3, color: ${current} ? Color.primary : ${reached} ? Color.text : Color.textMuted)])`)}
        ])),
        ${frame(`ForEach(items: orderItems, as: "line", child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(child: "\${line.product_name} × \${line.quantity}"), Text(child: formatMoney(line.line_total_cents), color: Color.textMuted)])), ${goldLine}, Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [${label('"TOTAL"')}, Text(child: formatMoney(order.total_cents), color: Color.primary)])`)},
        ${TRACKING_ACTIONS("ButtonStyle.ghost")}
      ]), else: Text(child: "There is no order to follow yet.", color: Color.textMuted, align: TextAlign.center)),
      Button(label: "All orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders))
    ])`,
    },
    account: {
      build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), align: Align.center, children: [
      Box(shape: BoxShape.circle, width: 72, height: 72, alignment: Anchor.center, border: Border(width: 1, color: Color.primary), child: Icon(name: Icons.user, color: Color.primary)),
      ${title(`me.is_anonymous ? ${q(c.account[0])} : me.display_name`)},
      Text(child: me.is_anonymous ? ${q(c.account[1])} : me.email, color: Color.textMuted, align: TextAlign.center),
      ${goldLine},
      Button(label: "Orders", style: ButtonStyle.ghost, onTap: Navigate(to: Route.orders)),
      Button(label: "Addresses", style: ButtonStyle.ghost, onTap: Navigate(to: Route.addresses)),
      Button(label: "Password", style: ButtonStyle.ghost, onTap: Navigate(to: Route.resetPassword)),
      If(condition: !me.is_anonymous, then: Button(label: "Sign out", style: ButtonStyle.ghost, onTap: SignOutPreviewCustomer()))
    ])`,
    },
    addresses: {
      build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 24), children: [
      ${mark('"ADDRESSES"')},
      ForEach(items: addresses, as: "saved", child: ${frame(`Text(child: saved.label, letterSpacing: 3, align: TextAlign.center), Text(child: saved.line1, size: FontSize.sm, color: Color.textMuted, align: TextAlign.center), If(condition: saved.is_default, then: Text(child: "DEFAULT", size: FontSize.xs, letterSpacing: 4, color: Color.primary, align: TextAlign.center)), Button(label: "Remove", style: ButtonStyle.ghost, size: Size.sm, onTap: RemoveAddress(address: saved.id))`)}, empty: Text(child: "No addresses saved.", color: Color.textMuted, align: TextAlign.center)),
      ${frame(`${label('"NEW ADDRESS"')}, Form(id: "address", onSubmit: SavePreviewAddress(), child: Column(gap: Space.md, children: [TextField(name: "label", label: "Label", required: true, maxLength: 40, ${look}), TextField(name: "address", label: "Address", required: true, maxLength: 200, ${look}), SubmitButton(label: "Save", fullWidth: true)]))`)}
    ])`,
    },
    "reset-password": {
      build: `Column(gap: Space.xl, padding: Insets(x: 24, y: 32), children: [
      ${mark('"ACCOUNT"')},
      ${title('"New password"')},
      ${frame(`Form(id: "resetPassword", onSubmit: ResetPreviewPassword(), child: Column(gap: Space.md, children: [TextField(name: "email", label: "Your email", type: InputType.email, required: true, ${look}), SubmitButton(label: "Send link", fullWidth: true)]))`)},
      Button(label: "Menu", style: ButtonStyle.ghost, onTap: Navigate(to: Route.menu))
    ])`,
    },
  };
}

/** Each template's pages, by its slug. */
export const storeTemplatePages: Record<string, (copy: StoreCopy) => Record<StorePageId, StorePageBuild>> = {
  "bean-and-bloom": cafe,
  "maison-crumb": bakery,
  "fire-slice": pizza,
  "green-basket": grocer,
  "kiri-sushi": sushi,
};
