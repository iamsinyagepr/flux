// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/CodeSnippet.tsx). Edit it there, then npm run sync.
import { useState, useRef, useEffect } from "react";
import { editorNonce } from "../../../../lib/studio/editorNonce";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { cdslSnippetExtensions } from "../../../../lib/studio/editorLanguage";
import { expressionError } from "../../../../lib/studio/sourceEdits";
import type { FieldContext } from "../../../../components/studio/VisualFields";

/**
 * A small editable Flux block, highlighted like the Code editor. Commits on
 * leaving it or Ctrl/Cmd+Enter (one undo step); Escape reverts.
 */
export function CodeSnippet({
  id,
  label,
  value,
  context,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  context: FieldContext;
  onCommit: (text: string) => void;
}) {
  const [problem, setProblem] = useState<string>();
  const draft = useRef(value);
  // Bumped to throw away an uncommitted edit (Escape).
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    draft.current = value;
  }, [value]);
  const commit = () => {
    const text = draft.current.trim();
    if (text === value.trim()) return;
    const error = expressionError(text);
    setProblem(error);
    if (!error) onCommit(text);
  };
  return (
    <div
      className={"studio-canvas-code" + (problem ? " is-invalid" : "")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.stopPropagation();
          draft.current = value;
          setProblem(undefined);
          setGeneration((current) => current + 1);
        }
      }}
    >
      <CodeMirror
        key={generation}
        id={id}
        value={value}
        theme="none"
        aria-label={label + " expression"}
        editable={!context.readOnly}
        readOnly={context.readOnly}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          foldKeymap: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
          searchKeymap: false,
        }}
        extensions={[...cdslSnippetExtensions, ...editorNonce, EditorView.lineWrapping]}
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
