// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/ExpressionInput.tsx). Edit it there, then npm run sync.
import { useState } from "react";
import { expressionError } from "../../../../lib/studio/sourceEdits";
import type { FieldContext } from "../../../../components/studio/VisualFields";
import { useDraft } from "../../../functions/studio/visual-fields/index";

export function ExpressionInput({
  id,
  value,
  context,
  onCommit,
}: {
  id: string;
  value: string;
  context: FieldContext;
  onCommit: (text: string) => void;
}) {
  const listId = id + "-bindings";
  const [problem, setProblem] = useState<string>();
  const draft = useDraft(value, (text) => {
    const error = expressionError(text);
    setProblem(error);
    if (!error) onCommit(text);
  });
  return (
    <>
      <input
        id={id}
        className="studio-visual-input studio-visual-expression"
        value={draft.value}
        list={listId}
        spellCheck={false}
        readOnly={context.readOnly}
        placeholder="product.name"
        aria-invalid={problem ? true : undefined}
        onChange={(event) => {
          setProblem(undefined);
          draft.onChange(event);
        }}
        onBlur={draft.commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") draft.commit();
          if (event.key === "Escape") {
            draft.revert();
            setProblem(undefined);
          }
        }}
      />
      <datalist id={listId}>
        {context.bindings.slice(0, 300).map((binding) => (
          <option key={binding} value={binding} />
        ))}
      </datalist>
      {problem && (
        <p className="studio-visual-error" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
