// Synced from Upskale Studio (upskaleapp/src/lib/studio/types.ts). Edit it there, then npm run sync.
import type { PageDataImport, PageSearchParam, PageSeo } from "./pageData";
import type { StudioConfig } from "./projectConfig";
import type { PageTransition } from "./pageTransitions";
export const MAX_SOURCE_BYTES = 65_536;
export const STUDIO_SCHEMA_VERSION = 1;
export type ProjectType = "component" | "template";
export type ComponentKind =
  "product-card" | "product-collection" | "navigation" | "section";
export type PreviewDevice = "mobile" | "tablet" | "desktop";
export type FixtureId =
  | "standard"
  | "no-image"
  | "no-description"
  | "long-name"
  | "discounted"
  | "unavailable"
  | "needs-selection"
  | "empty"
  | "single"
  | "many";
export interface PreviewSettings {
  variant: string;
  fixture: FixtureId;
  device: PreviewDevice;
  theme: "light" | "dark";
  columns: number;
  showDescription: boolean;
  rounded: boolean;
  values?: Record<string, string | number | boolean>;
  /** The device's frame around the screen; absent is shown. Off, the app fills the preview. */
  frame?: boolean;
  /** A browser's bar above the app, with the page's address: how the website looks. */
  browser?: boolean;
  /** A phone or tablet turned on its side: its width and height swapped. */
  landscape?: boolean;
  /** The screen picked for each kind of device (devices.ts's previewScreens); absent is its default. */
  screens?: Partial<Record<PreviewDevice, string>>;
  /**
   * The laptop's keyboard under the desktop screen: absent shows it while it
   * costs the screen little room (clipped to its edge otherwise); false
   * clips it always, so the screen is as big as it can be.
   */
  laptopKeyboard?: boolean;
}
export interface StudioPage {
  id: string;
  name: string;
  path: string;
  source: string;
  /** How this page is entered; absent follows Config's pageTransition. */
  transition?: PageTransition;
  /** What the page fetches before it's drawn (pageData.ts). */
  data?: PageDataImport[];
  /** Its head, built from that data. */
  seo?: PageSeo;
  /** The search params its route declares (Route(search: Search(...))). */
  search?: PageSearchParam[];
}
export interface StudioAppFiles {
  config?: StudioConfig;
  pages?: StudioPage[];
  shellSource?: string;
  entryPageId?: string;
  componentSources?: Record<string, string>;
  /**
   * "dart": converted, for good, to the Flutter project its Flux compiled
   * to; dartProject (path → file) is then its source, built as it is
   * (dartMode.ts). There's no way back.
   */
  language?: "dart";
  dartProject?: Record<string, string>;
}
export interface StudioExample extends StudioAppFiles {
  id: string;
  name: string;
  description: string;
  kind: ComponentKind;
  type: ProjectType;
  source: string;
  variants: string[];
  tags: string[];
}
export interface StudioRevision extends StudioAppFiles {
  id: string;
  name: string;
  description: string;
  source: string;
  exampleId: string;
  preview: PreviewSettings;
  label: string;
  createdAt: string;
}
export interface StudioProject extends StudioAppFiles {
  id: string;
  accountId: string;
  name: string;
  description: string;
  exampleId: string;
  source: string;
  type: ProjectType;
  createdAt: string;
  updatedAt: string;
  preview: PreviewSettings;
  revisions: StudioRevision[];
}
export interface StudioSnapshot {
  schemaVersion: 1;
  projects: StudioProject[];
  /** Examples saved to a library the app no longer has; kept so old saves still sync. */
  library: string[];
}
/**
 * Where a Studio save is: "synced" on the server (the account's, so any
 * device opens it); "device" saved here, not on the server yet (offline, or
 * no server); "conflict" saved here, but another device changed it on the
 * server first (both are kept on the next load); "memory" in this tab only.
 */
export type StorageMode = "synced" | "device" | "conflict" | "memory";
/** A save's status in a few words, for the editor and the project list. */
export function storageLabel(mode: StorageMode): string {
  return {
    synced: "Saved to your account",
    device: "Saved on this device",
    conflict: "Changed on another device",
    memory: "Kept in this tab",
  }[mode];
}
export const sourceBytes = (source: string) =>
  new TextEncoder().encode(source).byteLength;
export function defaultPreview(variant = "default"): PreviewSettings {
  return {
    variant,
    fixture: "standard",
    device: "mobile",
    theme: "light",
    columns: 2,
    showDescription: true,
    rounded: true,
  };
}
export function makeId(): string {
  return crypto.randomUUID();
}
