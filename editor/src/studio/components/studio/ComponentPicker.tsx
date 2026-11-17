// Synced from Upskale Studio (upskaleapp/src/components/studio/ComponentPicker.tsx). Edit it there, then npm run sync.
import type { ComponentTemplate } from "../../lib/studio/componentTemplates";
import { type PickerItem } from "../../lib/studio/visualModel";


export interface PickerChoice extends PickerItem {
  template?: ComponentTemplate;
}

export { default } from "../../console/components/studio/component-picker/ComponentPicker";

export { BASIC_WIDGETS } from "../../console/constants/studio/component-picker/index";
