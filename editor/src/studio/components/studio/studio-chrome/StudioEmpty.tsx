// Synced from Upskale Studio (upskaleapp/src/components/studio/studio-chrome/StudioEmpty.tsx). Edit it there, then npm run sync.
import { type ReactNode } from "react";
import { MdCode } from "react-icons/md";

export function StudioEmpty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="studio-empty">
      <span className="studio-mark">
        <MdCode />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
