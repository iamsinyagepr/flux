// Synced from Upskale Studio (upskaleapp/src/lib/studio/codeMenu.ts). Edit it there, then npm run sync.
import { parseSource, type CallExpr } from "./parser";
import { callLocations, isWidget, widgetSlots, type DeclarationList, type EditContext, type WidgetSlot } from "./sourceEdits";

/**
 * What a right-click in the code editor is on, so its menu can offer what
 * the Visual editor does there: adding widgets around the widget the cursor
 * is in, wrapping or replacing a widget whose name is clicked or selected,
 * and adding a state, option or part inside those lists.
 */
export interface CodeMenuTarget {
  /** The innermost widget call around the cursor. */
  widget?: {
    call: CallExpr;
    /** An item of a children list: something can go before or after it. */
    listed: boolean;
    /** The call it sits in (what a wrapper must suit). */
    parent?: string;
    slots: WidgetSlot[];
    /** The click (or the selection) is on its name: wrap and replace apply. */
    onName: boolean;
  };
  /** The declaration list the cursor is inside: states: [ … ]. */
  list?: DeclarationList;
}

export function codeMenuTarget(
  source: string,
  offset: number,
  selection: { from: number; to: number },
  context: EditContext = {},
): CodeMenuTarget {
  const root = parseSource(source).root;
  if (!root) return {};
  const target: CodeMenuTarget = {};
  for (const list of ["states", "options", "parts"] as const) {
    const value = root.args[list];
    if (value?.type === "list" && value.from < offset && offset < value.to) target.list = list;
  }
  let best: (typeof target)["widget"];
  for (const location of callLocations(root)) {
    const call = location.node;
    if (!isWidget(call, context) || offset < call.from || offset > call.to) continue;
    if (best && call.to - call.from >= best.call.to - best.call.from) continue;
    const nameEnd = call.from + call.name.length;
    best = {
      call,
      listed: !!location.list,
      parent: location.parent?.name,
      slots: widgetSlots(call, context),
      onName: (offset >= call.from && offset <= nameEnd) || (selection.from === call.from && selection.to === nameEnd),
    };
  }
  if (best) target.widget = best;
  return target;
}
