// Synced from Upskale Studio (upskaleapp/src/console/components/studio/studio-context-menu/MenuLevel.tsx). Edit it there, then npm run sync.
import { type ReactNode, useRef, useState, useLayoutEffect, useEffect, type KeyboardEvent } from "react";
import { MdChevronRight } from "react-icons/md";
import type { MenuItem } from "../../../../components/studio/StudioContextMenu";
import { SubMenu } from "./SubMenu";

/** Every item button of this level (not a submenu's), icon rows included. */
const ITEMS = ":scope > div > button:not(:disabled), :scope > div > .studio-context-menu-icons > button:not(:disabled)";
/** How many icon-only items run from `index`. */
function run(items: MenuItem[], index: number) {
  let count = 0;
  while (items[index + count]?.iconOnly) count++;
  return count;
}

export function MenuLevel({
  label,
  x,
  y,
  items,
  onCloseAll,
  onBack,
  search,
  focusFirst,
}: {
  label: string;
  x: number;
  y: number;
  items: MenuItem[];
  onCloseAll: () => void;
  /** For a submenu: close it and return to its item. */
  onBack?: () => void;
  search?: ReactNode;
  focusFirst: boolean;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [open, setOpen] = useState<{ index: number; x: number; y: number; flip: number }>();
  // Keep the menu on screen; a submenu that won't fit on the right opens on the left.
  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect();
    if (!box) return;
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - box.height - 8)),
    });
  }, [x, y, items.length]);
  useEffect(() => {
    if (focusFirst) menu.current?.querySelector<HTMLButtonElement>(ITEMS)?.focus();
  }, []);
  const buttons = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>(ITEMS) ?? [])];
  const openAt = (index: number, button: HTMLElement) => {
    const box = button.getBoundingClientRect();
    setOpen({ index, x: box.right + 2, y: box.top - 5, flip: box.left });
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement && !["Escape", "Tab"].includes(event.key)) return;
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      if (onBack && event.key === "Escape") onBack();
      else onCloseAll();
      return;
    }
    if (event.key === "ArrowLeft" && onBack) {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const all = buttons();
    const current = all.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowRight") {
      const index = Number(all[current]?.dataset.index);
      if (items[index]?.children) openAt(index, all[current]);
      return;
    }
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? all.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
    all[next]?.focus();
  };
  const submenu = open && items[open.index]?.children;
  return (
    <div ref={menu} role="menu" aria-label={label} className="studio-context-menu" style={position} onKeyDown={keyDown}>
      {search}
      {items.length === 0 && <p className="studio-context-menu-empty">Nothing matches</p>}
      {items.map((item, index) =>
        item.iconOnly ? (
          // A run of icon-only items: one row, drawn at its first.
          items[index - 1]?.iconOnly ? null : (
            <div key={item.label + index} role="none">
              {item.section && (
                <div className="studio-context-menu-section" role="presentation">
                  {item.section}
                </div>
              )}
              <div className="studio-context-menu-icons" role="none">
                {items.slice(index, index + run(items, index)).map((one, offset) => (
                  <button
                    key={one.label}
                    type="button"
                    role="menuitem"
                    data-index={index + offset}
                    disabled={one.disabled}
                    aria-label={one.label}
                    title={one.title ?? (one.hint ? `${one.label} (${one.hint})` : one.label)}
                    className={one.danger ? "is-danger" : undefined}
                    onMouseEnter={() => open && setOpen(undefined)}
                    onClick={() => {
                      onCloseAll();
                      one.onSelect?.();
                    }}
                  >
                    {one.icon}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : (
        <div key={item.label + index} role="none">
          {item.section && (
            <div className="studio-context-menu-section" role="presentation">
              {item.section}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            data-index={index}
            disabled={item.disabled}
            title={item.title}
            aria-haspopup={item.children ? "menu" : undefined}
            aria-expanded={item.children ? open?.index === index : undefined}
            className={[item.children && open?.index === index ? "is-open" : "", item.danger ? "is-danger" : ""].filter(Boolean).join(" ") || undefined}
            onMouseEnter={(event) => {
              if (item.children && !item.disabled) openAt(index, event.currentTarget);
              else if (open) setOpen(undefined);
            }}
            onClick={(event) => {
              if (item.children) return openAt(index, event.currentTarget);
              onCloseAll();
              item.onSelect?.();
            }}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.hint && <small className="studio-context-menu-hint">{item.hint}</small>}
            {item.children && <MdChevronRight className="studio-context-menu-more" aria-hidden="true" />}
          </button>
          {submenu && open.index === index && (
            <SubMenu
              label={item.menuLabel ?? item.label}
              x={open.x}
              y={open.y}
              flip={open.flip}
              items={submenu}
              searchable={item.searchable}
              onCloseAll={onCloseAll}
              onBack={() => {
                setOpen(undefined);
                buttons().find((button) => Number(button.dataset.index) === index)?.focus();
              }}
            />
          )}
        </div>
        ),
      )}
    </div>
  );
}
