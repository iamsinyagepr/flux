// Synced from Upskale Studio (upskaleapp/src/components/studio/studio-chrome/StorageNotice.tsx). Edit it there, then npm run sync.
import { useStudio } from "../../../functions/studio/studio-context/index";

export function StorageNotice() {
  const { mode } = useStudio();
  if (mode === "conflict")
    return (
      <p className="studio-storage-notice" role="status">
        A project was also changed on another device. Your changes are saved
        here; reopen Studio to keep both versions side by side.
      </p>
    );
  if (mode !== "memory") return null;
  return (
    <p className="studio-storage-notice" role="status">
      Browser storage is unavailable. Changes stay in this tab; export your
      source before leaving.
    </p>
  );
}
