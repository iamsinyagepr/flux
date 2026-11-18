// Synced from Upskale Studio (upskaleapp/src/components/studio/ConfigDialog.tsx). Edit it there, then npm run sync.
export type ConfigTab = "details" | "app" | "colors" | "sizes" | "icons" | "maps";

export interface ProjectDetails {
  name: string;
  description: string;
}

export { default } from "../../console/components/studio/config-dialog/ConfigDialog";

export { colorDefaults } from "../../console/functions/studio/config-dialog/index";
export { sizeGroups, CONFIG_TABS } from "../../console/constants/studio/config-dialog/index";
