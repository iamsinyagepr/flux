// Synced from Upskale Studio (upskaleapp/src/console/functions/studio/value-menu/index.ts). Edit it there, then npm run sync.
import { createElement } from "react";
import { api } from "../../../../api/client";
import type { MenuItem } from "../../../../components/studio/StudioContextMenu";
import { type StudioConfig, colorVariables } from "../../../../lib/studio/projectConfig";
import { cdslString } from "../../../../lib/studio/sourceEdits";
import { fieldFor, tokenChoices } from "../../../../lib/studio/visualModel";

/** A card a property's value is chosen on (value-cards/ValueCards.tsx), or its own field ("custom"). */
export type ValueCardKind = "icon" | "border" | "gradient" | "imageData" | "custom";

/** Numbers worth offering for a property, by what it is. */
function numberPresets(name: string): number[] {
  if (name === "opacity") return [0.25, 0.5, 0.75, 1];
  if (name === "rotate") return [0, 45, 90, 180];
  if (name === "scale") return [0.5, 1, 1.5, 2];
  if (name === "aspectRatio") return [1, 1.33, 1.5, 1.78];
  if (/columns|count|lines|maxLines/i.test(name)) return [1, 2, 3, 4];
  return [8, 16, 24, 32, 48, 64, 100];
}

/** A colour token as it looks: the project's own, or the theme's built-in one. */
function colorSwatch(name: string, config?: StudioConfig) {
  const variable = colorVariables[name];
  const background = config?.colors?.[name] ?? (variable ? `var(${variable})` : "transparent");
  return createElement("span", { className: "studio-menu-swatch", style: { background }, "aria-hidden": true });
}

/** Picks a file, uploads it as the account's Studio image, and gives its address. */
export function pickImageFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      api.uploadStudioMedia(file).then(({ url }) => resolve(url), reject);
    };
    input.click();
  });
}

/**
 * The alt text a new Image starts with, as Flux, from where it comes from: a
 * record's image (product.image_url) is described by that record's name
 * (product.name); an uploaded file by its name in words ("grain-bowl.png" is
 * "Grain bowl"); anything else, "Image". Never "": an empty alt is for a
 * decorative image, which says so (decorative: true), and the checker holds
 * it to that. Each is a start, edited in the Image's alt.
 */
export function imageAlt(src: string): string {
  const record = /^([A-Za-z_][\w.]*)\.(?:display_)?(?:image|photo|logo|banner|cover)(?:_url)?$/.exec(src.trim());
  if (record) return `${record[1]}.name`;
  const quoted = /^"(.*)"$/.exec(src.trim());
  if (quoted) {
    const file = quoted[1].replace(/[?#].*$/, "").split("/").filter(Boolean).at(-1) ?? "";
    let name = file.replace(/\.[a-z0-9]+$/i, "");
    try {
      name = decodeURIComponent(name);
    } catch {
      /* not encoded after all */
    }
    const words = name
      .replace(/[-_]+/g, " ")
      // An upload's own suffix: grain-bowl-2, IMG_0042.
      .replace(/\s+\d+$/, "")
      .trim();
    if (/[a-z]{2}/i.test(words) && !/^(img|image|photo|dsc|pxl)\s*\d*$/i.test(words))
      return cdslString(words.charAt(0).toUpperCase() + words.slice(1).toLowerCase());
  }
  return cdslString("Image");
}

/**
 * What choosing a property offers in a context menu: a list of its values to
 * pick from (an alignment, a spacing, a colour, true or false), then Custom…
 * for a size or colour of its own; or, for a value that needs a form (a
 * border, a gradient, an icon), that form; or, for an image, a file or data.
 * [write] sets the property's Flux; [open] opens a card. Undefined when the
 * property's own field is the only sensible way (text, an action…).
 */
export function valueMenu(
  item: { name: string; type: string },
  {
    config,
    write,
    open,
    onError,
  }: { config?: StudioConfig; write(text: string): void; open(kind: ValueCardKind): void; onError(message: string): void },
): { children?: MenuItem[]; onSelect?: () => void } | undefined {
  const [first] = item.type.split(" or ");
  if (first === "Border") return { onSelect: () => open("border") };
  if (first === "Gradient") return { onSelect: () => open("gradient") };
  if (["Icons", "MaterialIcons", "FeatherIcons", "BootstrapIcons"].includes(first)) return { onSelect: () => open("icon") };
  if (item.name === "src" && /\bString\b/.test(item.type))
    return {
      children: [
        {
          label: "From a file…",
          hint: "upload",
          onSelect: () =>
            void pickImageFile()
              .then((url) => url && write(cdslString(url)))
              .catch((problem) => onError(problem instanceof Error ? problem.message : "That image could not be uploaded.")),
        },
        { label: "From data…", hint: "product.image_url…", onSelect: () => open("imageData") },
        { label: "Image address…", onSelect: () => open("custom") },
      ],
    };
  const spec = fieldFor(item.type);
  if (spec.kind === "bool")
    return { children: [true, false].map((value) => ({ label: String(value), onSelect: () => write(String(value)) })) };
  if ((spec.kind === "token" || spec.kind === "color") && spec.family && spec.family !== "Route") {
    const choices = tokenChoices(spec.family, config);
    const custom = spec.kind === "color" || spec.allowsNumber;
    if (!choices.length) return undefined;
    return {
      children: [
        ...choices.map((choice, index) => ({
          section: index === 0 ? spec.family : undefined,
          label: choice,
          // Colours show as themselves, with the project's own value.
          icon: spec.kind === "color" ? colorSwatch(choice, config) : undefined,
          hint: spec.kind === "color" ? config?.colors?.[choice] : undefined,
          onSelect: () => write(`${spec.family}.${choice}`),
        })),
        ...(custom
          ? [{ section: "Custom", label: spec.kind === "color" ? "Custom colour…" : "Custom value…", onSelect: () => open("custom") }]
          : []),
      ],
    };
  }
  if (spec.kind === "number")
    return {
      children: [
        ...numberPresets(item.name).map((value, index) => ({ section: index === 0 ? "Values" : undefined, label: String(value), onSelect: () => write(String(value)) })),
        { section: "Custom", label: "Custom value…", onSelect: () => open("custom") },
      ],
    };
  return undefined;
}
