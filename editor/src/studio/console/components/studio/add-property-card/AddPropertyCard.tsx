// Synced from Upskale Studio (upskaleapp/src/console/components/studio/add-property-card/AddPropertyCard.tsx). Edit it there, then npm run sync.
import { portalRoot } from "../../../../../host/portal";
import { useRef, useState, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { MdClose } from "react-icons/md";
import type { PropertyRow } from "../../../../lib/studio/visualModel";
import { type FieldContext, PropertyField } from "../../../../components/studio/VisualFields";

/**
 * The code editor's "Add property": the property's own value editor (colour,
 * spacing, a choice, text), as on the canvas, where the menu was. Nothing is
 * written until a value is picked or typed; Escape, ✕ or a click elsewhere
 * adds nothing.
 */
export function AddPropertyCard({
  x,
  y,
  title,
  row,
  context,
  onSet,
  onClose,
}: {
  x: number;
  y: number;
  title: string;
  row: PropertyRow;
  context: FieldContext;
  onSet(text: string): void;
  onClose(): void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Kept on screen, like the menu it replaces.
  useLayoutEffect(() => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // On the next tick, so a typed value that commits as its field loses focus
    // (Enter or blur) is written first.
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setTimeout(onClose);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside, true);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside, true);
    };
  }, [onClose]);

  return createPortal(
    <div ref={box} role="dialog" aria-label={title} className="studio-add-property-card" style={position}>
      <div className="studio-add-property-head">
        <strong>{title}</strong>
        <button type="button" className="studio-icon-button" aria-label="Cancel" title="Cancel" onClick={onClose}>
          <MdClose />
        </button>
      </div>
      <PropertyField layout="card" row={row} expr={undefined} context={context} onSet={onSet} onRemove={onClose} />
    </div>,
    portalRoot(),
  );
}

export default AddPropertyCard;
