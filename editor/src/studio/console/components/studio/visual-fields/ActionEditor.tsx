// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/ActionEditor.tsx). Edit it there, then npm run sync.
import { MdAdd, MdArrowUpward, MdArrowDownward, MdClose } from "react-icons/md";
import { type ActionNode, ACTION_CHOICES, starterAction, actionParameters } from "../../../../lib/studio/actionModel";
import { Select } from '../../../../components/Select';
import type { FieldContext } from "../../../../components/studio/VisualFields";
import { actionContext, swap } from "../../../functions/studio/visual-fields/index";
import { ActionParameter } from "./ActionParameter";

export function ActionEditor({
  id,
  node,
  context,
  onChange,
  depth,
}: {
  id: string;
  node: ActionNode;
  context: FieldContext;
  onChange: (node: ActionNode) => void;
  depth: number;
}) {
  const actions = actionContext(context);
  const current =
    node.kind === "call"
      ? node.name
      : node.kind === "sequence"
        ? "Actions"
        : node.kind === "option"
          ? "#option:" + node.name
          : node.kind === "unknown"
            ? "#unknown"
            : "none";
  const groups = [...new Set(ACTION_CHOICES.map((choice) => choice.group))];
  return (
    <div className="studio-action-builder" data-depth={depth}>
      <Select look="studio"
        id={id}
        aria-label={depth ? "Step action" : "Action"}
        className="studio-visual-input"
        value={current}
        disabled={context.readOnly}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "#unknown") return;
          if (value.startsWith("#option:")) onChange({ kind: "option", name: value.slice(8) });
          else onChange(starterAction(value, actions));
        }}
      >
        <option value="none">{depth ? "Choose an action…" : "No action"}</option>
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {ACTION_CHOICES.filter((choice) => choice.group === group && (choice.name !== "Actions" || depth === 0)).map((choice) => (
              <option key={choice.name} value={choice.name}>
                {choice.label}
              </option>
            ))}
          </optgroup>
        ))}
        {context.actionOptions.length > 0 && (
          <optgroup label="This component's options">
            {context.actionOptions.map((name) => (
              <option key={name} value={"#option:" + name}>
                Run options.{name}
              </option>
            ))}
          </optgroup>
        )}
        {node.kind === "unknown" && <option value="#unknown">Written in Code view</option>}
      </Select>
      {node.kind === "call" &&
        actionParameters(node.name).map((parameter) => (
          <ActionParameter
            key={parameter.name}
            id={id + "-" + parameter.name}
            node={node}
            parameter={parameter}
            context={context}
            onChange={onChange}
          />
        ))}
      {/* One action grows into a container of steps, keeping itself as the first. */}
      {depth === 0 && node.kind === "call" && !context.readOnly && (
        <button
          type="button"
          className="studio-visual-add"
          onClick={() => onChange({ kind: "sequence", steps: [node, starterAction("ShowMessage", actions)] })}
        >
          <MdAdd aria-hidden="true" /> Add another action
        </button>
      )}
      {node.kind === "sequence" && (
        <ol className="studio-action-steps studio-action-container" aria-label="Actions, in order">
          {node.steps.map((step, index) => (
            <li key={index}>
              <span className="studio-action-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <ActionEditor
                id={id + "-step" + index}
                node={step}
                context={context}
                depth={depth + 1}
                onChange={(next) => onChange({ kind: "sequence", steps: node.steps.map((item, at) => (at === index ? next : item)) })}
              />
              {!context.readOnly && (
                <span className="studio-action-step-tools">
                  <button
                    type="button"
                    className="studio-icon-button"
                    aria-label={"Move step " + (index + 1) + " up"}
                    title="Run earlier"
                    disabled={index === 0}
                    onClick={() => onChange({ kind: "sequence", steps: swap(node.steps, index, index - 1) })}
                  >
                    <MdArrowUpward aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="studio-icon-button"
                    aria-label={"Move step " + (index + 1) + " down"}
                    title="Run later"
                    disabled={index === node.steps.length - 1}
                    onClick={() => onChange({ kind: "sequence", steps: swap(node.steps, index, index + 1) })}
                  >
                    <MdArrowDownward aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="studio-icon-button"
                    aria-label={"Remove step " + (index + 1)}
                    title="Remove step"
                    onClick={() => {
                      const steps = node.steps.filter((_, at) => at !== index);
                      // A container of one is just that action.
                      onChange(steps.length === 1 ? steps[0] : { kind: "sequence", steps });
                    }}
                  >
                    <MdClose aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          ))}
          {!context.readOnly && node.steps.length < 20 && (
            <li>
              <button
                type="button"
                className="studio-visual-add"
                onClick={() => onChange({ kind: "sequence", steps: [...node.steps, starterAction("ShowMessage", actions)] })}
              >
                <MdAdd aria-hidden="true" /> Add step
              </button>
            </li>
          )}
        </ol>
      )}
      {node.kind === "unknown" && (
        <p className="studio-visual-hint" title={node.text}>
          This action is written by hand. Choose another to replace it, or edit it in Code view.
        </p>
      )}
    </div>
  );
}
