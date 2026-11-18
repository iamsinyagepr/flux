// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/PropertyField.tsx). Edit it there, then npm run sync.
import { type ReactNode, useId, useState, useEffect } from "react";
import { MdDataObject, MdDeleteOutline } from "react-icons/md";
import { readDynamic, unlinkDynamic } from "../../../../lib/studio/dynamicProps";
import { type PropertyRow, writeValue } from "../../../../lib/studio/visualModel";
import type { Expr } from "../../../../lib/studio/parser";
import type { FieldContext } from "../../../../components/studio/VisualFields";
import { LinkButton } from "./LinkButton";
import { DynamicField } from "./DynamicField";
import { CodeField } from "./CodeField";
import { ActionField } from "./ActionField";
import { TokenPicker } from "./TokenPicker";
import { ValueInput } from "./ValueInput";

/**
 * One property row: the right control for its type, a `{ }` switch to write
 * an expression instead (bindings, conditionals), and remove.
 * Text and numbers commit on Enter or leaving the field, so each change is
 * one step in the editor's undo history rather than one per keystroke.
 */
export function PropertyField({
  row,
  expr,
  context,
  error,
  onSet,
  onRemove,
  layout = "form",
  handle,
  onLink,
  onUnlink,
}: {
  row: PropertyRow;
  expr: Expr | undefined;
  context: FieldContext;
  error?: string;
  onSet: (text: string) => void;
  onRemove: () => void;
  /** "card" (the canvas): visual pickers and editable code blocks. */
  layout?: "form" | "card";
  /** The card's drag handle, before the label. */
  handle?: ReactNode;
  /** Make the property change with a state or option (state.open…). */
  onLink?: (ref: string) => void;
  /** Back to a single value. */
  onUnlink?: (text: string) => void;
}) {
  const card = layout === "card";
  const dynamic =
    row.spec.kind !== "action" && row.spec.kind !== "slot" ? readDynamic(context.source, expr) : undefined;
  const id = useId();
  const isExpression = row.value.mode === "expression";
  const [forceExpression, setForceExpression] = useState(false);
  // Actions always use the builder, never a code block or expression box.
  const expressionMode = row.spec.kind !== "action" && (isExpression || forceExpression);
  const canToggle = row.spec.kind !== "expression" && row.spec.kind !== "action";
  useEffect(() => setForceExpression(false), [row.name, row.value.mode]);
  const currentText =
    row.value.mode === "unset"
      ? ""
      : row.value.mode === "expression"
        ? row.value.text
        : writeValue(row.value);
  return (
    <div className="studio-visual-field" data-property={row.name}>
      <div className="studio-visual-field-label">
        {handle}
        <label htmlFor={id}>
          {row.name}
          {row.required && <span className="studio-visual-required" title="Required"> *</span>}
        </label>
        <small title={row.type}>{row.type}</small>
        {onLink && !dynamic && row.spec.kind !== "action" && !context.readOnly && (
          <LinkButton row={row} context={context} onLink={onLink} />
        )}
        {canToggle && !dynamic && !context.readOnly && (
          <button
            type="button"
            className={"studio-icon-button studio-visual-mode" + (expressionMode ? " is-active" : "")}
            aria-pressed={expressionMode}
            aria-label={(expressionMode ? "Use a value for " : "Write an expression for ") + row.name}
            title={expressionMode ? "Use a fixed value" : "Write an expression (data binding, condition)"}
            disabled={isExpression && !forceExpression}
            onClick={() => setForceExpression(!forceExpression)}
          >
            <MdDataObject aria-hidden="true" />
          </button>
        )}
        {!row.required && row.value.mode !== "unset" && !context.readOnly && (
          <button
            type="button"
            className="studio-icon-button studio-visual-remove"
            aria-label={"Remove " + row.name}
            title="Remove property"
            onClick={onRemove}
          >
            <MdDeleteOutline aria-hidden="true" />
          </button>
        )}
      </div>
      {dynamic ? (
        <DynamicField
          row={row}
          value={dynamic}
          context={context}
          card={card}
          onSet={onSet}
          onUnlink={() => onUnlink?.(unlinkDynamic(dynamic))}
        />
      ) : expressionMode ? (
        <CodeField id={id} label={row.name} value={currentText} context={context} onCommit={onSet} />
      ) : row.spec.kind === "action" ? (
        <ActionField id={id} expr={expr} context={context} onSet={onSet} onRemove={onRemove} />
      ) : card && (row.spec.kind === "token" || row.spec.kind === "color") && row.spec.family ? (
        <TokenPicker id={id} row={row} context={context} onSet={onSet} />
      ) : (
        <ValueInput id={id} row={row} context={context} onSet={onSet} />
      )}
      {error && (
        <p className="studio-visual-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
