// Synced from Upskale Studio (upskaleapp/src/console/components/studio/config-dialog/TabButton.tsx). Edit it there, then npm run sync.
import { type ReactNode } from "react";
import type { IconType } from "react-icons";

/** The store page's tab button, so both editors read as one app. */
export function TabButton({
  active,
  onClick,
  children,
  icon: Icon,
  nested = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Its icon, before the label. */
  icon?: IconType;
  /** One of a tab's own sections, indented under it. */
  nested?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg cursor-pointer text-sm hover:bg-surface text-ink transition-colors ${
        nested ? "py-1.5 pr-3 pl-8 text-[13px]" : "px-3 py-2"
      } ${active ? "bg-surface text-ink" : "text-steel"}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}
