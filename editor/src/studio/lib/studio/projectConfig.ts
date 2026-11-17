// Synced from Upskale Studio (upskaleapp/src/lib/studio/projectConfig.ts). Edit it there, then npm run sync.
import { ICON_CATALOG } from "./iconCatalog";
import { validPageTransition, type PageTransition } from "./pageTransitions";

/** Every icon name a project can use (iconCatalog: the glyph each library draws for it). */
export const iconNames = ICON_CATALOG.map((entry) => entry.name);
export const iconLibraries = {
  material: { label: "Material", namespace: "MaterialIcons" },
  feather: { label: "Feather", namespace: "FeatherIcons" },
  bootstrap: { label: "Bootstrap", namespace: "BootstrapIcons" },
} as const;
export type IconLibrary = keyof typeof iconLibraries;
/** How the generated app picks its palette. Absent means "light": the app
 * has one theme, exactly as before dark palettes existed. */
export const themeModes = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof themeModes)[number];
export interface StudioConfig {
  /** The light palette (and where custom colour tokens are defined). */
  colors: Record<string, string>;
  /** The dark palette: built-in roles and custom tokens set for dark. A
   * custom token without one here uses its light value in dark too. */
  darkColors?: Record<string, string>;
  themeMode?: ThemeMode;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  fontSizes: Record<string, number>;
  iconSizes: Record<string, number>;
  iconLibrary: IconLibrary;
  /** How pages are entered unless a page sets its own; absent is "platform". */
  pageTransition?: PageTransition;
  /**
   * The Google Maps display key GoogleMap draws with: public by design (it
   * ships in the app and the site), so restricted to them in Google Cloud.
   * Never the instance's search key, which stays on the server.
   */
  googleMapsKey?: string;
  /** How the messages actions show look (ShowMessage, a failed order…); absent is the default dark toast at the bottom. */
  notice?: NoticeStyle;
}

/** The action message toast: its colours (colour tokens), where it shows, and for how long. */
export interface NoticeStyle {
  background?: string;
  color?: string;
  position?: "top" | "bottom";
  /** 1 to 10; absent is 4. */
  seconds?: number;
}

/** Whether a notice style is one Config takes: tokens the project has, a known place, 1–10 seconds. */
export function validNoticeStyle(value: unknown, colors: unknown): value is NoticeStyle {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const token = (name: unknown) =>
    typeof name === "string" &&
    (builtInToken("colors", name) || (!!colors && typeof colors === "object" && Object.hasOwn(colors, name)));
  return (
    Object.keys(item).every((key) => ["background", "color", "position", "seconds"].includes(key)) &&
    (item.background === undefined || token(item.background)) &&
    (item.color === undefined || token(item.color)) &&
    (item.position === undefined || item.position === "top" || item.position === "bottom") &&
    (item.seconds === undefined || (typeof item.seconds === "number" && item.seconds >= 1 && item.seconds <= 10))
  );
}

