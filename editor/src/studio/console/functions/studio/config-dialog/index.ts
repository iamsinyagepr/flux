// Synced from Upskale Studio (upskaleapp/src/console/functions/studio/config-dialog/index.ts). Edit it there, then npm run sync.
import { colorVariables, validHexColor } from "../../../../lib/studio/projectConfig";

export function colorDefaults(theme: "light" | "dark") {
  const css = getComputedStyle(document.documentElement);
  const fixture =
    theme === "dark"
      ? {
          "--fixture-bg": "dark",
          "--fixture-paper": "dark-surface",
          "--fixture-ink": "dark-ink",
          "--fixture-muted": "dark-muted",
          "--fixture-border": "dark-border",
        }
      : {
          "--fixture-bg": "light",
          "--fixture-paper": "paper",
          "--fixture-ink": "ink",
          "--fixture-muted": "muted",
          "--fixture-border": "border",
        };
  return Object.fromEntries(
    Object.entries(colorVariables).map(([key, variable]) => {
      const suffix = (fixture as Record<string, string>)[variable];
      const color = css
        .getPropertyValue(
          suffix ? "--color-studio-preview-" + suffix : variable,
        )
        .trim();
      return [key, validHexColor(color) ? color : "#000000"];
    }),
  );
}
