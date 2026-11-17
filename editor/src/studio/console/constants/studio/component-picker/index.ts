// Synced from Upskale Studio (upskaleapp/src/console/constants/studio/component-picker/index.ts). Edit it there, then npm run sync.
import type { IconType } from "react-icons";
import { MdTextFields, MdSmartButton, MdImage, MdStarOutline, MdCropSquare, MdViewAgenda, MdViewColumn, MdLayers, MdSpaceBar, MdHorizontalRule, MdInput, MdCallSplit } from "react-icons/md";

/** The widgets most pages are made of: one click from the top of the picker. */
export const BASIC_WIDGETS: [string, IconType][] = [
  ["Text", MdTextFields],
  ["Button", MdSmartButton],
  ["Image", MdImage],
  ["Icon", MdStarOutline],
  ["Box", MdCropSquare],
  ["Column", MdViewAgenda],
  ["Row", MdViewColumn],
  ["Stack", MdLayers],
  ["Spacer", MdSpaceBar],
  ["Divider", MdHorizontalRule],
  ["TextField", MdInput],
  ["If", MdCallSplit],
];

/**
 * The code editor's "Add" submenu: the layout basics, inserted straight away.
 * Everything else (more widgets, this project's components, templates) is
 * behind "From Library…", the full picker.
 */
export const CODE_MENU_BASICS = [
  "Text",
  "Button",
  "Image",
  "Icon",
  "Box",
  "Column",
  "Row",
  "Stack",
  "Positioned",
  "Expanded",
  "Spacer",
  "Divider",
] as const;
