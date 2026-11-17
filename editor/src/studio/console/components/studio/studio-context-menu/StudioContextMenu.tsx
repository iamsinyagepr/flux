// Synced from Upskale Studio (upskaleapp/src/console/components/studio/studio-context-menu/StudioContextMenu.tsx). Edit it there, then npm run sync.
import { portalRoot } from "../../../../../host/portal";
import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { MenuItem } from "../../../../components/studio/StudioContextMenu";
import { narrow } from "../../../functions/studio/studio-context-menu/index";
import { MenuLevel } from "./MenuLevel";
import { MenuSearch } from "./MenuSearch";

/**
 * A context menu at a point: arrow keys, Home/End, Enter and Escape; → opens
 * a submenu and ← closes it. Closes on an outside click and returns focus to
 * whatever opened it. [searchable] adds a filter that also finds items
 * inside submenus.
 */
export function StudioContextMenu({
  label,
  x,
  y,
  items,
  onClose,
  searchable = false,
}: {
  label: string;
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  searchable?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(document.activeElement);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", outside);
    const element = root.current;
    return () => {
      document.removeEventListener("pointerdown", outside);
      // Give focus back only if nothing else (a picker the item opened) took it.
      const active = document.activeElement;
      if (opener.current instanceof HTMLElement && (!active || active === document.body || element?.contains(active)))
        opener.current.focus();
    };
  }, []);
  // Whatever opened the menu (a shortcut, a right-click) keeps focus otherwise.
  useEffect(() => {
    if (!searchable) return;
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>(".studio-context-menu-search input")?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const shown = narrow(items, query);
  return createPortal(
    <div
      ref={root}
      className="studio-context-menu-root"
      onContextMenu={(event) => event.preventDefault()}
      // A portal still bubbles through React: keep the canvas from panning on a pick.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <MenuLevel
        label={label}
        x={x}
        y={y}
        items={shown}
        onCloseAll={onClose}
        search={searchable ? <MenuSearch label={label} query={query} setQuery={setQuery} shown={shown} onCloseAll={onClose} /> : undefined}
        focusFirst={!searchable}
      />
    </div>,
    portalRoot(),
  );
}

export default StudioContextMenu;
