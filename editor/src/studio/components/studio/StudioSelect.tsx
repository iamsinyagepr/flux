// Synced from Upskale Studio (upskaleapp/src/components/studio/StudioSelect.tsx). Edit it there, then npm run sync.
export interface SelectOption {
  value: string;
  label: string;
  /** Options with the same group are listed under it. */
  group?: string;
  hint?: string;
  disabled?: boolean;
}

export { default } from "../../console/components/studio/studio-select/StudioSelect";

export { LOOKS } from "../../console/constants/studio/studio-select/index";
