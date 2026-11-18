// Synced from Upskale Studio (upskaleapp/src/components/studio/studio-chrome/StudioBack.tsx). Edit it there, then npm run sync.
import { useEditorBack } from "../../../console/functions/shell/index";
import { BackLink } from "../../ui";

export function StudioBack() {
  const back = useEditorBack();
  return (
    <BackLink to="/app/studio" className="studio-back">
      {back.label}
    </BackLink>
  );
}