/** A Google API key as Config takes it: letters, digits, - and _, nothing that could break out of where it's written. */
export const GOOGLE_MAPS_KEY = /^[A-Za-z0-9_-]{20,100}$/;
export const sizeDefaults = {
  spacing: { none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radii: { none: 0, sm: 4, md: 8, lg: 16, xl: 24, full: 9999 },
  fontSizes: { xs: 11, sm: 13, md: 16, lg: 20, xl: 26, xxl: 36, display: 48 },
  iconSizes: { sm: 16, md: 22, lg: 30 },
};
export const colorVariables: Record<string, string> = {
  primary: "--color-accent",
  primaryInk: "--color-on-accent",
  background: "--fixture-bg",
  surface: "--fixture-paper",
  surfaceAlt: "--fixture-bg",
  text: "--fixture-ink",
  textMuted: "--fixture-muted",
  border: "--fixture-border",
  success: "--color-accent",
  danger: "--color-danger",
  warning: "--color-chart-amber",
};
/** True when the generated app has a dark theme as well (system or dark). */
export const usesDarkTheme = (config?: StudioConfig) =>
  config?.themeMode === "dark" || config?.themeMode === "system";

/**
 * One palette's overrides: the light one is `colors` as stored; the dark one
 * is `darkColors` over the custom tokens' light values. Built-in roles are
 * never carried from light into dark: the dark defaults stand unless set.
 */
export function paletteColors(config: StudioConfig | undefined, theme: "light" | "dark"): Record<string, string> {
  if (theme === "light") return { ...config?.colors };
  const custom = Object.fromEntries(
    customTokens(config, "colors").map((name) => [name, config!.colors[name]]),
  );
  return { ...custom, ...config?.darkColors };
}
export function defaultStudioConfig(): StudioConfig {
  return {
    colors: {},
    spacing: {},
    radii: {},
    fontSizes: {},
    iconSizes: {},
    iconLibrary: "material",
  };
}
export const validHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/**
 * Projects can add their own tokens next to the built-in ones — Color.brand,
 * Space.gutter — stored in the same config groups. A custom name is a short
 * camelCase identifier so it reads like the built-ins in Flux and in Dart.
 */
export const customTokenPattern = /^[a-z][A-Za-z0-9]{0,31}$/;
export const MAX_CUSTOM_TOKENS = 24;
export type TokenGroup = "colors" | keyof typeof sizeDefaults;
/** Which config group backs each Flux token family. */
export const tokenGroups: Record<string, TokenGroup> = {
  Color: "colors",
  Space: "spacing",
  Radius: "radii",
  FontSize: "fontSizes",
  Size: "iconSizes",
};
const reservedNames = new Set(["constructor", "prototype", "toString", "valueOf"]);
export function builtInToken(group: TokenGroup, name: string) {
  return group === "colors"
    ? Object.hasOwn(colorVariables, name)
    : Object.hasOwn(sizeDefaults[group], name);
}
export function validCustomTokenName(name: string) {
  return customTokenPattern.test(name) && !reservedNames.has(name);
}
/** The names a project added itself, in the order they were added. */
export function customTokens(config: StudioConfig | undefined, group: TokenGroup) {
  return Object.keys(config?.[group] ?? {}).filter(
    (name) => !builtInToken(group, name),
  );
}

/**
 * The project the editor is working on, so the language service can accept
 * and suggest its custom tokens. Set by the workspace; the Dart compiler
 * scopes it to the project it is compiling with withProjectConfig.
 */
let activeConfig: StudioConfig | undefined;
export function setActiveProjectConfig(config: StudioConfig | undefined) {
  activeConfig = config;
}
export function withProjectConfig<T>(config: StudioConfig | undefined, run: () => T): T {
  const previous = activeConfig;
  activeConfig = config;
  try {
    return run();
  } finally {
    activeConfig = previous;
  }
}
/** Custom token names for a Flux family (Color, Space, …) in the active project. */
export function activeCustomTokens(family: string): string[] {
  const group = tokenGroups[family];
  return group ? customTokens(activeConfig, group) : [];
}
export function validStudioConfig(
  value: unknown,
): value is StudioConfig | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (
    Object.keys(item).some(
      (key) =>
        ![
          "colors",
          "darkColors",
          "themeMode",
          "spacing",
          "radii",
          "fontSizes",
          "iconSizes",
          "iconLibrary",
          "pageTransition",
          "googleMapsKey",
          "notice",
        ].includes(key),
    ) ||
    (item.notice !== undefined && !validNoticeStyle(item.notice, item.colors)) ||
    (item.googleMapsKey !== undefined && (typeof item.googleMapsKey !== "string" || !GOOGLE_MAPS_KEY.test(item.googleMapsKey))) ||
    typeof item.iconLibrary !== "string" ||
    !Object.hasOwn(iconLibraries, item.iconLibrary) ||
    (item.themeMode !== undefined && !themeModes.includes(item.themeMode as ThemeMode)) ||
    (item.pageTransition !== undefined && !validPageTransition(item.pageTransition))
  )
    return false;
  if (item.darkColors !== undefined) {
    const dark = item.darkColors;
    const light = item.colors;
    if (!dark || typeof dark !== "object" || Array.isArray(dark)) return false;
    if (!light || typeof light !== "object" || Array.isArray(light)) return false;
    // Built-in roles, or a custom token the light palette defines.
    for (const [key, val] of Object.entries(dark))
      if (!(builtInToken("colors", key) || Object.hasOwn(light, key)) || !validHexColor(val)) return false;
  }
  for (const group of [
    "colors",
    "spacing",
    "radii",
    "fontSizes",
    "iconSizes",
  ] as const) {
    const values = item[group];
    if (!values || typeof values !== "object" || Array.isArray(values))
      return false;
    const known = (key: string) =>
      builtInToken(group, key) || validCustomTokenName(key);
    if (
      Object.keys(values).filter((key) => !builtInToken(group, key)).length >
      MAX_CUSTOM_TOKENS
    )
      return false;
    for (const [key, val] of Object.entries(values)) {
      if (group === "colors") {
        if (!known(key) || !validHexColor(val)) return false;
      } else {
        const max = {
          spacing: 256,
          radii: 9999,
          fontSizes: 160,
          iconSizes: 128,
        }[group];
        if (
          !known(key) ||
          typeof val !== "number" ||
          !Number.isFinite(val) ||
          val < (group === "fontSizes" || group === "iconSizes" ? 1 : 0) ||
          val > max
        )
          return false;
      }
    }
  }
  return true;
}
/** CSS overrides are scoped to app content; the dashboard keeps its own
 * theme. `theme` is the preview's: each has its own palette. */
export function configVariables(config?: StudioConfig, theme: "light" | "dark" = "light"): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [name, color] of Object.entries(paletteColors(config, theme))) {
    style["--studio-color-" + name] = color;
    // Built-in roles also repaint the fixture chrome; custom colors are only
    // ever read through their own --studio-color-* variable.
    if (
      Object.hasOwn(colorVariables, name) &&
      !["surfaceAlt", "success"].includes(name)
    )
      style[colorVariables[name]] = color;
  }
  for (const group of ["spacing", "radii", "fontSizes", "iconSizes"] as const) {
    const prefix = {
      spacing: "space",
      radii: "radius",
      fontSizes: "font",
      iconSizes: "icon",
    }[group];
    for (const [name, value] of Object.entries(config?.[group] ?? {}))
      style[`--studio-${prefix}-${name}`] = value + "px";
  }
  return style;
}
export function iconReference(
  token: string,
  defaultLibrary: IconLibrary = "material",
): { library: IconLibrary; name: string } {
  const [family, name] = token.split(".");
  const library =
    (Object.entries(iconLibraries).find(
      ([, details]) => details.namespace === family,
    )?.[0] as IconLibrary | undefined) ?? defaultLibrary;
  return { library, name: name ?? family };
}
