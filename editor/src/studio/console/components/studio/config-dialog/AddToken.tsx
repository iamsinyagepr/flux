// Synced from Upskale Studio (upskaleapp/src/console/components/studio/config-dialog/AddToken.tsx). Edit it there, then npm run sync.
import { useState, type KeyboardEvent } from "react";
import { Button } from "../../../../components/ui";
import { validCustomTokenName, validHexColor, MAX_CUSTOM_TOKENS } from "../../../../lib/studio/projectConfig";

/**
 * Adds a project-specific token next to the built-ins — Color.brand,
 * Space.gutter — usable in Flux as soon as Config is applied.
 */
export function AddToken({
  family,
  kind,
  min = 0,
  max = 0,
  taken,
  full,
  disabled,
  onAdd,
}: {
  family: string;
  kind: "color" | "size";
  min?: number;
  max?: number;
  taken: (name: string) => boolean;
  full: boolean;
  disabled: boolean;
  onAdd: (name: string, value: string | number) => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState(kind === "color" ? "#00d2a6" : "");
  const [problem, setProblem] = useState("");
  function add() {
    const token = name.trim();
    if (!validCustomTokenName(token))
      return setProblem(
        "Use a camelCase name that starts with a lowercase letter, like brand or cardGap.",
      );
    if (taken(token)) return setProblem(`${family}.${token} already exists.`);
    if (kind === "color") {
      if (!validHexColor(value))
        return setProblem("Use a six-digit HEX color, like #1a2b3c.");
      onAdd(token, value.toLowerCase());
    } else {
      const number = Number(value);
      if (value.trim() === "" || !Number.isFinite(number) || number < min || number > max)
        return setProblem(`Use a number from ${min} to ${max}.`);
      onAdd(token, number);
    }
    setName("");
    setProblem("");
  }
  // Enter adds the variable instead of submitting (applying) the whole form.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  };
  if (full)
    return (
      <p className="studio-config-add text-sm text-steel">
        This group has the most custom variables a project can add (
        {MAX_CUSTOM_TOKENS}).
      </p>
    );
  return (
    <div className="studio-config-add">
      <p className="text-sm font-medium">Add a variable</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="studio-config-field min-w-40 flex-1">
          <span className="font-mono">{family}.name</span>
          <input
            aria-label={`New ${family} name`}
            className="font-mono"
            value={name}
            maxLength={32}
            placeholder={kind === "color" ? "brand" : "cardGap"}
            disabled={disabled}
            onKeyDown={onKeyDown}
            onChange={(event) => {
              setName(event.target.value);
              setProblem("");
            }}
          />
        </label>
        {kind === "color" ? (
          <div className="studio-config-color">
            <input
              type="color"
              aria-label={`Pick new ${family} value`}
              value={validHexColor(value) ? value : "#000000"}
              disabled={disabled}
              onChange={(event) => setValue(event.target.value)}
            />
            <label className="studio-config-field w-32">
              <span>Value</span>
              <input
                aria-label={`New ${family} value`}
                className="font-mono"
                value={value}
                maxLength={7}
                disabled={disabled}
                onKeyDown={onKeyDown}
                onChange={(event) => {
                  setValue(event.target.value);
                  setProblem("");
                }}
              />
            </label>
          </div>
        ) : (
          <label className="studio-config-field w-32">
            <span>Value (px)</span>
            <input
              type="number"
              aria-label={`New ${family} value`}
              min={min}
              max={max}
              step="any"
              value={value}
              placeholder={String(min)}
              disabled={disabled}
              onKeyDown={onKeyDown}
              onChange={(event) => {
                setValue(event.target.value);
                setProblem("");
              }}
            />
          </label>
        )}
        <Button type="button" variant="secondary" disabled={disabled} onClick={add}>
          Add variable
        </Button>
      </div>
      {problem ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {problem}
        </p>
      ) : (
        <p className="mt-2 text-xs text-steel">
          Use it in your source as {family}.{name.trim() || (kind === "color" ? "brand" : "cardGap")} once
          you apply Config.
        </p>
      )}
    </div>
  );
}
