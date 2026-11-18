// What can be done with several selected widgets, on a bar floating above
// them: wrap them in one Column, Row…; move them into another widget (each
// one listed, outlined on the page as it's hovered); delete them.
import { useEffect, useRef, useState } from "react";
import { MdClose, MdDeleteOutline, MdDriveFileMove, MdExpandMore, MdOutlineWrapText } from "react-icons/md";
import { MULTI_WRAPPERS, type MultiWrapper } from "../studio/lib/studio/sourceEdits";
import type { Box, Mark } from "./marks";

export interface MoveTarget {
  mark: Mark;
  label: string;
  /** How deep it is in the page, for indenting the list. */
  depth: number;
}

const WIDTH = 360;

export function MultiBar({
  count,
  box,
  targets,
  onWrap,
  onMove,
  onHoverTarget,
  onDelete,
  onClear,
}: {
  count: number;
  /** Around everything selected: the bar sits above it. */
  box: Box | undefined;
  targets: MoveTarget[];
  onWrap(wrapper: MultiWrapper): void;
  onMove(target: Mark): void;
  onHoverTarget(target: Mark | undefined): void;
  onDelete(): void;
  onClear(): void;
}) {
  const [open, setOpen] = useState<"wrap" | "move">();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!event.composedPath().includes(root.current as EventTarget)) setOpen(undefined);
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [open]);
  useEffect(() => {
    if (open !== "move") onHoverTarget(undefined);
  }, [open, onHoverTarget]);

  const width = Math.min(WIDTH, window.innerWidth - 24);
  const left = box ? Math.max(12, Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - 12)) : 12;
  const above = box ? box.top - 52 : 12;
  const top = above >= 12 ? above : Math.min((box?.top ?? 0) + (box?.height ?? 0) + 10, window.innerHeight - 60);

  return (
    <div className="flux-multibar" ref={root} role="toolbar" aria-label={`${count} widgets selected`} style={{ left, top, width }}>
      <span className="flux-multibar-count">{count} selected</span>
      <div className="flux-multibar-group">
        <button type="button" aria-haspopup="menu" aria-expanded={open === "wrap"} onClick={() => setOpen(open === "wrap" ? undefined : "wrap")}>
          <MdOutlineWrapText aria-hidden="true" /> Wrap in <MdExpandMore aria-hidden="true" />
        </button>
        {open === "wrap" && (
          <div className="flux-multibar-menu" role="menu">
            {MULTI_WRAPPERS.map((wrapper) => (
              <button
                key={wrapper}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(undefined);
                  onWrap(wrapper);
                }}
              >
                {wrapper}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flux-multibar-group">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open === "move"}
          disabled={!targets.length}
          title={targets.length ? undefined : "Nothing else on this page takes children"}
          onClick={() => setOpen(open === "move" ? undefined : "move")}
        >
          <MdDriveFileMove aria-hidden="true" /> Move to <MdExpandMore aria-hidden="true" />
        </button>
        {open === "move" && (
          <div className="flux-multibar-menu is-targets" role="menu" onMouseLeave={() => onHoverTarget(undefined)}>
            {targets.map((target) => (
              <button
                key={`${target.mark.from}:${target.mark.to}`}
                type="button"
                role="menuitem"
                style={{ paddingLeft: 10 + target.depth * 12 }}
                onMouseEnter={() => onHoverTarget(target.mark)}
                onFocus={() => onHoverTarget(target.mark)}
                onClick={() => {
                  setOpen(undefined);
                  onHoverTarget(undefined);
                  onMove(target.mark);
                }}
              >
                {target.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="is-danger" onClick={onDelete}>
        <MdDeleteOutline aria-hidden="true" /> Delete
      </button>
      <button type="button" className="flux-multibar-clear" aria-label="Clear the selection" title="Clear (Esc)" onClick={onClear}>
        <MdClose aria-hidden="true" />
      </button>
    </div>
  );
}
