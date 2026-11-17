// Synced from Upskale Studio (upskaleapp/src/console/components/dropdown-sheet/DropdownScrim.tsx). Edit it there, then npm run sync.
/**
 * On a phone a dropdown opens as a sheet over the page (the `dropdown-sheet`
 * class on its popup, tokens.css): this is the dimmed page behind it. A tap
 * on it closes the dropdown and lands nowhere else, as a modal's backdrop
 * does. Hidden from a tablet up, where the dropdown drops down as before.
 */
export function DropdownScrim({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="dropdown-scrim"
      aria-hidden="true"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    />
  );
}
