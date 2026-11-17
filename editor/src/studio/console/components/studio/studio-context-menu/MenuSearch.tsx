// Synced from Upskale Studio (upskaleapp/src/console/components/studio/studio-context-menu/MenuSearch.tsx). Edit it there, then npm run sync.
import { MdSearch } from "react-icons/md";
import type { MenuItem } from "../../../../components/studio/StudioContextMenu";
import { flatten } from "../../../functions/studio/studio-context-menu/index";

/** A menu's search box: ↓ goes into the list, Enter picks the first match. */
export function MenuSearch({
  label,
  query,
  setQuery,
  shown,
  onCloseAll,
}: {
  label: string;
  query: string;
  setQuery: (query: string) => void;
  shown: MenuItem[];
  onCloseAll: () => void;
}) {
  return (
    <label className="studio-context-menu-search">
      <MdSearch aria-hidden="true" />
      <input
        autoFocus
        aria-label={"Search " + label.toLowerCase()}
        placeholder="Search…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget
              .closest("[role=menu]")
              ?.querySelector<HTMLButtonElement>(":scope > div > button:not(:disabled)")
              ?.focus();
          } else if (event.key === "Enter") {
            event.preventDefault();
            const first = flatten(shown).find(({ item }) => !item.disabled)?.item;
            if (first?.onSelect) {
              onCloseAll();
              first.onSelect();
            }
          }
        }}
      />
    </label>
  );
}
