// Synced from Upskale Studio (upskaleapp/src/components/studio/StudioContextMenu.tsx). Edit it there, then npm run sync.
import { type ReactNode } from "react";



export interface MenuItem {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  /**
   * Shown as its icon alone (its label is its name and tooltip); a run of
   * these sits in one row, like the Edit row's Cut, Copy, Paste.
   */
  iconOnly?: boolean;
  /** Deletes or removes something: shown in the danger colour. */
  danger?: boolean;
  /** Shown before this item, separating groups. */
  section?: string;
  /** Secondary text on the right, such as a property's type. */
  hint?: string;
  /** Tooltip, e.g. why the item is disabled. */
  title?: string;
  /** A submenu: "Wrap with ▸ Layout ▸ Column". */
  children?: MenuItem[];
  /** The submenu's accessible name, when not its label ("Add state"). */
  menuLabel?: string;
  /** The submenu opens with a search box: type to narrow a long list. */
  searchable?: boolean;
  onSelect?: () => void;
}

export { default } from "../../console/components/studio/studio-context-menu/StudioContextMenu";

export { narrow, flatten } from "../../console/functions/studio/studio-context-menu/index";
