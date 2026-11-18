// Synced from Upskale Studio (upskaleapp/src/console/constants/studio/config-dialog/index.ts). Edit it there, then npm run sync.
import type { IconType } from "react-icons";
import { MdBadge, MdEmojiSymbols, MdInfoOutline, MdMap, MdPalette, MdStraighten } from "react-icons/md";
import type { ConfigTab } from "../../../../components/studio/ConfigDialog";

export const sizeGroups = {
  spacing: { label: "Spacing", family: "Space", min: 0, max: 256 },
  radii: { label: "Corner radius", family: "Radius", min: 0, max: 9999 },
  fontSizes: { label: "Text size", family: "FontSize", min: 1, max: 160 },
  iconSizes: { label: "Icon size", family: "Size", min: 1, max: 128 },
};
export const CONFIG_TABS: { key: ConfigTab; label: string; icon: IconType }[] = [
  { key: "details", label: "Details", icon: MdInfoOutline },
  { key: "app", label: "App", icon: MdBadge },
  { key: "colors", label: "Colors", icon: MdPalette },
  { key: "sizes", label: "Sizes", icon: MdStraighten },
  { key: "icons", label: "Icons", icon: MdEmojiSymbols },
  { key: "maps", label: "Maps", icon: MdMap },
];
