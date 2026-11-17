// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/TokenPicker.tsx). Edit it there, then npm run sync.
import { type PropertyRow, tokenChoices, writeValue } from "../../../../lib/studio/visualModel";
import type { FieldContext } from "../../../../components/studio/VisualFields";
import { useDraft, tokenColor, tokenSize } from "../../../functions/studio/visual-fields/index";

/**
 * Tokens shown as what they are: colour swatches, "Aa" at each font size,
 * bars for spacing, rounded corners for radii. A number or a custom colour
 * where the property accepts one.
 */
export function TokenPicker({
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
  const family = row.spec.family ?? "";
  const value = row.value;
  const choices = tokenChoices(family, context.config);
  const isColor = row.spec.kind === "color";
  const number = useDraft(value.mode === "number" ? String(value.value) : "", (next) => {
    if (next.trim() === "" || !Number.isFinite(Number(next))) return;
    onSet(writeValue({ mode: "number", value: Number(next) }));
  });
  const preview = (name: string) => {
    if (isColor)
      return <span className="studio-token-swatch" style={{ background: tokenColor(name, context) }} aria-hidden="true" />;
    const size = tokenSize(family, name, context);
    if (size === undefined) return null;
    if (family === "FontSize")
      return (
        <span className="studio-token-type" style={{ fontSize: Math.min(size, 30) }} aria-hidden="true">
          Aa
        </span>
      );
    if (family === "Radius")
      return <span className="studio-token-radius" style={{ borderTopLeftRadius: Math.min(size, 14) }} aria-hidden="true" />;
    return <span className="studio-token-bar" style={{ width: Math.max(2, Math.min(size, 40)) }} aria-hidden="true" />;
  };
  return (
    <div className="studio-token-picker">
      <div
        id={id}
        role="radiogroup"
        aria-label={row.name}
        className={isColor ? "studio-token-swatches" : "studio-token-chips"}
      >
        {choices.map((name) => {
          const selected = value.mode === "token" && value.value === name;
          const size = tokenSize(family, name, context);
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={family + "." + name}
              title={family + "." + name + (size !== undefined ? " · " + size + "px" : "")}
              disabled={context.readOnly}
              className={selected ? "is-selected" : ""}
              onClick={() => onSet(writeValue({ mode: "token", family, value: name }))}
            >
              {preview(name)}
              {!isColor && <small>{name}</small>}
            </button>
          );
        })}
        {isColor && (
          <label className={"studio-token-custom" + (value.mode === "hex" ? " is-selected" : "")} title="Custom colour">
            <input
              type="color"
              aria-label={"Custom " + row.name}
              value={value.mode === "hex" ? value.value : "#000000"}
              disabled={context.readOnly}
              onChange={(event) => onSet(writeValue({ mode: "hex", value: event.target.value }))}
            />
          </label>
        )}
      </div>
      {row.spec.allowsNumber && (
        <label className="studio-token-number">
          <span>px</span>
          <input
            type="number"
            aria-label={row.name + " in pixels"}
            className="studio-visual-input"
            placeholder={value.mode === "token" ? String(tokenSize(family, value.value, context) ?? "") : ""}
            value={number.value}
            readOnly={context.readOnly}
            onChange={number.onChange}
            onBlur={number.commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") number.commit();
              if (event.key === "Escape") number.revert();
            }}
          />
        </label>
      )}
    </div>
  );
}
