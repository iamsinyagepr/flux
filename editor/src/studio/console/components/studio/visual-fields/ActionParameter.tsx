// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/ActionParameter.tsx). Edit it there, then npm run sync.
import { cdslString } from "../../../../lib/studio/sourceEdits";
import { type ActionNode, setActionArgument, parameterChoices } from "../../../../lib/studio/actionModel";
import { Select } from '../../../../components/Select';
import type { FieldContext } from "../../../../components/studio/VisualFields";
import { actionContext, useDraft, literalText } from "../../../functions/studio/visual-fields/index";

export function ActionParameter({
  id,
  node,
  parameter,
  context,
  onChange,
}: {
  id: string;
  node: Extract<ActionNode, { kind: "call" }>;
  parameter: { name: string; type: string; required: boolean };
  context: FieldContext;
  onChange: (node: ActionNode) => void;
}) {
  const actions = actionContext(context);
  const value = node.args[parameter.name];
  const set = (text: string | undefined) => {
    if (text === undefined) {
      const args = { ...node.args };
      delete args[parameter.name];
      onChange({ ...node, args });
    } else onChange(setActionArgument(node, parameter.name, text, actions));
  };
  const choices = parameterChoices(node.name, parameter.name, node, actions);
  const isNumber = value !== undefined && /^-?\d+(\.\d+)?$/.test(value);
  const isString = value !== undefined && /^"/.test(value);
  const typed =
    choices.find((choice) => choice.value === value) ??
    choices.find((choice) => (choice.input === "number" && isNumber) || (choice.input === "text" && isString));
  const draft = useDraft(literalText(value), (next) => {
    if (typed?.input === "number" || (!choices.length && /Number/.test(parameter.type))) {
      if (next.trim() !== "" && Number.isFinite(Number(next))) set(String(Number(next)));
    } else set(cdslString(next));
  });
  const free = !choices.length;
  return (
    <div className="studio-action-parameter">
      <label htmlFor={id}>
        {parameter.name}
        {parameter.required && <span className="studio-visual-required"> *</span>}
      </label>
      {free ? (
        /String/.test(parameter.type) && (value === undefined || isString) ? (
          <input
            id={id}
            className="studio-visual-input"
            value={draft.value}
            readOnly={context.readOnly}
            placeholder={parameter.required ? "" : "Optional"}
            onChange={draft.onChange}
            onBlur={() => (draft.value === "" && !parameter.required ? set(undefined) : draft.commit())}
            onKeyDown={(event) => {
              if (event.key === "Enter") draft.commit();
              if (event.key === "Escape") draft.revert();
            }}
          />
        ) : (
          <code className="studio-action-value" title="Written in Code view">
            {value ?? "—"}
          </code>
        )
      ) : (
        <div className="studio-action-choice">
          <Select look="studio"
            id={id}
            className="studio-visual-input"
            value={typed ? typed.value : (value ?? "")}
            disabled={context.readOnly}
            onChange={(event) => set(event.target.value === "" ? undefined : event.target.value)}
          >
            {(!parameter.required || value === undefined) && <option value="">{parameter.required ? "Choose…" : "—"}</option>}
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
            {value !== undefined && !typed && <option value={value}>{value}</option>}
          </Select>
          {typed?.input && (
            <input
              aria-label={parameter.name + " value"}
              type={typed.input}
              className="studio-visual-input"
              value={draft.value}
              readOnly={context.readOnly}
              onChange={draft.onChange}
              onBlur={draft.commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") draft.commit();
                if (event.key === "Escape") draft.revert();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
