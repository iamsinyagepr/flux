// Synced from Upskale Studio (upskaleapp/src/console/components/studio/config-dialog/ResetButton.tsx). Edit it there, then npm run sync.


export function ResetButton({
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
      className="studio-config-reset"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      Reset
    </button>
  );
}
