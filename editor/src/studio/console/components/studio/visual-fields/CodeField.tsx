// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/CodeField.tsx). Edit it there, then npm run sync.
import { useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { autocompletion, completionStatus } from "@codemirror/autocomplete";
import { editorNonce } from "../../../../lib/studio/editorNonce";
import { cdslSnippetExtensions, expressionCompletion, highlightedRuns } from "../../../../lib/studio/editorLanguage";
import { expressionError } from "../../../../lib/studio/sourceEdits";
import type { FieldContext } from "../../../../components/studio/VisualFields";

/**
 * A property whose value is code (state.count, formatMoney(price)…):
 * highlighted like the Flux editor, with completion of the names it can
 * read, Flux's functions and the theme's tokens.
 *
 * At rest it draws its code as highlighted text, no editor: a form full of
 * them stays as light as plain text. Focused (a click, or Tab), the editor
 * takes its place. It commits on leaving it, Enter (unless a suggestion is
 * open, which Enter takes) or Ctrl/Cmd+Enter; a value that isn't Flux stays
 * in the field, with what's wrong, until it is. Escape puts it back.
 */
export function CodeField({
  id,
  label,
  value,
  context,
  onCommit,
  placeholder = "product.name",
}: {
  id: string;
  label: string;
  value: string;
  context: FieldContext;
  onCommit: (text: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string>();
  const draft = useRef(value);
  // Not being edited: the draft is what's saved (an edit elsewhere, an undo).
  if (!editing) draft.current = value;
  const bindings = useRef(context.bindings);
  bindings.current = context.bindings;
  const completeBinding = useRef(context.completeBinding);
  completeBinding.current = context.completeBinding;
  const runs = useMemo(() => highlightedRuns(value), [value]);

  /** Commits the draft; false (and the editor kept open) when it isn't Flux. */
  const commit = (): boolean => {
    const text = draft.current.trim();
    if (text === value.trim()) {
      setProblem(undefined);
      return true;
    }
    const error = expressionError(text);
    setProblem(error);
    if (error) return false;
    onCommit(text);
    return true;
  };
  const revert = () => {
    draft.current = value;
    setProblem(undefined);
    setEditing(false);
  };

  // Made once per field: the completion reads the bindings as they are now.
  const extensions = useMemo(
    () => [
      ...cdslSnippetExtensions,
      ...editorNonce,
      EditorView.lineWrapping,
      autocompletion({
        override: [expressionCompletion(() => bindings.current, () => completeBinding.current)],
        activateOnTyping: true,
        selectOnOpen: true,
      }),
      // Enter commits, unless a suggestion is open (the completion's own
      // keymap has it first); Ctrl/Cmd+Enter always commits.
      Prec.high(
        keymap.of([
          {
            key: "Enter",
            run: (view) => {
              if (completionStatus(view.state) === "active") return false;
              if (commit()) setEditing(false);
              return true;
            },
          },
          {
            key: "Mod-Enter",
            run: () => {
              if (commit()) setEditing(false);
              return true;
            },
          },
        ]),
      ),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value],
  );

  if (!editing)
    return (
      <>
        <button
          type="button"
          id={id}
          className={"studio-code-field" + (problem ? " is-invalid" : "")}
          aria-label={`${label}: ${value || "empty"}. Edit its code`}
          disabled={context.readOnly}
          onClick={() => setEditing(true)}
          onFocus={() => !context.readOnly && setEditing(true)}
        >
          {value ? (
            <code>
              {runs.map((run, index) => (
                <span key={index} className={run.className || undefined}>
                  {run.text}
                </span>
              ))}
            </code>
          ) : (
            <span className="studio-code-field-placeholder">{placeholder}</span>
          )}
        </button>
        {problem && (
          <p className="studio-visual-error" role="alert">
            {problem}
          </p>
        )}
      </>
    );

  return (
    <div
      className={"studio-code-field is-editing" + (problem ? " is-invalid" : "")}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        if (commit()) setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.stopPropagation();
          revert();
        }
      }}
    >
      <CodeMirror
        id={id}
        value={draft.current}
        theme="none"
        autoFocus
        aria-label={label + " code"}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          foldKeymap: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
          searchKeymap: false,
        }}
        extensions={extensions}
        onCreateEditor={(view) => view.dispatch({ selection: { anchor: view.state.doc.length } })}
        onChange={(text) => {
          draft.current = text;
          setProblem(undefined);
        }}
      />
      {problem && (
        <p className="studio-visual-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
