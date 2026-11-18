// Synced from Upskale Studio (upskaleapp/src/functions/studio/studio-context/index.ts). Edit it there, then npm run sync.
import { useContext } from "react";
import type { StudioContextValue } from "../../../components/studio/studioContext";
import { StudioContext } from "../../../constants/studio/studio-context/index";

export function useStudio(): StudioContextValue {
  const studio = useContext(StudioContext);
  if (!studio) throw new Error("Studio must be opened inside its workspace.");
  return studio;
}
