// Synced from Upskale Studio (upskaleapp/src/console/functions/studio/studio-context-menu/index.ts). Edit it there, then npm run sync.
import type { MenuItem } from "../../../../components/studio/StudioContextMenu";

/** [items] narrowed to those matching [query], submenus' items included (with their path as the hint). */
export function narrow(items: MenuItem[], query: string): MenuItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return flatten(items)
    .filter(({ item, path }) => [...path, item.label, item.hint ?? ""].join(" ").toLowerCase().includes(needle))
    .map(({ item, path }) => ({ ...item, section: undefined, hint: path.length ? path.join(" › ") : item.hint }));
}

/** Each item reachable from [items], with the path to it ("Wrap with › Layout"). */
export function flatten(items: MenuItem[], path: string[] = []): { item: MenuItem; path: string[] }[] {
  return items.flatMap((item) =>
    item.children ? flatten(item.children, [...path, item.label]) : [{ item, path }],
  );
}
