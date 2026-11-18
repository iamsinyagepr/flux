// Synced from Upskale Studio (upskaleapp/src/components/studio/VisualFields.tsx). Edit it there, then npm run sync.
import { type DataSuggestion } from "../../lib/studio/dataBindings";
import type { FieldValue } from "../../lib/studio/visualModel";
import type { StudioConfig } from "../../lib/studio/projectConfig";



export interface FieldContext {
  source: string;
  config?: StudioConfig;
  /** Data bindings offered while typing an expression (store.name…). */
  bindings: string[];
  /**
   * The names an expression can read here that start with what's typed: a
   * root (sta → state, store) or, after a dot, its fields (state. → each
   * state, product. → the product's fields). Absent: bindings only.
   */
  completeBinding?: (prefix: string) => { label: string; detail?: string }[];
  /** Data offered while typing text: "cart" offers cart.length, first(cart).name… */
  suggestData?: (word: string) => DataSuggestion[];
  /** The component's states, for SetState/Toggle. */
  states: string[];
  /** The component's ActionOption names, for "Call option". */
  actionOptions: string[];
  /** Each declared state's type (BoolState…), for the action builder. */
  stateTypes: Record<string, string>;
  /** The app's page paths, for "Go to a page". */
  pagePaths: string[];
  /** The states and options a property can change with. */
  drivers: Driver[];
  readOnly: boolean;
}

/** What can drive a property: a state or option, with its type and values. */
export interface Driver {
  ref: string;
  /** BoolState, StringOption, EnumOption… */
  type: string;
  /** The declaration's starting value, as Flux. */
  initial?: string;
  /** EnumOption's values, as Flux. */
  values?: string[];
}

export type { FieldValue };

export { PropertyField } from "../../console/components/studio/visual-fields/PropertyField";

export { useDraft, actionContext, swap, literalText, branchId, nextMatch, tokenSize, tokenColor, declarationsOf, nameOf, driversOf, fieldContextFor } from "../../console/functions/studio/visual-fields/index";
