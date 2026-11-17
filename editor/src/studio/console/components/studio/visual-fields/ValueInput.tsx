// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/ValueInput.tsx). Edit it there, then npm run sync.
import { expressionError } from "../../../../lib/studio/sourceEdits";
import { type PropertyRow, writeValue, tokenChoices } from "../../../../lib/studio/visualModel";
import { Select } from '../../../../components/Select';
import type { FieldContext } from "../../../../components/studio/VisualFields";
import { useDraft } from "../../../functions/studio/visual-fields/index";
import { DataTextInput } from "./DataTextInput";

export function ValueInput({
  id,
  row,
  context,
  onSet,
}: {
  id: string;
  row: PropertyRow;
  context: FieldContext;
  onSet: (text: string) => void;
}) {
  const value = row.value;
  // Plain text and text with data share one field; ${…} makes it a template.
  const commitText = (next: string) => {
    if (!next.includes("${")) return onSet(writeValue({ mode: "text", value: next }));
    const text = writeValue({ mode: "template", raw: next });
    if (!expressionError(text)) onSet(text);
  };
  const number = useDraft(value.mode === "number" ? String(value.value) : "", (next) => {
    if (next.trim() === "" || !Number.isFinite(Number(next))) return;
    onSet(writeValue({ mode: "number", value: Number(next) }));
  });
  const kind = row.spec.kind;
  if (kind === "text" && (value.mode === "template" || value.mode === "text"))
    return (
      <>
        <DataTextInput
          id={id}
          raw={value.mode === "template" ? value.raw : value.value}
          context={context}
          onCommit={commitText}
          describedBy={value.mode === "template" ? id + "-template" : undefined}
        />
        {value.mode === "template" && (
          <small id={id + "-template"} className="studio-visual-hint">
            Text with data: {"${…}"} inserts a value, e.g. {"${store.name}"}.
          </small>
        )}
      </>
    );
  if (kind === "number")
    return (
      <input
        id={id}
        type="number"
        className="studio-visual-input"
        value={number.value}
        readOnly={context.readOnly}
        onChange={number.onChange}
        onBlur={number.commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") number.commit();
          if (event.key === "Escape") number.revert();
        }}
      />
    );
  if (kind === "bool")
    return (
      <label className="studio-visual-switch">
        <input
          id={id}
          type="checkbox"
          checked={value.mode === "bool" && value.value}
          disabled={context.readOnly}
          onChange={(event) => onSet(String(event.target.checked))}
        />
        <span>{value.mode === "bool" && value.value ? "On" : "Off"}</span>
      </label>
    );
  // Tokens and colours: the family's names (with the project's own), plus a
  // number where the type accepts one, plus a custom hex for colours.
  const family = row.spec.family ?? "";
  const choices = tokenChoices(family, context.config);
  const selected =
    value.mode === "token" ? value.value : value.mode === "hex" ? "#hex" : value.mode === "number" ? "#number" : "";
  return (
    <div className="studio-visual-token">
      <Select look="studio"
        id={id}
        className="studio-visual-input"
        value={selected}
        disabled={context.readOnly}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "#hex") onSet(writeValue({ mode: "hex", value: value.mode === "hex" ? value.value : "#000000" }));
          else if (next === "#number") onSet(writeValue({ mode: "number", value: value.mode === "number" ? value.value : 0 }));
          else if (next) onSet(writeValue({ mode: "token", family, value: next }));
        }}
      >
        {!selected && <option value="">Choose…</option>}
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {family}.{choice}
          </option>
        ))}
        {row.spec.allowsNumber && <option value="#number">Number…</option>}
        {row.spec.kind === "color" && <option value="#hex">Custom colour…</option>}
      </Select>
      {value.mode === "hex" && (
        <input
          type="color"
          aria-label={"Custom " + row.name}
          value={value.value}
          disabled={context.readOnly}
          onChange={(event) => onSet(writeValue({ mode: "hex", value: event.target.value }))}
        />
      )}
      {value.mode === "number" && (
        <input
          type="number"
          aria-label={row.name + " value"}
          className="studio-visual-input"
          value={number.value}
          readOnly={context.readOnly}
          onChange={number.onChange}
          onBlur={number.commit}
          onKeyDown={(event) => event.key === "Enter" && number.commit()}
        />
      )}
    </div>
  );
}
