// Synced from Upskale Studio (upskaleapp/src/console/components/studio/config-dialog/CardHead.tsx). Edit it there, then npm run sync.
import { type ReactNode } from "react";

export function CardHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children && (
        <p className="mt-1 text-sm leading-relaxed text-steel">{children}</p>
      )}
    </div>
  );
}
