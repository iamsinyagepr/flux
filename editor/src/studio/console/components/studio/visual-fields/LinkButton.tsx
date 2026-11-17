// Synced from Upskale Studio (upskaleapp/src/console/components/studio/visual-fields/LinkButton.tsx). Edit it there, then npm run sync.
import { useState } from "react";
import { MdLink } from "react-icons/md";
import StudioContextMenu from "../../../../components/studio/StudioContextMenu";
import { type PropertyRow } from "../../../../lib/studio/visualModel";
import type { FieldContext } from "../../../../components/studio/VisualFields";

/** "Link to…": the states and options a property can change with. */
export function LinkButton({ row, context, onLink }: { row: PropertyRow; context: FieldContext; onLink: (ref: string) => void }) {
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  if (!context.drivers.length) return null;
  return (
    <>
      <button
        type="button"
        className="studio-icon-button"
        aria-label={"Link " + row.name + " to a state or option"}
        aria-haspopup="menu"
        title="Change with a state or option"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setMenu({ x: box.left, y: box.bottom + 4 });
        }}
      >
        <MdLink aria-hidden="true" />
      </button>
      {menu && (
        <StudioContextMenu
          label={"Link " + row.name}
          x={menu.x}
          y={menu.y}
          items={context.drivers.map((driver, index) => ({
            label: driver.ref,
            hint: driver.type,
            section: index === 0 ? "Change with" : undefined,
            onSelect: () => onLink(driver.ref),
          }))}
          onClose={() => setMenu(undefined)}
        />
      )}
    </>
  );
}
