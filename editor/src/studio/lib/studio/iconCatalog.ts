// Synced from Upskale Studio (upskaleapp/src/lib/studio/iconCatalog.ts). Edit it there, then npm run sync.
/**
 * Every icon a project can use by name (Icons.cart, MaterialIcons.truck…),
 * with the glyph each library draws for it in the generated Flutter app:
 * Material from Flutter itself, Feather from its maintained fork
 * (lucide_icons_flutter), Bootstrap from bootstrap_icons. The preview draws
 * the same glyphs from react-icons (constants/studio/studio-icon). One list,
 * so a name works in every library, the preview and the build alike.
 *
 * Grouped as the icon picker shows them; the first nineteen are the
 * original set, in their original order.
 */
export interface IconEntry {
  name: string;
  group: string;
  /** Words the picker's search also matches. */
  keywords: string;
  dart: { material: string; lucide: string; bootstrap: string };
}

const icon = (name: string, group: string, keywords: string, material: string, lucide: string, bootstrap: string): IconEntry => ({
  name,
  group,
  keywords,
  dart: { material: "Icons." + material, lucide: "LucideIcons." + lucide, bootstrap: "BootstrapIcons." + bootstrap },
});

export const ICON_CATALOG: IconEntry[] = [
  icon("cart", "Shopping", "bag basket buy", "shopping_bag", "shoppingBag", "bag_fill"),
  icon("menu", "Navigation", "hamburger lines", "menu", "menu", "list"),
  icon("close", "Navigation", "x dismiss cancel", "close", "x", "x"),
  icon("search", "Actions", "find magnifier", "search", "search", "search"),
  icon("user", "People", "account person profile", "person", "user", "person_fill"),
  icon("home", "Navigation", "house start", "home", "house", "house_fill"),
  icon("orders", "Shopping", "receipt history", "receipt", "fileText", "receipt"),
  icon("star", "Status", "favourite rating", "star", "star", "star_fill"),
  icon("clock", "Time", "time hours", "access_time", "clock", "clock"),
  icon("plus", "Actions", "add more", "add", "plus", "plus"),
  icon("minus", "Actions", "remove less", "remove", "minus", "dash"),
  icon("chevronLeft", "Navigation", "back previous", "chevron_left", "chevronLeft", "chevron_left"),
  icon("chevronRight", "Navigation", "next forward", "chevron_right", "chevronRight", "chevron_right"),
  icon("chevronDown", "Navigation", "expand open", "expand_more", "chevronDown", "chevron_down"),
  icon("settings", "Actions", "gear preferences", "settings", "settings", "gear_fill"),
  icon("location", "Places", "pin address map", "location_on", "mapPin", "geo_alt_fill"),
  icon("heart", "Status", "like love favourite", "favorite", "heart", "heart_fill"),
  icon("email", "People", "mail message", "email", "mail", "envelope_fill"),
  icon("check", "Status", "done tick yes", "check", "check", "check"),
  icon("basket", "Shopping", "cart trolley", "shopping_cart", "shoppingCart", "cart"),
  icon("delivery", "Shopping", "truck shipping courier", "local_shipping", "truck", "truck"),
  icon("gift", "Shopping", "present voucher", "card_giftcard", "gift", "gift"),
  icon("tag", "Shopping", "price sale offer", "local_offer", "tag", "tag"),
  icon("card", "Payments", "credit debit pay", "credit_card", "creditCard", "credit_card"),
  icon("cash", "Payments", "money notes pay", "payments", "banknote", "cash"),
  icon("coffee", "Food", "cafe drink cup", "local_cafe", "coffee", "cup_hot"),
  icon("phone", "People", "call telephone", "phone", "phone", "telephone_fill"),
  icon("chat", "People", "message talk", "chat", "messageCircle", "chat_fill"),
  icon("bell", "Status", "notification alert", "notifications", "bell", "bell_fill"),
  icon("info", "Status", "about details", "info", "info", "info_circle"),
  icon("warning", "Status", "alert caution", "warning", "triangleAlert", "exclamation_triangle"),
  icon("help", "Status", "question support", "help", "circleHelp", "question_circle"),
  icon("thumbsUp", "Status", "like good", "thumb_up", "thumbsUp", "hand_thumbs_up"),
  icon("lock", "Status", "secure private", "lock", "lock", "lock_fill"),
  icon("eye", "Actions", "view show visible", "visibility", "eye", "eye"),
  icon("edit", "Actions", "pencil change write", "edit", "pencil", "pencil"),
  icon("delete", "Actions", "trash bin remove", "delete", "trash2", "trash"),
  icon("share", "Actions", "send", "share", "share2", "share"),
  icon("refresh", "Actions", "reload again", "refresh", "refreshCw", "arrow_clockwise"),
  icon("logout", "Actions", "sign out leave exit", "logout", "logOut", "box_arrow_right"),
  icon("camera", "Media", "photo picture", "photo_camera", "camera", "camera"),
  icon("image", "Media", "photo picture gallery", "image", "image", "image"),
  icon("list", "Layout", "rows items", "list", "list", "list_ul"),
  icon("grid", "Layout", "tiles items", "grid_view", "layoutGrid", "grid"),
  icon("calendar", "Time", "date day schedule", "calendar_today", "calendar", "calendar"),
  icon("map", "Places", "directions area", "map", "map", "map"),
  icon("navigation", "Places", "direction arrow go", "navigation", "navigation", "cursor"),
  icon("arrowLeft", "Navigation", "back", "arrow_back", "arrowLeft", "arrow_left"),
  icon("arrowRight", "Navigation", "forward next", "arrow_forward", "arrowRight", "arrow_right"),
  icon("chevronUp", "Navigation", "collapse close", "expand_less", "chevronUp", "chevron_up"),
  icon("sun", "Status", "light mode day bright", "light_mode", "sun", "sun"),
  icon("moon", "Status", "dark mode night", "dark_mode", "moon", "moon_fill"),
];

export const ICON_GROUPS = [...new Set(ICON_CATALOG.map((entry) => entry.group))];
