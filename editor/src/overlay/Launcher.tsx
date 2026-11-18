// The editor's one control on the page: a round button with Upskale's mark,
// glowing in the brand's teal and its yellow, and a menu that floats above
// it: editing on or off, the page's tree, the theme, and data lists to add.
import { useEffect, useRef, useState } from "react";
import { MdAccountTree, MdChevronRight, MdExpandMore, MdPalette, MdViewList } from "react-icons/md";
import { LOGO_BACK, LOGO_BODY, LOGO_FOLD, LOGO_HEAD, LOGO_VIEWBOX } from "../studio/constants/ui/index";
import { DATA_LISTS, type DataList } from "./dataLists";

export function UpskaleMark() {
  return (
    <svg viewBox={LOGO_VIEWBOX} aria-hidden="true" className="flux-mark">
      <path d={LOGO_BODY} fill="var(--color-accent)" />
      <path d={LOGO_FOLD} fill="black" opacity="0.22" />
      <path d={LOGO_BACK} fill="black" opacity="0.12" />
      <path d={LOGO_HEAD} fill="var(--color-accent)" />
    </svg>
  );
}

export function Launcher({
  editing,
  status,
  treeOpen,
  canAddData,
  onToggleEditing,
  onToggleTree,
  onOpenTheme,
  onAddData,
}: {
  editing: boolean;
  /** A word beside the button when there's something to say (saving, paused). */
  status?: string;
  treeOpen: boolean;
  /** Why data can't be added now, or undefined when it can. */
  canAddData?: string;
  onToggleEditing(): void;
  onToggleTree(): void;
  onOpenTheme(): void;
  onAddData(list: DataList): void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Closes on a click elsewhere, or Esc.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!event.composedPath().includes(root.current as EventTarget)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", escape, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) setData(false);
  }, [open]);

  const run = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div className="flux-launcher" ref={root}>
      {open && (
        <div className="flux-launcher-menu" role="menu" aria-label="Flux editor">
          <button type="button" role="menuitemcheckbox" aria-checked={editing} className="flux-launcher-item" onClick={run(onToggleEditing)}>
            <span className={"flux-launcher-switch" + (editing ? " is-on" : "")} aria-hidden="true" />
            <span>Edit the page</span>
            <kbd>E</kbd>
          </button>
          <button type="button" role="menuitemcheckbox" aria-checked={treeOpen} className="flux-launcher-item" onClick={run(onToggleTree)}>
            <MdAccountTree className="flux-launcher-icon" aria-hidden="true" />
            <span>Page tree</span>
            <kbd>T</kbd>
          </button>
          <button type="button" role="menuitem" className="flux-launcher-item" onClick={run(onOpenTheme)}>
            <MdPalette className="flux-launcher-icon" aria-hidden="true" />
            <span>Theme and settings…</span>
          </button>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={data}
            className="flux-launcher-item"
            disabled={!!canAddData}
            title={canAddData}
            onClick={() => setData((on) => !on)}
          >
            <MdViewList className="flux-launcher-icon" aria-hidden="true" />
            <span>Add a data list</span>
            {data ? <MdExpandMore className="flux-launcher-more" aria-hidden="true" /> : <MdChevronRight className="flux-launcher-more" aria-hidden="true" />}
          </button>
          {data && (
            <div className="flux-launcher-sub" role="menu" aria-label="Data lists">
              {DATA_LISTS.map((list) => (
                <button key={list.id} type="button" role="menuitem" className="flux-launcher-item" onClick={run(() => onAddData(list))}>
                  <span>{list.label}</span>
                  <small>{list.hint}</small>
                </button>
              ))}
            </div>
          )}
          <p className="flux-launcher-hint">
            Shift+click selects several · Ctrl+right-click: a widget's properties · drag a selected widget to move it
          </p>
        </div>
      )}
      <button
        type="button"
        className={"flux-launcher-button" + (editing ? " is-editing" : "")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={editing ? "Flux editor: editing. Open its menu" : "Flux editor: open its menu"}
        title="Flux editor"
        onClick={() => setOpen((on) => !on)}
      >
        <UpskaleMark />
      </button>
      {status && (
        <span className="flux-launcher-status" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
