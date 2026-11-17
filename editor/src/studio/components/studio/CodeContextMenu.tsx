// Synced from Upskale Studio (upskaleapp/src/components/studio/CodeContextMenu.tsx). Edit it there, then npm run sync.
import { type InsertPlacement } from "../../lib/studio/sourceEdits";


/** A right-click in the code editor: where, and what it can do with the text. */
export interface CodeMenuRequest {
  x: number;
  y: number;
  offset: number;
  from: number;
  to: number;
  actions: { cut: () => void; copy: () => void; paste: () => void; selectAll: () => void };
}

export interface PickerRequest {
  title: string;
  range: { from: number; to: number };
  placement: InsertPlacement;
  slot?: string;
}

export { default } from "../../console/components/studio/code-context-menu/CodeContextMenu";
