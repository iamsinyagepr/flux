// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/DataTextInput.tsx). Edit it there, then npm run sync.
import { useState, useEffect, useRef } from "react";
import { dataWordAt, type DataSuggestion } from "../../../../lib/studio/dataBindings";
import type { FieldContext } from "../../../../components/studio/VisualFields";

/** Commit-on-blur text input with Enter to commit and Escape to revert. */
/**
 * A text field that offers data while typing: a word like "cart" (or the
 * expression inside an open ${…}) lists matching bindings, and picking one
 * inserts it as ${…}, making the text a template. Tab inserts the highlighted
 * one; Enter does only after moving with the arrows, so typing an ordinary
 * word ("Open") and pressing Enter keeps the word. Escape closes the list (a
 * second Escape reverts the text).
 */
export function DataTextInput({
  id,
  raw,
  context,
  onCommit,
  describedBy,
}: {
  id: string;
  raw: string;
  context: FieldContext;
  onCommit: (text: string) => void;
  describedBy?: string;
}) {
  const [value, setValue] = useState(raw);
  useEffect(() => setValue(raw), [raw]);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Whether the arrows have picked one, which Enter then inserts.
  const [picked, setPicked] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = id + "-data";
  const spot = context.suggestData && !context.readOnly ? dataWordAt(value, caret) : undefined;
  const items = open && spot ? context.suggestData!(spot.word) : [];
  const showing = items.length > 0;
  const commit = () => {
    if (value !== raw) onCommit(value);
  };
  const choose = (item: DataSuggestion) => {
    if (!spot) return;
    const next = spot.apply(item.insert);
    setValue(next.text);
    setOpen(false);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.caret, next.caret);
      setCaret(next.caret);
    });
  };
  return (
    <div className="studio-data-text">
      <input
        ref={input}
        id={id}
        className="studio-visual-input"
        value={value}
        readOnly={context.readOnly}
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={listId}
        aria-activedescendant={showing ? listId + "-" + Math.min(active, items.length - 1) : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          setValue(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
          setOpen(true);
          setActive(0);
          setPicked(false);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
        onBlur={() => {
          setOpen(false);
          commit();
        }}
        onKeyDown={(event) => {
          if (showing) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((current) => (picked ? (current + step + items.length) % items.length : step > 0 ? 0 : items.length - 1));
              setPicked(true);
              return;
            }
            if (event.key === "Tab" || (event.key === "Enter" && picked)) {
              event.preventDefault();
              choose(items[Math.min(active, items.length - 1)]);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              return;
            }
          }
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setValue(raw);
        }}
      />
      {showing && (
        <ul id={listId} role="listbox" aria-label="Data" className="studio-data-suggestions">
          {items.map((item, index) => (
            <li
              key={item.insert}
              id={listId + "-" + index}
              role="option"
              aria-selected={index === Math.min(active, items.length - 1)}
              className={picked || index ? undefined : "is-hint"}
              // Keep focus in the field: pick on press, not after a blur.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <code>{item.insert}</code>
              <small>{item.detail}</small>
            </li>
          ))}
          <li role="presentation" className="studio-data-suggestions-help">
            Tab inserts · ↑↓ to choose
          </li>
        </ul>
      )}
    </div>
  );
}
