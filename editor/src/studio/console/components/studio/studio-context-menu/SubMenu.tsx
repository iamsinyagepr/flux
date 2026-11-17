// Synced from Upskale Studio (upskaleapp/src/console/components/studio/studio-context-menu/SubMenu.tsx). Edit it there, then npm run sync.
import { useState, useRef, useLayoutEffect } from "react";
import type { MenuItem } from "../../../../components/studio/StudioContextMenu";
import { narrow } from "../../../functions/studio/studio-context-menu/index";
import { MenuLevel } from "./MenuLevel";
import { MenuSearch } from "./MenuSearch";

/** A submenu beside its item; on the left when the right has no room. */
export function SubMenu(props: {
  label: string;
  x: number;
  y: number;
  flip: number;
  items: MenuItem[];
  searchable?: boolean;
  onCloseAll: () => void;
  onBack: () => void;
}) {
  const [x, setX] = useState(props.x);
  const [query, setQuery] = useState("");
  const shown = props.searchable ? narrow(props.items, query) : props.items;
  const probe = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const width = probe.current?.firstElementChild?.getBoundingClientRect().width ?? 0;
    setX(props.x + width + 8 > window.innerWidth ? Math.max(8, props.flip - width - 2) : props.x);
  }, [props.x, props.flip]);
  return (
    <div ref={probe} className="studio-context-submenu">
      <MenuLevel
        label={props.label}
        x={x}
        y={props.y}
        items={shown}
        onCloseAll={props.onCloseAll}
        onBack={props.onBack}
        search={
          props.searchable ? (
            <MenuSearch label={props.label} query={query} setQuery={setQuery} shown={shown} onCloseAll={props.onCloseAll} />
          ) : undefined
        }
        focusFirst={!props.searchable}
      />
    </div>
  );
}
