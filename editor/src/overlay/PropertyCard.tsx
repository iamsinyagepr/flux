// One property of one widget, on a card beside it on the page: Studio's own
// field for it (PropertyField, as Studio's properties panel draws each one).
// Changes are made on a draft of the source, and saved together with Done;
// Cancel (or Esc) leaves the file as it was.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PropertyField, fieldContextFor } from "../studio/components/studio/VisualFields";
import { parseSource, type CallExpr } from "../studio/lib/studio/parser";
import type { StudioConfig } from "../studio/lib/studio/projectConfig";
import type { ReferenceEntry } from "../studio/lib/studio/registry";
import { callLocations, definitionOf, removeArgument, setArgument, type SourceEdit } from "../studio/lib/studio/sourceEdits";
import { propertyDefault, propertyRows } from "../studio/lib/studio/visualModel";
import type { Box } from "./marks";

export interface PropertyCardRequest {
  documentId: string;
  /** Where the widget is written: its call's start and end. */
  from: number;
  to: number;
  name: string;
  /** Adding a property the widget doesn't have yet: it starts at its default. */
  adding: boolean;
}

const WIDTH = 340;
const GAP = 10;
const MARGIN = 12;

/** The widget's call in a source, by where it starts (an edit inside it moves only its end). */
function callAt(source: string, from: number): { node: CallExpr; root: CallExpr } | undefined {
  try {
    const root = parseSource(source).root;
    const node = root && callLocations(root).find((location) => location.node.from === from)?.node;
    return root && node ? { node, root } : undefined;
  } catch {
    return undefined;
  }
}

export function PropertyCard({
  request,
  source,
  file,
  box,
  components,
  currentComponent,
  config,
  pagePaths,
  onDone,
  onCancel,
}: {
  request: PropertyCardRequest;
  /** The widget's source as it is on disk. */
  source: string;
  /** Its file, for the card's header. */
  file: string;
  /** The element on the page: the card sits beside its top-right corner. */
  box: Box | undefined;
  components: ReadonlyMap<string, ReferenceEntry>;
  currentComponent?: string;
  config?: StudioConfig;
  pagePaths: string[];
  onDone(edit: SourceEdit): void;
  onCancel(): void;
}) {
  const context = { components, currentComponent };
  // The draft: the source with the card's changes, saved by Done.
  const [draft, setDraft] = useState(() => {
    const at = callAt(source, request.from);
    if (!request.adding || !at || Object.hasOwn(at.node.args, request.name)) return source;
    const available = propertyRows(source, at.node, definitionOf(at.node, context)).available.find((item) => item.name === request.name);
    if (!available) return source;
    try {
      return setArgument(source, { from: at.node.from, to: at.node.to }, request.name, propertyDefault(available.name, available.type, config)).source;
    } catch {
      return source;
    }
  });
  const [problem, setProblem] = useState("");
  const at = useMemo(() => callAt(draft, request.from), [draft, request.from]);
  const row = useMemo(
    () => at && propertyRows(draft, at.node, definitionOf(at.node, context)).rows.find((item) => item.name === request.name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, at, request.name, components, currentComponent],
  );
  const fieldContext = useMemo(
    () => at && fieldContextFor({ source: draft, root: at.root, at: at.node.from, config, pagePaths, readOnly: false }),
    [draft, at, config, pagePaths],
  );
  const changed = draft !== source;
  const edit = (make: (text: string, range: { from: number; to: number }) => SourceEdit) => {
    if (!at) return;
    try {
      setDraft(make(draft, { from: at.node.from, to: at.node.to }).source);
      setProblem("");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "That value couldn't be set.");
    }
  };
  const done = () => {
    if (!at) return onCancel();
    if (!changed) return onCancel();
    onDone({ source: draft, selection: { from: at.node.from, to: at.node.to } });
  };

  // Esc cancels, Ctrl+Enter is Done.
  const latest = useRef({ done, onCancel });
  latest.current = { done, onCancel };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        latest.current.onCancel();
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        latest.current.done();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Next to the element, never over it: beside its top-right corner; else
  // beside its top-left; else under it, or over it, lined up with its right
  // edge (an element as wide as the page). Always on screen.
  const card = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (card.current) setHeight(card.current.offsetHeight);
  });
  const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN);
  const tall = Math.max(height, 120);
  const fitsX = (x: number) => x >= MARGIN && x + width <= window.innerWidth - MARGIN;
  const fitsY = (y: number) => y >= MARGIN && y + tall <= window.innerHeight - MARGIN;
  let left = window.innerWidth - width - MARGIN;
  let top = MARGIN;
  if (box) {
    const right = box.left + box.width;
    const bottom = box.top + box.height;
    const alignedRight = Math.min(Math.max(right - width, MARGIN), window.innerWidth - width - MARGIN);
    if (fitsX(right + GAP)) [left, top] = [right + GAP, box.top];
    else if (fitsX(box.left - width - GAP)) [left, top] = [box.left - width - GAP, box.top];
    else if (fitsY(bottom + GAP)) [left, top] = [alignedRight, bottom + GAP];
    else if (fitsY(box.top - tall - GAP)) [left, top] = [alignedRight, box.top - tall - GAP];
    else [left, top] = [alignedRight, bottom + GAP];
  }
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - tall - MARGIN));

  return (
    <div
      ref={card}
      className="flux-card"
      role="dialog"
      aria-label={`${request.adding ? "Add" : "Edit"} ${request.name}${at ? " on " + at.node.name : ""}`}
      style={{ left, top, width }}
    >
      <header className="flux-card-head">
        <div>
          <strong>
            {request.adding ? "Add " : ""}
            {request.name}
          </strong>
          <small>
            {at?.node.name ?? "Widget"} · {file}
          </small>
        </div>
      </header>
      <div className="flux-card-body">
        {!at && <p className="flux-card-note">This widget isn't in its file any more: it was changed elsewhere.</p>}
        {at && !row && <p className="flux-card-note">{at.node.name} has no {request.name} now.</p>}
        {at && row && fieldContext && (
          <PropertyField
            key={request.name + ":" + at.node.from}
            layout={(row.spec.kind === "color" || row.spec.kind === "token") && row.value.mode !== "expression" ? "card" : "form"}
            row={row}
            expr={at.node.args[request.name]}
            context={fieldContext}
            error={problem || undefined}
            onSet={(text) => edit((text0, range) => setArgument(text0, range, request.name, text))}
            onRemove={() => edit((text0, range) => removeArgument(text0, range, request.name))}
          />
        )}
      </div>
      <footer className="flux-card-foot">
        <span className="flux-card-state">{changed ? "Not saved yet" : request.adding ? "" : "No changes"}</span>
        <button type="button" className="flux-card-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="flux-card-button is-primary" onClick={done} disabled={!at}>
          Done
        </button>
      </footer>
    </div>
  );
}
