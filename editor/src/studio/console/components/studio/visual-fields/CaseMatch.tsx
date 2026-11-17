// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/CaseMatch.tsx). Edit it there, then npm run sync.
import { cdslString } from "../../../../lib/studio/sourceEdits";
import { Select } from '../../../../components/Select';
import type { Driver } from "../../../../components/studio/VisualFields";
import { useDraft, literalText } from "../../../functions/studio/visual-fields/index";

export function CaseMatch({
  label,
  match,
  driver,
  readOnly,
  onChange,
}: {
  label: string;
  match: string;
  driver?: Driver;
  readOnly: boolean;
  onChange: (match: string) => void;
}) {
  const number = /Number/.test(driver?.type ?? "");
  const draft = useDraft(literalText(match), (next) => {
    if (number) {
      if (next.trim() !== "" && Number.isFinite(Number(next))) onChange(String(Number(next)));
    } else onChange(cdslString(next));
  });
  if (driver?.values?.length)
    return (
      <Select look="studio" aria-label={label} className="studio-visual-input" value={match} disabled={readOnly} onChange={(event) => onChange(event.target.value)}>
        {[...new Set([match, ...driver.values])].map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
    );
  return (
    <input
      aria-label={label}
      type={number ? "number" : "text"}
      className="studio-visual-input"
      value={draft.value}
      readOnly={readOnly}
      onChange={draft.onChange}
      onBlur={draft.commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") draft.commit();
        if (event.key === "Escape") draft.revert();
      }}
    />
  );
}
