// Synced from Upskale Studio (upskaleapp/src/components/Select.tsx). Edit it there, then npm run sync.
import { type SelectHTMLAttributes, type ChangeEvent } from "react";



export type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'multiple' | 'size'> & {
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  /** Studio's styling (studio.css, Studio's pages only) or the console's. */
  look?: 'console' | 'studio';
};

export { Select } from "../console/components/select/Select";

export { optionsOf } from "../console/functions/select/index";
