// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/DynamicField.tsx). Edit it there, then npm run sync.
import { MdLink, MdClose, MdAdd } from "react-icons/md";
import { type Dynamic, type Branch, writeDynamic } from "../../../../lib/studio/dynamicProps";
import { describeCondition } from "../../../../lib/studio/conditions";
import { type PropertyRow, readValue } from "../../../../lib/studio/visualModel";
import type { FieldContext } from "../../../../components/studio/VisualFields";
import { ExpressionInput } from "./ExpressionInput";
import { branchId, nextMatch } from "../../../functions/studio/visual-fields/index";
import { TokenPicker } from "./TokenPicker";
import { ValueInput } from "./ValueInput";
import { CaseMatch } from "./CaseMatch";

/**
 * A property driven by a state or option: a value for true and false, or a
 * value per case with an otherwise. Each value uses the property's own
 * control, so colours stay swatches and sizes stay chips.
 */
export function DynamicField({
  row,
  value,
  context,
  card,
  onSet,
  onUnlink,
}: {
  row: PropertyRow;
  value: Dynamic;
  context: FieldContext;
  card: boolean;
  onSet: (text: string) => void;
  onUnlink: () => void;
}) {
  const driver = value.kind === "when" ? undefined : context.drivers.find((item) => item.ref === value.ref);
  const control = (branch: Branch, label: string, change: (text: string) => void) => {
    const branchRow: PropertyRow = { ...row, value: readValue(context.source, branch.expr, row.spec) };
    return (
      <div className="studio-dynamic-branch">
        <span className="studio-dynamic-when">{label}</span>
        {branchRow.value.mode === "expression" ? (
          <ExpressionInput id={branchId(row.name, label)} value={branch.text} context={context} onCommit={change} />
        ) : card && (row.spec.kind === "token" || row.spec.kind === "color") && row.spec.family ? (
          <TokenPicker id={branchId(row.name, label)} row={branchRow} context={context} onSet={change} />
        ) : (
          <ValueInput id={branchId(row.name, label)} row={branchRow} context={context} onSet={change} />
        )}
      </div>
    );
  };
  const write = (next: Dynamic) => onSet(writeDynamic(next));
  if (value.kind === "when")
    return (
      <div className="studio-dynamic is-condition" data-driver="condition">
        <div className="studio-dynamic-driver">
          <MdLink aria-hidden="true" />
          <span title={value.condition}>
            When <code>{describeCondition(value.condition)}</code>
          </span>
          {!context.readOnly && (
            <button type="button" className="studio-text-button" onClick={onUnlink}>
              Unlink
            </button>
          )}
        </div>
        {control(value.whenTrue, "When it holds", (text) => write({ ...value, whenTrue: { text } }))}
        {value.whenFalse ? (
          control(value.whenFalse, "Otherwise", (text) => write({ ...value, whenFalse: { text } }))
        ) : (
          <div className="studio-dynamic-branch">
            <span className="studio-dynamic-when">Otherwise</span>
            <span className="studio-visual-hint">Not set</span>
            {!context.readOnly && (
              <button
                type="button"
                className="studio-text-button"
                onClick={() => write({ ...value, whenFalse: { text: value.whenTrue.text } })}
              >
                Set a value
              </button>
            )}
          </div>
        )}
      </div>
    );
  return (
    <div className="studio-dynamic" data-driver={value.ref}>
      <div className="studio-dynamic-driver">
        <MdLink aria-hidden="true" />
        <span>
          Changes with <code>{value.ref}</code>
        </span>
        {!context.readOnly && (
          <button type="button" className="studio-text-button" onClick={onUnlink}>
            Unlink
          </button>
        )}
      </div>
      {value.kind === "bool" ? (
        <>
          {control(value.whenTrue, "When true", (text) => write({ ...value, whenTrue: { text } }))}
          {control(value.whenFalse, "When false", (text) => write({ ...value, whenFalse: { text } }))}
        </>
      ) : (
        <>
          {value.cases.map((item, index) => (
            <div key={index} className="studio-dynamic-case">
              <div className="studio-dynamic-match">
                <span>When it is</span>
                <CaseMatch
                  label={`Case ${index + 1} of ${value.ref}`}
                  match={item.match}
                  driver={driver}
                  readOnly={context.readOnly}
                  onChange={(match) =>
                    write({ ...value, cases: value.cases.map((other, at) => (at === index ? { ...other, match } : other)) })
                  }
                />
                {value.cases.length > 1 && !context.readOnly && (
                  <button
                    type="button"
                    className="studio-icon-button"
                    aria-label={"Remove case " + (index + 1)}
                    title="Remove case"
                    onClick={() => write({ ...value, cases: value.cases.filter((_, at) => at !== index) })}
                  >
                    <MdClose aria-hidden="true" />
                  </button>
                )}
              </div>
              {control(item.value, "then", (text) =>
                write({ ...value, cases: value.cases.map((other, at) => (at === index ? { ...other, value: { text } } : other)) }),
              )}
            </div>
          ))}
          {!context.readOnly && (
            <button
              type="button"
              className="studio-visual-add"
              onClick={() =>
                write({
                  ...value,
                  cases: [...value.cases, { match: nextMatch(value, driver), value: { text: value.otherwise.text } }],
                })
              }
            >
              <MdAdd aria-hidden="true" /> Add case
            </button>
          )}
          {control(value.otherwise, "Otherwise", (text) => write({ ...value, otherwise: { text } }))}
        </>
      )}
    </div>
  );
}
