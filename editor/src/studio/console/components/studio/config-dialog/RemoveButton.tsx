// Synced from Upskale Studio (upskaleapp/src/console/components/studio/config-dialog/RemoveButton.tsx). Edit it there, then npm run sync.


export function RemoveButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="studio-config-reset studio-config-remove"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      Remove
    </button>
  );
}
