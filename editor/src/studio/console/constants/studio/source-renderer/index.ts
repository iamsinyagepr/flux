// Synced from Upskale Studio (upskaleapp/src/console/constants/studio/source-renderer/index.ts). Edit it there, then npm run sync.
import { getExample } from "../../../../lib/studio/exampleSources";
import { analyzeSource } from "../../../../lib/studio/languageService";

export const weights: Record<string, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};
export const colors: Record<string, string> = {
  primary: "var(--studio-color-primary, var(--color-accent))",
  primaryInk: "var(--studio-color-primaryInk, var(--color-on-accent))",
  background: "var(--studio-color-background, var(--fixture-bg))",
  surface: "var(--studio-color-surface, var(--fixture-paper))",
  surfaceAlt: "var(--studio-color-surfaceAlt, var(--fixture-bg))",
  text: "var(--studio-color-text, var(--fixture-ink))",
  textMuted: "var(--studio-color-textMuted, var(--fixture-muted))",
  border: "var(--studio-color-border, var(--fixture-border))",
  success: "var(--studio-color-success, var(--color-accent))",
  danger: "var(--studio-color-danger, var(--color-danger))",
  warning: "var(--studio-color-warning, var(--color-chart-amber))",
};
// A project's own Color tokens come from Config as --studio-color-<name>,
// set on the preview root by configVariables.
/** Shadow.sm/md/lg: [y offset, blur], the depths the Dart runtime draws. */
export const shadowDepths: Record<string, [number, number]> = { sm: [1, 3], md: [4, 14], lg: [10, 30] };
/** Anchor → [horizontal, vertical] for flex placement and gradient direction. */
export const anchors: Record<string, [string, string]> = {
  topLeft: ["start", "start"], top: ["center", "start"], topRight: ["end", "start"],
  left: ["start", "center"], center: ["center", "center"], right: ["end", "center"],
  bottomLeft: ["start", "end"], bottom: ["center", "end"], bottomRight: ["end", "end"],
};
export const productDefinition = analyzeSource(getExample("product-card").source);
