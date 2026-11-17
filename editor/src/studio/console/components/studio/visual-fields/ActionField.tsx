// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/ActionField.tsx). Edit it there, then npm run sync.
import { readActionNode, type ActionNode, writeActionNode } from "../../../../lib/studio/actionModel";
import type { Expr } from "../../../../lib/studio/parser";
import type { FieldContext } from "../../../../components/studio/VisualFields";
import { ActionEditor } from "./ActionEditor";

/** The action builder: pick an action, then each of its parameters, from lists. */
export function ActionField({
  id,
  expr,
  context,
  onSet,
  onRemove,
}: {
  id: string;
  expr: Expr | undefined;
  context: FieldContext;
  onSet: (text: string) => void;
  onRemove: () => void;
}) {
  const node = readActionNode(context.source, expr);
  const write = (next: ActionNode) => {
    const text = writeActionNode(next);
    if (text === undefined) onRemove();
    else onSet(text);
  };
  return <ActionEditor id={id} node={node} context={context} onChange={write} depth={0} />;
}
