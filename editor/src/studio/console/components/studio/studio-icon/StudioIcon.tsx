// Synced from Upskale Studio (upskaleapp/src/console/components/studio/studio-icon/StudioIcon.tsx). Edit it there, then npm run sync.
import type { IconBaseProps } from "react-icons";
import { type IconLibrary, iconReference } from "../../../../lib/studio/projectConfig";
import { sets } from "../../../constants/studio/studio-icon/index";

export function StudioIcon({
  token,
  sourceAttributes,
  library = "material",
  ...props
}: IconBaseProps & {
  token: string;
  library?: IconLibrary;
  sourceAttributes?: Record<string, string | undefined>;
}) {
  const reference = iconReference(token, library),
    Icon = sets[reference.library][reference.name];
  return Icon ? (
    <Icon
      {...props}
      {...sourceAttributes}
      data-icon-library={reference.library}
      data-icon-name={reference.name}
    />
  ) : null;
}
